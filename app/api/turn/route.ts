// POST /api/turn — entrypoint del turn loop con Sonnet 4.6 (Phase 5 step iii).
//
// Cliente envía { sesion_id, mensaje_usuario }. El handler:
//   1. Verifica gates (PROMPT_READY, sesión válida, consentimiento).
//   2. Stream Sonnet con SONNET_FASE1_TOOLS via Vercel AI SDK v6.
//   3. Cada tool_use de Sonnet se despacha al handler correspondiente:
//      - registrar_extraccion → persiste a `extracciones` (TODO step posterior)
//      - generar_batch_preguntas → adjunta al stream para el cliente (TODO)
//      - solicitar_caso_sintetico → invoca pipeline de generación (TODO)
//      - solicitar_review_seccion → llama lib/motor/review.ts:processSolicitarReview
//   4. Retorna stream UI message al cliente.
//
// SCOPE step iii:
//   - solicitar_review_seccion está completamente wirada al motor.
//   - Los otros 3 tools tienen execute stub con TODO; los completa step posterior
//     dentro de Phase 5 (no este step). Cuando llegue la implementación, sustituir
//     el stub por la lógica concreta — la signature de cada tool ya queda fijada.
//   - El stream Sonnet está gated por SONNET_FASE1_PROMPT_READY: si false,
//     responde 503. Eso evita ejecutar Sonnet con un system_prompt sin el bloque
//     <formato_valores_por_caja> (paralelo step iv founder).
//
// Patrón Server Action vs Route Handler: esta es Route Handler porque el turn
// loop hace streaming LLM con duración variable. Server Actions de mutaciones
// simples (auth, crear sesión) siguen en `app/actions/*.ts` (memoria
// feedback_use_server_only_async).

import { NextResponse } from 'next/server';
import { streamText, tool, stepCountIs, APICallError } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import type { PreguntaBatch } from '@/lib/schemas/pregunta-batch';
import {
  RegistrarExtraccionInputSchema,
  GenerarBatchPreguntasInputSchema,
  SolicitarCasoSinteticoInputSchema,
} from '@/lib/motor/tools';
import { SolicitarReviewSeccionInputSchema } from '@/lib/schemas/review_seccion';
import { processSolicitarReview, OpusReviewPromptNotReady } from '@/lib/motor/review';
import { canCloseSeccion } from '@/lib/motor/review-gate';
import {
  persistirTurnoUsuario,
  persistirTurnoAgente,
  actualizarContenidoTurnoAgente,
  persistirExtraccionesBatch,
  listarExtraccionesActivas,
  listarCajasDeclinadas,
  ExtraccionInvalidaError,
  type ExtraccionInput,
} from '@/lib/motor/persistence';
import { valorSchemaFor } from '@/lib/schemas/extracciones';
import { getCajasAplicables } from '@/lib/schemas/cajas';
import { computeMapaIncertidumbre, computeLlenasPorGrupo } from '@/lib/motor/mapa';
import {
  SONNET_FASE1_SYSTEM_PROMPT,
  SONNET_FASE1_PROMPT_READY,
} from '@/lib/prompts/sonnet_fase1';
import { logger } from '@/lib/observability/axiom';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from '@/lib/security/rate-limit';
import { checkSameOrigin } from '@/lib/security/csrf';

// =============================================================================
// Request schema
// =============================================================================

// Bound superior en `mensaje_usuario` para evitar DoS por payload gigante.
// 20000 chars cubre dictados largos vía STT (~10-12 min de habla continua a
// 150wpm = ~7500-9000 chars; hard cap del recorder STT es 30min = ~22500 chars
// pero esos casos extremos esperamos sean raros). 20K da margen razonable
// sin abrir la puerta a payloads abusivos. Antes de Anthropic, el handler
// rechaza 400 si el body excede — protege RAM y evita buffer enorme en
// streamText del AI SDK.
const MENSAJE_USUARIO_MAX = 20_000;

const TurnRequestSchema = z.object({
  sesion_id: z.string().uuid(),
  mensaje_usuario: z.string().min(1).max(MENSAJE_USUARIO_MAX),
});

// =============================================================================
// Helpers
// =============================================================================

// Reformatea errores que llegan al cliente vía el UI message stream. El AI SDK
// por default envía un mensaje opaco que rompe el parser cliente
// ("Cannot read properties of undefined (reading 'startsWith')"). Aquí
// extraemos statusCode + cause cuando el error viene de Anthropic, así el
// cliente ve "401 Unauthorized — Invalid API key" en vez de un mensaje
// críptico. Server-side ya logueamos el cause completo en el `onError` de
// streamText (este helper sólo decide qué exponer al usuario).
function formatStreamError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    const { statusCode, message } = err;
    if (statusCode === 401) {
      return 'Anthropic rechazó la solicitud (401). El ANTHROPIC_API_KEY está vacío o es inválido.';
    }
    if (statusCode === 429) {
      return 'Anthropic devolvió rate limit (429). Espera unos segundos y reintenta.';
    }
    if (statusCode && statusCode >= 500) {
      return `Anthropic está caído (${statusCode}). ${message}`;
    }
    return `Anthropic falló${statusCode ? ` (${statusCode})` : ''}: ${message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

// =============================================================================
// POST handler
// =============================================================================

export async function POST(req: Request) {
  // 1. CSRF gate: same-origin check antes de cualquier trabajo. Defensa en
  //    profundidad sobre `SameSite=lax` del cookie. Cero costo si pasa.
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    logger.warn('turn.csrf_rechazado', { error: csrf.error });
    return NextResponse.json(
      { error: 'forbidden_origin', message: csrf.error },
      { status: 403 }
    );
  }

  // 2. Rate limit per-IP (catch-all). 100 reqs/min/IP cubre uso normal con
  //    margen para retries; bloqueo previene abuse cross-sesión sin requerir
  //    la sesion_id (todavía no parseada). Devuelve 429 con Retry-After.
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`turn:ip:${ip}`, RATE_LIMITS.turnPerIp);
  if (!rlIp.allowed) {
    logger.warn('turn.rate_limit.ip', { ip, retry_after_s: rlIp.retryAfterSeconds });
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rlIp.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rlIp.retryAfterSeconds) } }
    );
  }

  // 3. Gate: prompt de Sonnet listo. Si false, no podemos invocar Fase 1.
  if (!SONNET_FASE1_PROMPT_READY) {
    return NextResponse.json(
      {
        error: 'sonnet_fase1_prompt_not_ready',
        message:
          'El bloque <formato_valores_por_caja> aún no está disponible. ' +
          'Step iv founder pendiente.',
      },
      { status: 503 }
    );
  }

  // 4. Parse request
  let parsed;
  try {
    const json = await req.json();
    parsed = TurnRequestSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }
  const { sesion_id, mensaje_usuario } = parsed;

  // 5. Rate limit per-sesion. Una sesión típica tiene ~30 turnos en 30-60
  //    min; 30/min cubre con bursts de retries pero detiene runaway loops
  //    del cliente.
  const rlSesion = checkRateLimit(`turn:sesion:${sesion_id}`, RATE_LIMITS.turnPerSesion);
  if (!rlSesion.allowed) {
    logger.warn('turn.rate_limit.sesion', {
      sesion_id,
      retry_after_s: rlSesion.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rlSesion.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rlSesion.retryAfterSeconds) } }
    );
  }

  // 3. Validar que la sesión existe y está abierta. JOIN con instituciones para
  //    leer el `tipo` — lo necesitamos en `registrar_extraccion.execute` para
  //    computar el mapa_incertidumbre con las cajas aplicables (CANON + EXTENSION[tipo]).
  const [sesion] = await db
    .select({
      status: sesiones.status,
      consentimiento_at: sesiones.consentimiento_at,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!sesion) {
    return NextResponse.json({ error: 'sesion_not_found' }, { status: 404 });
  }
  if (sesion.status !== 'abierta') {
    return NextResponse.json(
      { error: 'sesion_not_open', status: sesion.status },
      { status: 409 }
    );
  }
  if (!sesion.consentimiento_at) {
    return NextResponse.json(
      { error: 'consentimiento_pendiente' },
      { status: 403 }
    );
  }

  // Snapshot de cajas aplicables a esta institución — se queda fijo durante todo
  // el turn loop. Lo capturamos en el closure de `registrar_extraccion.execute`.
  const cajasAplicables = getCajasAplicables(sesion.tipo);

  // Guard O3: Sonnet puede emitir múltiples `generar_batch_preguntas` en un
  // mismo turno (con stopWhen=8). Solo el PRIMER batch se commitea + persiste;
  // los subsecuentes reciben tool_result error para que Sonnet entienda. Sin
  // esto, el cliente recibía batches en cascada y el store conservaba el
  // ÚLTIMO, perdiendo los intermedios. Doc: bugs-encontrados-2026-05-11-e2e §O3.
  // Closure mutable per-request — re-instanciado por POST, no compartido.
  let batchEmittedThisTurn = false;

  // 4. Persistir el turno usuario ANTES del stream. Las extracciones del
  //    siguiente turno agente lo necesitan para correlación pero se anclan al
  //    turno_id del agente (no al usuario). Aún así persistir el usuario aquí
  //    fija el orden cronológico: numero_turno usuario < numero_turno agente.
  const turnoUsuario = await persistirTurnoUsuario({
    sesion_id,
    contenido_texto: mensaje_usuario,
    fuente: 'usuario_tipea', // TODO Fase 6 voz: discriminar según source request
  });

  // 5. Persistir el turno agente como placeholder (contenido_texto='') ANTES
  //    del stream. Estrategia "placeholder al inicio + UPDATE al final"
  //    (alineada con cómo Inngest workflows manejan turnos parciales):
  //    - Las extracciones del primer tool_use se anclan a este turno_id sin
  //      tener que bufferearlas en memoria por toda la duración del stream.
  //    - Si el stream crashea mid-flight, el turno queda con contenido vacío
  //      pero las extracciones ya persistidas conservan trazabilidad.
  //    Alternativa rechazada: persistir el turno agente al final y bufferear
  //    extracciones en memoria — más limpio pero pierde extracciones si crashea
  //    mid-stream.
  const turnoAgenteStreamStartedAt = Date.now();
  const turnoAgente = await persistirTurnoAgente({
    sesion_id,
    contenido_texto: '',
    fuente: 'sonnet_genera',
    modelo_llm: 'claude-sonnet-4-6',
  });

  logger.info('turn.persistido_pre_stream', {
    sesion_id,
    turno_usuario_id: turnoUsuario.turno_id,
    turno_usuario_numero: turnoUsuario.numero_turno,
    turno_agente_id: turnoAgente.turno_id,
    turno_agente_numero: turnoAgente.numero_turno,
  });

  // 6. Stream Sonnet con tools. Cada tool tiene execute que dispatcha al motor.
  //    Sólo solicitar_review_seccion está wirada en step iii; los otros 3 son
  //    stubs hasta step posterior. Las inputSchema vienen del Zod source-of-truth.
  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    messages: [
      {
        role: 'system',
        content: SONNET_FASE1_SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
      { role: 'user', content: mensaje_usuario },
    ],
    tools: {
      registrar_extraccion: tool({
        description: 'Registra extracciones de cajas con supersede chain.',
        inputSchema: RegistrarExtraccionInputSchema,
        execute: async (input) => {
          logger.info('tool.registrar_extraccion.recibido', {
            sesion_id,
            n_extracciones: input.extracciones.length,
          });

          // Estrategia partial-on-failure: prefiltrar con `valorSchemaFor` para
          // separar válidas vs. inválidas, luego llamar a
          // persistirExtraccionesBatch SOLO con las válidas. Eso evita que un
          // único error de shape rollbackee todo el batch (mejor parcial que
          // nada para el modelo). Las inválidas se devuelven al modelo para
          // que sepa cuáles cerraron y cuáles tiene que reintentar.
          const validas: ExtraccionInput[] = [];
          // Track de `contradice_extraccion_previa` paralelo a `validas` (mismo
          // índice). Sonnet marca este flag cuando cree que está corrigiendo
          // una extracción previa; si NO existe previa para esa caja, es un
          // hint inválido que conviene loguear para auditoría del prompt.
          const contradiceFlags: boolean[] = [];
          const errores: Array<{
            indice: number;
            caja_codigo: string;
            error: string;
          }> = [];

          for (let i = 0; i < input.extracciones.length; i++) {
            const e = input.extracciones[i];
            const subSchema = valorSchemaFor(e.caja_codigo);
            const parsed = subSchema.safeParse(e.valor);
            if (!parsed.success) {
              errores.push({
                indice: i,
                caja_codigo: e.caja_codigo,
                error: parsed.error.message,
              });
              continue;
            }
            validas.push({
              caja_codigo: e.caja_codigo,
              valor: e.valor,
              confianza: e.confianza,
              evidencia_textual: e.evidencia_textual,
            });
            contradiceFlags.push(e.contradice_extraccion_previa === true);
          }

          if (validas.length === 0) {
            return {
              ok: false,
              persisted: 0,
              supersedidos: 0,
              errores,
            };
          }

          try {
            const persistidas = await persistirExtraccionesBatch({
              sesion_id,
              turno_id: turnoAgente.turno_id,
              extracciones: validas,
            });
            const supersedidos = persistidas.filter(
              (p) => p.supersedido_id !== undefined
            ).length;

            // Auditoría del prompt: Sonnet marcó `contradice_extraccion_previa=true`
            // pero no había extracción previa (supersedido_id undefined). Hint
            // inválido — útil para detectar drift del prompt sin bloquear el
            // turno. Emite warn-level por caja afectada.
            for (let i = 0; i < persistidas.length; i++) {
              if (contradiceFlags[i] && persistidas[i].supersedido_id === undefined) {
                logger.extraccion.contradiceSinPrevia({
                  sesion_id,
                  caja_codigo: validas[i].caja_codigo,
                });
              }
            }

            // Snapshot del mapa para alimentar el panel UI live. El cliente
            // lee `mapa_summary.llenas_por_grupo` y reemplaza su contador por
            // grupo. NO se usa para que Sonnet decida (eso lo hace el loop
            // interno con el snapshot post-stream); solo es UI feedback.
            let mapa_summary;
            try {
              const [activas, declinadas] = await Promise.all([
                listarExtraccionesActivas(sesion_id),
                listarCajasDeclinadas(sesion_id),
              ]);
              const mapa = computeMapaIncertidumbre(activas, cajasAplicables, declinadas);
              const llenas_por_grupo = computeLlenasPorGrupo(mapa.cajas);
              mapa_summary = {
                llenas_por_grupo,
                criticas_pct: mapa.cajas_criticas_pct,
                blandas_pct: mapa.cajas_blandas_pct,
                top_a_atacar: mapa.top_cajas_a_atacar,
              };
            } catch (snapErr) {
              // No-fail: snapshot UI es best-effort. Si falla, devolvemos sin
              // él y el cliente solo no actualizará el panel ese turno.
              logger.warn('tool.registrar_extraccion.snapshot_fallido', {
                sesion_id,
                error: snapErr instanceof Error ? snapErr.message : String(snapErr),
              });
            }

            return {
              ok: true,
              persisted: persistidas.length,
              supersedidos,
              errores,
              mapa_summary,
            };
          } catch (err) {
            // Defensa en profundidad: si llegáramos a tener una validación que
            // pasó el prefiltro pero falla dentro del batch (e.g. extension
            // caja con rules adicionales), reportamos el error al modelo.
            if (err instanceof ExtraccionInvalidaError) {
              return {
                ok: false,
                persisted: 0,
                supersedidos: 0,
                errores: [
                  {
                    indice: err.indice,
                    caja_codigo: err.caja_codigo,
                    error: err.message,
                  },
                ],
              };
            }
            throw err;
          }
        },
      }),
      generar_batch_preguntas: tool({
        description: 'Genera el siguiente batch de 2-4 preguntas. El output se propaga al cliente vía el tool-result chunk del UI message stream.',
        inputSchema: GenerarBatchPreguntasInputSchema,
        execute: async (input) => {
          // Guard O3: solo 1 batch por turno. Subsecuentes invocaciones reciben
          // error que Sonnet lee como "ya emitiste batch, termina turno o usa
          // solicitar_review_seccion en su lugar". Sin mutación de state ni
          // persist a metadata.
          if (batchEmittedThisTurn) {
            logger.warn('tool.generar_batch_preguntas.rechazado_duplicado', {
              sesion_id,
              turno_agente_id: turnoAgente.turno_id,
            });
            return {
              ok: false,
              error: 'batch_already_emitted_this_turn',
              message:
                'Ya emitiste un batch en este turno. Solo se permite un generar_batch_preguntas por turno; ' +
                'el cliente recibió el primero. Termina el turno (devuelve texto breve) o usa solicitar_review_seccion ' +
                'si cumples las precondiciones del grupo activo.',
            };
          }
          batchEmittedThisTurn = true;

          logger.info('tool.generar_batch_preguntas.recibido', {
            sesion_id,
            longitud_batch: input.longitud_batch,
            cajas_objetivo_total: input.preguntas.flatMap((p) => p.cajas_objetivo),
          });
          const batch_id = `batch-${turnoAgente.turno_id}`;

          // Persistir el batch en sesiones.metadata.ultimo_batch para rehidratar
          // /entrevista al reload (bug O1, doc bugs-encontrados-2026-05-11-e2e §O1).
          // Espejo del shape que el cliente construye en
          // lib/state/entrevista.ts:extractBatchFromUIMessage — así
          // rehidratamos sin transformación adicional al cargar.
          const batchPersist: PreguntaBatch = {
            id: batch_id,
            preguntas: input.preguntas.map((q, i) => ({
              id: `${batch_id}-q${i}`,
              texto_pregunta: q.texto,
              ...(q.auxiliar ? { auxiliar: q.auxiliar } : {}),
              cajas_objetivo: q.cajas_objetivo,
              tipo: 'directa',
            })),
          };
          const ultimoBatchPayload = {
            batch: batchPersist,
            numero_turno_emitido: turnoAgente.numero_turno,
          };
          try {
            await db
              .update(sesiones)
              .set({
                metadata: sql`COALESCE(${sesiones.metadata}, '{}'::jsonb)
                  || jsonb_build_object('ultimo_batch', ${JSON.stringify(
                    ultimoBatchPayload
                  )}::jsonb)`,
              })
              .where(eq(sesiones.id, sesion_id));
          } catch (err) {
            // No-fail: la persistencia del batch es para UX de reload, no
            // afecta el turn actual. Loguear y seguir — el cliente recibe el
            // batch igualmente por el stream.
            logger.warn('tool.generar_batch_preguntas.persist_fallido', {
              sesion_id,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          // El batch se devuelve tal cual en el output. El cliente lee el
          // chunk `tool-output-available` con toolName='generar_batch_preguntas'
          // y mapea a PreguntaBatch (ver lib/state/entrevista.ts:enviarBatch).
          // batch_id se ancla al turno agente activo para correlación con DB.
          return {
            ok: true,
            batch_id,
            preguntas: input.preguntas,
            longitud_batch: input.longitud_batch,
          };
        },
      }),
      solicitar_caso_sintetico: tool({
        description: 'Solicita caso sintético. TODO step posterior dispara generación con Opus.',
        inputSchema: SolicitarCasoSinteticoInputSchema,
        execute: async (input) => {
          logger.info('tool.solicitar_caso_sintetico.recibido', {
            sesion_id,
            cajas_objetivo: input.cajas_objetivo,
            urgencia: input.urgencia,
          });
          // TODO step posterior: invocar el pipeline de generación de casos
          // (existing scaffolding en lib/motor o nuevo). Por ahora ack.
          return { ok: true, todo_step_posterior: true };
        },
      }),
      solicitar_review_seccion: tool({
        description:
          'Solicita review del director Opus sobre la sección actual. Flujo completo wirado en step iii — ver lib/motor/review.ts.',
        inputSchema: SolicitarReviewSeccionInputSchema,
        execute: async (input) => {
          // Server-side gate ANTES de Opus (latency fix — Opus es 30-60s).
          // Si Sonnet emitió review prematuramente (grupo ya cerrado, snapshot
          // fuera del grupo, o críticas todavía accionables), short-circuit con
          // tool_result error y NO invocamos al director.
          const gate = await canCloseSeccion({
            sesion_id,
            input,
            cajasAplicables,
          });
          if (!gate.ok) {
            logger.warn('tool.solicitar_review_seccion.rechazada_pre_opus', {
              sesion_id,
              grupo_ui: input.grupo_ui_codigo,
              turno_disparador: input.turno_disparador,
              razon: gate.razon,
              cajas_pendientes_count: gate.cajas_pendientes?.length ?? 0,
            });
            return {
              error: 'review_preconditions_not_met',
              razon: gate.razon,
              message: gate.message,
              ...(gate.cajas_pendientes
                ? { cajas_pendientes: gate.cajas_pendientes }
                : {}),
            };
          }

          try {
            const out = await processSolicitarReview(input, { sesion_id });
            return out;
          } catch (err) {
            if (err instanceof OpusReviewPromptNotReady) {
              // Step iv pendiente. Devolver al modelo una indicación clara para
              // que sepa que el director no está disponible.
              return {
                error: 'opus_director_prompt_not_ready',
                message:
                  'El director (Opus) no está disponible — system_prompt step iv pendiente. Sigue trabajando con tus 3 tools normales hasta que se desbloquee.',
              };
            }
            throw err;
          }
        },
      }),
    },
    toolChoice: 'auto',
    // Multi-step: AI SDK v6 default es stepCountIs(1) — el stream cierra
    // tras la PRIMERA tool_call y nunca devuelve los tool_results al modelo
    // para continuar. El turn loop necesita que Sonnet pueda encadenar:
    //   registrar_extraccion → (recibe result) → solicitar_review_seccion?
    //   → generar_batch_preguntas → texto final.
    // 8 pasos cubren el peor caso realista (extracción + review opcional +
    // batch + buffer) sin riesgo de runaway loop. Si Sonnet quiere más,
    // termina turno limpio y founder lo ve en logs.
    stopWhen: stepCountIs(8),
    onError: ({ error }) => {
      // Loguea el error completo (con cause/statusCode/responseBody si es
      // APICallError) a Axiom. El mensaje que ve el cliente lo decide
      // toUIMessageStreamResponse({ onError: formatStreamError }) más abajo.
      const isApiCall = APICallError.isInstance(error);
      logger.error('turn.stream_error', {
        sesion_id,
        turno_agente_id: turnoAgente.turno_id,
        is_api_call_error: isApiCall,
        status_code: isApiCall ? error.statusCode : undefined,
        response_body: isApiCall ? error.responseBody : undefined,
        message: error instanceof Error ? error.message : String(error),
        cause:
          error instanceof Error && error.cause
            ? error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
            : undefined,
      });
    },
    onFinish: async (event) => {
      // Cierre del stream — actualizar el turno agente placeholder con el
      // texto acumulado y métricas de tokens. Si crashea aquí, el placeholder
      // queda en DB con contenido vacío pero las extracciones ya persistidas
      // mantienen trazabilidad (acepta tradeoff documentado en persistence.ts).
      try {
        const textoFinal = event.text ?? '';
        const tokensInput = event.totalUsage?.inputTokens;
        const tokensOutput = event.totalUsage?.outputTokens;
        const latenciaMs = Date.now() - turnoAgenteStreamStartedAt;

        await actualizarContenidoTurnoAgente({
          turno_id: turnoAgente.turno_id,
          contenido_texto: textoFinal,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          latencia_ms: latenciaMs,
        });

        logger.info('turn.agente_actualizado_post_stream', {
          sesion_id,
          turno_agente_id: turnoAgente.turno_id,
          longitud_texto: textoFinal.length,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          latencia_ms: latenciaMs,
        });
      } catch (err) {
        logger.error('turn.agente_update_fallido', {
          sesion_id,
          turno_agente_id: turnoAgente.turno_id,
          error: err instanceof Error ? err.message : String(err),
        });
        // No re-throw: ya respondimos el stream al cliente; abortar el UPDATE
        // del placeholder no debería romper el cliente.
      }
    },
  });

  return result.toUIMessageStreamResponse({ onError: formatStreamError });
}
