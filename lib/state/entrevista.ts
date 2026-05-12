// Zustand store for the entrevista UI (Phase 7 shell).
//
// Spec: IMPLEMENTATION.md §8.3 (EntrevistaState) ampliada con marcadas_respondidas,
// cajas_llenas_por_grupo y cargarFixtureMock para soportar dev sin API key.
//
// Autosave model (memoria feedback_resolved_decisions §6 autosave_1.5s):
//   - setRespuesta updates the in-memory text immediately and schedules a
//     server-action call after 1.5s of inactivity for that pregunta.
//   - Per-pregunta debounce timers (a single global timer would coalesce
//     unrelated preguntas).
//   - Failures are non-blocking — logged in console + a transient ui flag,
//     never throw to the component.

import { create } from 'zustand';
import {
  readUIMessageStream,
  type UIMessage,
} from 'ai';
import { sseBytesToUIChunks } from './sse-to-ui-chunks';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import {
  type Pregunta,
  type PreguntaBatch,
  type TipoPregunta,
} from '@/lib/schemas/pregunta-batch';
import { guardarRespuestaPendiente } from '@/app/actions/respuestas';
import { FIXTURE_BATCH_MOCK } from './fixture-batch-mock';

// =============================================================================
// Public types — re-exportados desde lib/schemas/pregunta-batch para mantener
// el API histórico que consumen los componentes y el fixture.
// =============================================================================

export type { TipoPregunta, Pregunta, PreguntaBatch };

// =============================================================================
// Primer batch (bootstrap real, no fixture)
// =============================================================================
// Sonnet emite los batches subsecuentes vía /api/turn, pero el primer turn
// necesita arrancar de algún lado: la sesión se abre sin historial y Sonnet
// solo emite tras leer una respuesta del usuario. Este batch hardcoded es la
// pregunta de apertura: identidad institucional. Cubre las 5 cajas del grupo
// `identificacion` (CANON), que son las primeras en orden canónico spec §4.3.
//
// NO es un fixture mock — es contenido de producto. Cuando el usuario responde,
// Sonnet recibe la respuesta + el system prompt completo y arranca el flujo
// adaptativo normal (registrar_extraccion → generar_batch_preguntas).
export const PRIMER_BATCH_BIENVENIDA: PreguntaBatch = {
  id: 'bienvenida-001',
  preguntas: [
    {
      id: 'bienvenida-p-1',
      texto_pregunta:
        'Para arrancar, cuéntanos sobre tu institución: razón social, nombre comercial si lo manejan, qué tipo son (banco, sofom, sofipo, arrendadora, etc.), bajo qué entes están regulados (CNBV, CONDUSEF, UIF), y cuántos años llevan operando.',
      cajas_objetivo: [
        'id_razon_social',
        'id_nombre_comercial',
        'id_tipo_institucion',
        'id_regulacion',
        'id_anios_operacion',
      ],
      tipo: 'directa',
    },
  ],
};

export type EntrevistaStatus =
  | 'cargando'
  | 'esperando_batch'
  | 'mostrando_batch'
  | 'enviando'
  | 'procesando'
  | 'cerrada'
  | 'error_turn';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface CajasGrupoCount {
  llenas: number;
  total: number;
}

interface EntrevistaState {
  sesion_id: string;
  status: EntrevistaStatus;
  batch_actual: PreguntaBatch | null;
  respuestas_pendientes: Record<string, string>; // preguntaId → texto
  marcadas_respondidas: Record<string, boolean>; // preguntaId → boolean
  cajas_llenas_por_grupo: Record<GrupoUI, CajasGrupoCount>;
  // Per-pregunta autosave UI state (status text in the card footer).
  autosave_estado: Record<string, AutosaveStatus>;
  // Last turn error message (when status='error_turn'). Cleared on next attempt.
  ultimo_error_turn: string | null;
  // Mensaje informativo NO-error sobre el estado del turn loop. Ejemplos:
  // cierre limpio de sección, sesión lista para síntesis, profundización
  // solicitada por Opus. Se renderiza como banner forest (verde), no amber.
  // Distinto de ultimo_error_turn: no implica fallo, solo transición.
  mensaje_estado: string | null;
  // Preview mode: skip server-side calls (autosave + /api/turn). UI-only sandbox
  // para iterar diseño sin tocar DB ni esperar Sonnet.
  preview_mode: boolean;

  // Actions
  init: (
    sesion_id: string,
    totalsPorGrupo: Record<GrupoUI, number>,
    options?: {
      preview?: boolean;
      /**
       * Payload de rehidratación al reload: batch que Sonnet ya había emitido +
       * snapshot de cajas llenas + drafts de respuestas. Si está presente,
       * `cargarPrimerBatch` NO se llama desde el shell — el batch ya está aquí.
       */
      rehidratacion?: {
        batch: PreguntaBatch;
        llenas_por_grupo: Record<GrupoUI, number>;
        drafts?: Record<string, string>;
      };
    }
  ) => void;
  setRespuesta: (preguntaId: string, texto: string) => void;
  marcarRespondida: (preguntaId: string, marcada: boolean) => void;
  enviarBatch: () => Promise<void>;
  cargarPrimerBatch: () => void;
  cargarFixtureMock: () => void;
}

// =============================================================================
// Internals — debounce timers live OUTSIDE the store so Zustand state stays
// JSON-serializable. Timer ids are keyed by `${sesion_id}::${pregunta_id}` to
// avoid collisions if two sessions ever coexist (e.g. tab restore edge cases).
// =============================================================================

const AUTOSAVE_DEBOUNCE_MS = 1_500;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debounceKey(sesion_id: string, pregunta_id: string): string {
  return `${sesion_id}::${pregunta_id}`;
}

function emptyGrupoCounts(): Record<GrupoUI, CajasGrupoCount> {
  const out = {} as Record<GrupoUI, CajasGrupoCount>;
  for (const g of GrupoUISchema.options) {
    out[g] = { llenas: 0, total: 0 };
  }
  return out;
}

// Compose the user message Sonnet sees from the batch the user just answered.
// Includes the question text so Sonnet has context for what was asked, since
// /api/turn doesn't reload conversation history (each call is a fresh stream;
// state lives in `turnos` table, but Sonnet only gets the current message).
// TODO when we add multi-turn memory: emitir la conversación previa via
// `messages` array en /api/turn en lugar de un único string.
function composeMensajeUsuario(
  batch: PreguntaBatch,
  respuestas: Record<string, string>
): string {
  const lineas = batch.preguntas.map((p, i) => {
    const respuesta = (respuestas[p.id] ?? '').trim() || '(sin respuesta)';
    return `${i + 1}. ${p.texto_pregunta}\n${respuesta}`;
  });
  return lineas.join('\n\n');
}

// Tool output shapes returned by /api/turn. Mirror del execute() del route — si
// cambia el shape allá, se rompe el parse acá. Mantener sincronizado en server
// (`app/api/turn/route.ts`) y aquí.
interface GenerarBatchPreguntasOutput {
  ok: boolean;
  batch_id: string;
  preguntas: Array<{ texto: string; cajas_objetivo: string[] }>;
  longitud_batch: 2 | 3 | 4;
}

interface RegistrarExtraccionOutput {
  ok: boolean;
  persisted?: number;
  supersedidos?: number;
  mapa_summary?: {
    llenas_por_grupo: Record<GrupoUI, number>;
    criticas_pct: number;
    blandas_pct: number;
    top_a_atacar: string[];
  };
}

// Mirror del shape que devuelve `solicitar_review_seccion.execute` en
// `app/api/turn/route.ts`. Dos variantes:
//   - OK: ProcessReviewResult del motor (estado terminal del review).
//   - Error: opus_director_prompt_not_ready hasta que step 5.iv firme.
// Si cambia el shape allá, sincronizar acá.
interface SolicitarReviewSeccionOutputOk {
  estado:
    | 'profundizar_pendiente'
    | 'grupo_cerrado'
    | 'sesion_lista_para_sintesis'
    | 'caso_solicitado';
  review_id: string;
  guidance_para_sonnet?: string;
  cajas_a_reabordar?: string[];
  siguiente_grupo_ui?: GrupoUI;
  cajas_objetivo_caso?: string[];
  hipotesis_a_clausurar?: string;
  urgencia_caso?: 'alta' | 'media';
}

interface SolicitarReviewSeccionOutputError {
  error: string;
  message: string;
}

type SolicitarReviewSeccionOutput =
  | SolicitarReviewSeccionOutputOk
  | SolicitarReviewSeccionOutputError;

function isReviewOk(
  out: SolicitarReviewSeccionOutput
): out is SolicitarReviewSeccionOutputOk {
  return 'estado' in out;
}

function getToolPart(
  part: UIMessage['parts'][number],
  toolName: string
): { state: string; output?: unknown } | null {
  if (typeof (part as { type?: string }).type !== 'string') return null;
  if ((part as { type: string }).type !== `tool-${toolName}`) return null;
  return part as unknown as { state: string; output?: unknown };
}

function extractBatchFromUIMessage(message: UIMessage): PreguntaBatch | null {
  for (const part of message.parts) {
    const p = getToolPart(part, 'generar_batch_preguntas');
    if (!p || p.state !== 'output-available') continue;
    const out = p.output as GenerarBatchPreguntasOutput | undefined;
    if (!out || !Array.isArray(out.preguntas)) continue;
    return {
      id: out.batch_id,
      preguntas: out.preguntas.map((q, i) => ({
        id: `${out.batch_id}-q${i}`,
        texto_pregunta: q.texto,
        cajas_objetivo: q.cajas_objetivo,
        tipo: 'directa',
      })),
    };
  }
  return null;
}

// Devuelve el snapshot más reciente de llenas_por_grupo del último tool-output
// `registrar_extraccion` con mapa_summary presente. Sonnet puede llamar la tool
// múltiples veces por turno; nos quedamos con el último snapshot porque es el
// más actualizado (cada llamada hace SELECT global de extracciones activas).
function extractLlenasPorGrupoFromUIMessage(
  message: UIMessage
): Record<GrupoUI, number> | null {
  let last: Record<GrupoUI, number> | null = null;
  for (const part of message.parts) {
    const p = getToolPart(part, 'registrar_extraccion');
    if (!p || p.state !== 'output-available') continue;
    const out = p.output as RegistrarExtraccionOutput | undefined;
    if (!out?.mapa_summary?.llenas_por_grupo) continue;
    last = out.mapa_summary.llenas_por_grupo;
  }
  return last;
}

// Extrae el último tool-output de `solicitar_review_seccion`. Sonnet sólo
// debería emitirlo una vez por turno (cierre de grupo), pero por simetría con
// los otros extractores nos quedamos con el último.
function extractReviewSeccionFromUIMessage(
  message: UIMessage
): SolicitarReviewSeccionOutput | null {
  let last: SolicitarReviewSeccionOutput | null = null;
  for (const part of message.parts) {
    const p = getToolPart(part, 'solicitar_review_seccion');
    if (!p || p.state !== 'output-available') continue;
    const out = p.output as SolicitarReviewSeccionOutput | undefined;
    if (!out) continue;
    last = out;
  }
  return last;
}

// Render del review state como mensaje al usuario. Mensajes en es-MX, sin
// cajas individuales (privacidad — el panel agrupa por sección).
function describeReviewState(out: SolicitarReviewSeccionOutputOk): string {
  switch (out.estado) {
    case 'sesion_lista_para_sintesis':
      return '¡Entrevista completada! Estamos generando la síntesis del perfil. Recibirás el resultado por correo cuando esté listo.';
    case 'grupo_cerrado':
      return out.siguiente_grupo_ui
        ? `Sección cerrada. Continuamos con la siguiente sección en breve.`
        : 'Sección cerrada. Esperando la siguiente.';
    case 'profundizar_pendiente':
      return 'El director pidió profundizar en algunos puntos antes de avanzar. La siguiente pregunta llegará en breve.';
    case 'caso_solicitado':
      return 'El director está generando un caso hipotético para destrabar una caja. Tomará unos segundos.';
  }
}

// =============================================================================
// Store
// =============================================================================

export const useEntrevistaStore = create<EntrevistaState>((set, get) => ({
  sesion_id: '',
  status: 'cargando',
  batch_actual: null,
  respuestas_pendientes: {},
  marcadas_respondidas: {},
  cajas_llenas_por_grupo: emptyGrupoCounts(),
  autosave_estado: {},
  ultimo_error_turn: null,
  mensaje_estado: null,
  preview_mode: false,

  init: (sesion_id, totalsPorGrupo, options) => {
    const cajas_llenas_por_grupo = emptyGrupoCounts();
    for (const g of GrupoUISchema.options) {
      cajas_llenas_por_grupo[g] = { llenas: 0, total: totalsPorGrupo[g] ?? 0 };
    }

    // Rehidratación: si server-side encontró un ultimo_batch fresco en
    // metadata, seedeamos batch_actual + contador llenas + drafts en el mismo
    // init para que la primera pintura del shell ya tenga el estado real
    // (sin parpadeo "Cargando preguntas…" → batch correcto).
    const rh = options?.rehidratacion;
    if (rh) {
      for (const g of GrupoUISchema.options) {
        cajas_llenas_por_grupo[g] = {
          total: totalsPorGrupo[g] ?? 0,
          llenas: rh.llenas_por_grupo[g] ?? 0,
        };
      }
      // Solo restauramos drafts cuya pregunta esté en el batch rehidratado —
      // evita arrastrar drafts huérfanos de batches anteriores.
      const idsBatch = new Set(rh.batch.preguntas.map((p) => p.id));
      const drafts: Record<string, string> = {};
      if (rh.drafts) {
        for (const [pid, texto] of Object.entries(rh.drafts)) {
          if (idsBatch.has(pid)) drafts[pid] = texto;
        }
      }
      // Estado autosave: las preguntas con draft persistido ya están "saved"
      // (vinieron de DB). El resto queda en idle.
      const autosave_estado: Record<string, AutosaveStatus> = {};
      for (const pid of Object.keys(drafts)) autosave_estado[pid] = 'saved';

      set({
        sesion_id,
        cajas_llenas_por_grupo,
        status: 'mostrando_batch',
        batch_actual: rh.batch,
        respuestas_pendientes: drafts,
        autosave_estado,
        marcadas_respondidas: {},
        preview_mode: options?.preview === true,
      });
      return;
    }

    set({
      sesion_id,
      cajas_llenas_por_grupo,
      status: 'esperando_batch',
      preview_mode: options?.preview === true,
    });
  },

  setRespuesta: (preguntaId, texto) => {
    set((s) => ({
      respuestas_pendientes: { ...s.respuestas_pendientes, [preguntaId]: texto },
      autosave_estado: {
        ...s.autosave_estado,
        // En preview saltamos pending/saving — directo a 'saved' para que el
        // chip indicator igual aparezca y el founder vea el estado visual.
        [preguntaId]: get().preview_mode ? 'saved' : 'pending',
      },
    }));

    if (get().preview_mode) return; // preview: no DB calls
    const sesion_id = get().sesion_id;
    if (!sesion_id) return; // not init'd yet — skip autosave

    const key = debounceKey(sesion_id, preguntaId);
    const prev = debounceTimers.get(key);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(async () => {
      debounceTimers.delete(key);
      set((s) => ({
        autosave_estado: { ...s.autosave_estado, [preguntaId]: 'saving' },
      }));
      try {
        const res = await guardarRespuestaPendiente({
          sesion_id,
          pregunta_id: preguntaId,
          texto,
        });
        set((s) => ({
          autosave_estado: {
            ...s.autosave_estado,
            [preguntaId]: res.ok ? 'saved' : 'error',
          },
        }));
      } catch (err) {
        // Server action threw (network, etc). Non-blocking — log + flag.
        // eslint-disable-next-line no-console
        console.warn('[entrevista] autosave throw:', err);
        set((s) => ({
          autosave_estado: { ...s.autosave_estado, [preguntaId]: 'error' },
        }));
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    debounceTimers.set(key, timer);
  },

  marcarRespondida: (preguntaId, marcada) => {
    set((s) => ({
      marcadas_respondidas: { ...s.marcadas_respondidas, [preguntaId]: marcada },
    }));
  },

  enviarBatch: async () => {
    const { batch_actual, respuestas_pendientes, marcadas_respondidas, sesion_id, preview_mode } = get();
    if (!batch_actual) return;
    const todasMarcadas = batch_actual.preguntas.every(
      (p) => marcadas_respondidas[p.id] === true
    );
    if (!todasMarcadas) return;

    // Preview: simulamos un turno completo localmente. Marcamos enviando 600ms,
    // procesando 1200ms, luego llega un "batch nuevo" rotando el fixture y
    // bumpeamos el contador de un grupo random para que el panel se mueva.
    if (preview_mode) {
      set({ status: 'enviando', ultimo_error_turn: null, mensaje_estado: null });
      await new Promise((r) => setTimeout(r, 500));
      set({ status: 'procesando' });
      await new Promise((r) => setTimeout(r, 800));
      // Nuevo batch fake: misma fixture pero con id distinto + agregamos
      // 1 caja "llena" en productos_y_mercado para que el panel se mueva.
      const stamp = Date.now().toString(36);
      const next: PreguntaBatch = {
        id: `mock-batch-${stamp}`,
        preguntas: FIXTURE_BATCH_MOCK.preguntas.map((p, i) => ({
          ...p,
          id: `${stamp}-q${i}`,
        })),
      };
      set((s) => {
        const grupo: GrupoUI = 'productos_y_mercado';
        const prev = s.cajas_llenas_por_grupo[grupo];
        const llenasNew = Math.min(prev.total, prev.llenas + 1);
        return {
          status: 'mostrando_batch',
          batch_actual: next,
          respuestas_pendientes: {},
          marcadas_respondidas: {},
          autosave_estado: {},
          cajas_llenas_por_grupo: {
            ...s.cajas_llenas_por_grupo,
            [grupo]: { llenas: llenasNew, total: prev.total },
          },
        };
      });
      return;
    }

    const mensaje_usuario = composeMensajeUsuario(batch_actual, respuestas_pendientes);

    set({ status: 'enviando', ultimo_error_turn: null, mensaje_estado: null });

    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id, mensaje_usuario }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          res.status === 503
            ? 'El motor todavía no está habilitado (system prompt pendiente).'
            : res.status === 403
            ? 'Tu sesión necesita consentimiento.'
            : res.status === 409
            ? 'Tu sesión no está abierta — recarga la página.'
            : `Error ${res.status}: ${body.message ?? body.error ?? 'desconocido'}`;
        set({ status: 'error_turn', ultimo_error_turn: msg });
        return;
      }
      if (!res.body) {
        set({ status: 'error_turn', ultimo_error_turn: 'Respuesta sin cuerpo.' });
        return;
      }

      // Transición a 'procesando' apenas empieza a llegar stream — la UI puede
      // mostrar un indicador distinto al spinner inicial de 'enviando'.
      set({ status: 'procesando' });

      // Consumir UI message stream. Capturamos el último mensaje (la API
      // devuelve la MISMA UIMessage creciendo en parts) para extraer
      // tool-outputs después del cierre del stream.
      let nuevoBatch: PreguntaBatch | null = null;
      let streamError: string | null = null;
      let lastMessage: UIMessage | null = null;
      // Pipeline SSE bytes → UIMessageChunk objetos. Extraído a helper para
      // testeabilidad + regression guard contra bug F2 (doc
      // bugs-encontrados-2026-05-11-e2e §F2: pasar res.body raw crasheaba con
      // "Cannot read properties of undefined (reading 'startsWith')").
      const chunkStream = sseBytesToUIChunks(res.body);
      try {
        for await (const message of readUIMessageStream({
          stream: chunkStream,
          onError: (e) => {
            streamError = e instanceof Error ? e.message : String(e);
          },
          terminateOnError: true,
        })) {
          lastMessage = message;
          const candidato = extractBatchFromUIMessage(message);
          if (candidato) {
            nuevoBatch = candidato;
            // No break: dejamos que el stream termine para que el server
            // ejecute onFinish y persista el turno agente final. Si el batch
            // ya está, podemos seguir actualizando UI con el texto que llegue.
          }

          // Snapshot panel live: si Sonnet llamó registrar_extraccion en este
          // turno, actualizamos el contador llenas/grupo. Reemplazamos en
          // lugar de mergear porque el server siempre devuelve el snapshot
          // global (no diff).
          const llenasUpdate = extractLlenasPorGrupoFromUIMessage(message);
          if (llenasUpdate) {
            set((s) => {
              const next = { ...s.cajas_llenas_por_grupo };
              for (const g of GrupoUISchema.options) {
                next[g] = {
                  total: s.cajas_llenas_por_grupo[g].total,
                  llenas: llenasUpdate[g] ?? 0,
                };
              }
              return { cajas_llenas_por_grupo: next };
            });
          }
        }
      } catch (streamErr) {
        // readUIMessageStream con terminateOnError throws cuando hay error
        // event en el stream. Capturamos para preservar respuestas del
        // usuario (ver bloque catch outer no-clear).
        streamError =
          streamError ??
          (streamErr instanceof Error ? streamErr.message : String(streamErr));
      }

      // Extracción del review tool — puede coexistir con batch (Opus avanza y
      // Sonnet emite batch del siguiente grupo en mismo turno) o aparecer solo
      // (cierre limpio de sesión, profundización pendiente, caso solicitado).
      const reviewOut = lastMessage
        ? extractReviewSeccionFromUIMessage(lastMessage)
        : null;

      // Caso terminal: sesión lista para síntesis. Tiene prioridad sobre todo
      // — incluso si llegó batch nuevo (improbable), el motor decidió cerrar.
      if (reviewOut && isReviewOk(reviewOut) && reviewOut.estado === 'sesion_lista_para_sintesis') {
        set({
          status: 'cerrada',
          batch_actual: null,
          respuestas_pendientes: {},
          marcadas_respondidas: {},
          autosave_estado: {},
          ultimo_error_turn: null,
          mensaje_estado: describeReviewState(reviewOut),
        });
        return;
      }

      if (nuevoBatch) {
        // Batch normal. Si además llegó review (cierre de grupo + nueva
        // sección abierta en mismo turno), surface el mensaje informativo.
        const mensaje =
          reviewOut && isReviewOk(reviewOut) && reviewOut.estado === 'grupo_cerrado'
            ? describeReviewState(reviewOut)
            : null;
        set({
          status: 'mostrando_batch',
          batch_actual: nuevoBatch,
          respuestas_pendientes: {},
          marcadas_respondidas: {},
          autosave_estado: {},
          mensaje_estado: mensaje,
        });
      } else if (streamError) {
        // Stream falló mid-flight. NO limpiamos respuestas — founder puede
        // re-disparar "Enviar turno" sin retipear. El borrador en DB también
        // se conserva (autosave 1.5s ya persistió).
        set({
          status: 'error_turn',
          ultimo_error_turn: `El motor falló al generar la siguiente pregunta: ${streamError}`,
        });
      } else if (reviewOut && !isReviewOk(reviewOut)) {
        // Opus director aún no habilitado — feature flag cerrada hasta sub-paso 5.iv.
        set({
          status: 'error_turn',
          ultimo_error_turn:
            'El director (Opus) todavía no está disponible. El equipo está cerrando el último prompt; reintenta en unos minutos.',
        });
      } else if (reviewOut && isReviewOk(reviewOut)) {
        // Review fired sin batch — estado transicional. La continuación
        // automática del turn loop es trabajo paralelo; por ahora surface el
        // estado al usuario y mantenemos respuestas para reintento manual.
        set({
          status: 'error_turn',
          ultimo_error_turn: describeReviewState(reviewOut),
        });
      } else {
        // Stream terminó limpio sin batch ni review tool. Casos:
        //   - Sonnet sólo extrajo cajas y se detuvo (bug del prompt).
        //   - Modelo rechazó la conversación. Investigar logs Axiom.
        // Tampoco limpiamos respuestas: founder decide qué hacer.
        set({
          status: 'error_turn',
          ultimo_error_turn:
            'El motor terminó el turno sin pedir review ni generar siguiente batch. Revisa logs y reintenta.',
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[entrevista] enviarBatch failed:', err);
      const msg = err instanceof Error ? err.message : 'Error de red.';
      set({ status: 'error_turn', ultimo_error_turn: msg });
    }
  },

  cargarPrimerBatch: () => {
    // Idempotente: si ya hay batch (por ejemplo recarga tras turn), no piso.
    if (get().batch_actual) return;
    set({
      batch_actual: PRIMER_BATCH_BIENVENIDA,
      status: 'mostrando_batch',
    });
  },

  cargarFixtureMock: () => {
    set({
      batch_actual: FIXTURE_BATCH_MOCK,
      status: 'mostrando_batch',
    });
  },
}));
