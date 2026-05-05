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
import { readUIMessageStream, type UIMessage } from 'ai';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import { guardarRespuestaPendiente } from '@/app/actions/respuestas';
import { FIXTURE_BATCH_MOCK } from './fixture-batch-mock';

// =============================================================================
// Public types — exported for components and the fixture file
// =============================================================================

export type TipoPregunta = 'directa' | 'caso_sintetico_solicitado';

export interface Pregunta {
  id: string;
  texto_pregunta: string;
  cajas_objetivo: string[];
  tipo: TipoPregunta;
}

export interface PreguntaBatch {
  id: string;
  preguntas: Pregunta[];
}

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
  // Preview mode: skip server-side calls (autosave + /api/turn). UI-only sandbox
  // para iterar diseño sin tocar DB ni esperar Sonnet.
  preview_mode: boolean;

  // Actions
  init: (
    sesion_id: string,
    totalsPorGrupo: Record<GrupoUI, number>,
    options?: { preview?: boolean }
  ) => void;
  setRespuesta: (preguntaId: string, texto: string) => void;
  marcarRespondida: (preguntaId: string, marcada: boolean) => void;
  enviarBatch: () => Promise<void>;
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
  preview_mode: false,

  init: (sesion_id, totalsPorGrupo, options) => {
    const cajas_llenas_por_grupo = emptyGrupoCounts();
    for (const g of GrupoUISchema.options) {
      cajas_llenas_por_grupo[g] = { llenas: 0, total: totalsPorGrupo[g] ?? 0 };
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
      set({ status: 'enviando', ultimo_error_turn: null });
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

    set({ status: 'enviando', ultimo_error_turn: null });

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

      // Consumir UI message stream y buscar el tool-output de
      // generar_batch_preguntas. La iteración devuelve la MISMA UIMessage
      // creciendo en parts; basta con revisar las partes en cada yield.
      let nuevoBatch: PreguntaBatch | null = null;
      let streamError: string | null = null;
      try {
        for await (const message of readUIMessageStream({
          // The fetch body is a ReadableStream<Uint8Array>;
          // readUIMessageStream espera un ReadableStream<UIMessageChunk>. La
          // conversión la hace el helper internamente parseando el SSE/JSONL
          // del UI message stream.
          stream: res.body as unknown as ReadableStream<never>,
          onError: (e) => {
            streamError = e instanceof Error ? e.message : String(e);
          },
          terminateOnError: true,
        })) {
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

      if (nuevoBatch) {
        set({
          status: 'mostrando_batch',
          batch_actual: nuevoBatch,
          respuestas_pendientes: {},
          marcadas_respondidas: {},
          autosave_estado: {},
        });
      } else if (streamError) {
        // Stream falló mid-flight. NO limpiamos respuestas — founder puede
        // re-disparar "Enviar turno" sin retipear. El borrador en DB también
        // se conserva (autosave 1.5s ya persistió).
        set({
          status: 'error_turn',
          ultimo_error_turn: `El motor falló al generar la siguiente pregunta: ${streamError}`,
        });
      } else {
        // Stream terminó limpio pero sin batch nuevo. Casos:
        //   - Sonnet llamó solicitar_review_seccion (cierre de grupo) sin
        //     emitir batch — pendiente de cablear esa transición.
        //   - Sonnet sólo extrajo cajas y se detuvo (bug del prompt).
        // Tampoco limpiamos respuestas: founder decide qué hacer.
        set({
          status: 'error_turn',
          ultimo_error_turn:
            'El motor terminó el turno sin generar un siguiente batch (puede que sea cierre de sección — feature pendiente).',
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[entrevista] enviarBatch failed:', err);
      const msg = err instanceof Error ? err.message : 'Error de red.';
      set({ status: 'error_turn', ultimo_error_turn: msg });
    }
  },

  cargarFixtureMock: () => {
    set({
      batch_actual: FIXTURE_BATCH_MOCK,
      status: 'mostrando_batch',
    });
  },
}));
