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
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { sesiones } from '@/db/schema';
import {
  RegistrarExtraccionInputSchema,
  GenerarBatchPreguntasInputSchema,
  SolicitarCasoSinteticoInputSchema,
} from '@/lib/motor/tools';
import { SolicitarReviewSeccionInputSchema } from '@/lib/schemas/review_seccion';
import { processSolicitarReview, OpusReviewPromptNotReady } from '@/lib/motor/review';
import {
  persistirTurnoUsuario,
  persistirTurnoAgente,
  actualizarContenidoTurnoAgente,
  persistirExtraccionesBatch,
  ExtraccionInvalidaError,
  type ExtraccionInput,
} from '@/lib/motor/persistence';
import { valorSchemaFor } from '@/lib/schemas/extracciones';
import {
  SONNET_FASE1_SYSTEM_PROMPT,
  SONNET_FASE1_PROMPT_READY,
} from '@/lib/prompts/sonnet_fase1';
import { logger } from '@/lib/observability/axiom';

// =============================================================================
// Request schema
// =============================================================================

const TurnRequestSchema = z.object({
  sesion_id: z.string().uuid(),
  mensaje_usuario: z.string().min(1),
});

// =============================================================================
// POST handler
// =============================================================================

export async function POST(req: Request) {
  // 1. Gate: prompt de Sonnet listo. Si false, no podemos invocar Fase 1.
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

  // 2. Parse request
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

  // 3. Validar que la sesión existe y está abierta.
  const [sesion] = await db
    .select({ status: sesiones.status, consentimiento_at: sesiones.consentimiento_at })
    .from(sesiones)
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
    system: SONNET_FASE1_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: mensaje_usuario }],
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
            return {
              ok: true,
              persisted: persistidas.length,
              supersedidos,
              errores,
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
        description: 'Genera el siguiente batch de 2-4 preguntas. TODO step posterior emite al stream UI.',
        inputSchema: GenerarBatchPreguntasInputSchema,
        execute: async (input) => {
          logger.info('tool.generar_batch_preguntas.recibido', {
            sesion_id,
            longitud_batch: input.longitud_batch,
          });
          // TODO step posterior: emitir las preguntas al stream UI message para
          // que el cliente las muestre. Por ahora ack.
          return { ok: true, todo_step_posterior: true };
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

  return result.toUIMessageStreamResponse();
}
