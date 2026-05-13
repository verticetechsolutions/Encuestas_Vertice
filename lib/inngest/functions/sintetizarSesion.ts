// Inngest function que escucha `sesion/lista_para_sintesis` y orquesta la
// síntesis final via Opus 4.7 con extended thinking 8K (Fase 8).
//
// Estado al cierre de Fase 8 scaffold: la cadena vive en
// `lib/motor/sintesis_final.ts` (build → Opus → validar → persistir → marcar
// completa). Esta function es el shell delgado que la invoca con retry
// semantics + telemetry.
//
// API Inngest v4: `createFunction(options, handler)`. El trigger va dentro de
// `options.triggers` (single-or-array). v3 usaba 3 args `(options, trigger,
// handler)` — migrado.
//
// Manejo de errores tipados:
//   - `OpusSintesisPromptNotReady` → re-throw via NonRetriableError. La sesión
//     queda en `sintetizando` esperando que el founder firme el prompt;
//     reintentar 4 veces no resuelve el problema (no hay key/firma).
//   - `SesionNoEncontradaError` → NonRetriableError (data inconsistency, no
//     resuelve con retry).
//   - Cualquier otro error → propaga para que Inngest haga retry exponencial
//     hasta `retries: 4`. Tras agotar, motor emite logger.sesion.sintesisFailed
//     y la sesión queda en `sintetizando` (intervención manual para mover a
//     `abandonada`).

import { NonRetriableError } from 'inngest';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/observability/axiom';
import { db } from '@/lib/db';
import { perfil_decision_final } from '@/db/schema';
import {
  procesarSintesisFinal,
  OpusSintesisPromptNotReady,
  SesionNoEncontradaError,
} from '@/lib/motor/sintesis_final';
import { generarPdfSintesis } from '@/lib/motor/sintesis_pdf';
import { uploadPdfToBlob } from '@/lib/storage/blob';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';

export const sintetizarSesion = inngest.createFunction(
  {
    id: 'sintetizar-sesion',
    triggers: [{ event: 'sesion/lista_para_sintesis' }],
    // Reintentos automáticos: 4 intentos con backoff exponencial. La síntesis
    // hace LLM calls — una falla transitoria no debe abortar permanentemente.
    // Si tras 4 reintentos sigue fallando, motor emite sesion.sintesis_failed y
    // la sesion.status queda 'sintetizando' (necesita intervención manual).
    retries: 4,
  },
  async ({ event, step }) => {
    // event.data shape coincide con SesionListaParaSintesisPayload del motor.
    const data = event.data as {
      sesion_id: string;
      ultimo_review_id: string;
      total_reviews: number;
      total_profundizaciones: number;
      total_casos: number;
      completitud_estimada: number | null;
    };

    // step.run aísla la lógica para que Inngest la trate como atómica + cache
    // de resultados parciales si el step falla y reintenta. La función es ya
    // idempotente a nivel motor (marcarSesionCompleta tiene guard de status).
    const result = await step.run('procesar-sintesis-final', async () => {
      try {
        const r = await procesarSintesisFinal(data.sesion_id);
        logger.info('inngest.sintetizar_sesion.ok', {
          event_id: event.id,
          sesion_id: data.sesion_id,
          perfil_id: r.perfil_id,
          version: r.version,
          status_transition: r.status_transition,
          completitud: r.perfil.metricas.completitud,
          confianza_global: r.perfil.metricas.confianza_global,
        });
        // Pasamos el perfil completo al siguiente step para evitar una
        // segunda lectura de DB. Los step outputs son JSON-serializables y
        // PerfilDecisionFinal es jsonb-shaped por construcción.
        return {
          perfil_id: r.perfil_id,
          version: r.version,
          status_transition: r.status_transition,
          perfil: r.perfil,
        };
      } catch (err) {
        // Errores que no resuelven con retry — los marcamos NonRetriable para
        // que Inngest no consuma intentos ni mande noise a Axiom.
        if (err instanceof OpusSintesisPromptNotReady) {
          logger.warn('inngest.sintetizar_sesion.prompt_no_listo', {
            event_id: event.id,
            sesion_id: data.sesion_id,
            nota: 'OPUS_SINTESIS_FINAL_PROMPT_READY=false. Sesión queda en sintetizando.',
          });
          throw new NonRetriableError(
            'OpusSintesisPromptNotReady — esperando firma del prompt en lib/prompts/opus_sintesis_final.ts'
          );
        }
        if (err instanceof SesionNoEncontradaError) {
          logger.error('inngest.sintetizar_sesion.sesion_no_encontrada', {
            event_id: event.id,
            sesion_id: data.sesion_id,
          });
          throw new NonRetriableError(`Sesión ${data.sesion_id} no encontrada`);
        }
        // Errores transitorios (DB timeout, Opus 5xx, validación Zod
        // recuperable, etc.) → propagamos para que Inngest haga retry.
        logger.sesion.sintesisFailed({
          sesion_id: data.sesion_id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });

    // Step separado para el PDF: aislamos la generación del documento de la
    // síntesis Opus. Si el PDF falla (Chromium crash, OOM, fonts no leíbles)
    // NO queremos rehacer la llamada a Opus — el perfil ya está persistido y
    // la sesión ya está marcada `completa`. Inngest cachea el step previo y
    // sólo reintentaría éste. Errores de PDF se loguean pero no fallan la
    // function — el perfil_decision_final es el entregable canónico, el PDF
    // es un nice-to-have hasta que tengamos storage real (Fase 10).
    await step.run('generar-pdf', async () => {
      // Inngest serializa el output de cada step. `result.perfil` viene del
      // step previo intacto. El schema canónico ahora declara `generado_at`
      // como `z.string().datetime()` (ISO 8601) — alineado con lo que Opus
      // emite y con el ida/vuelta JSON de Inngest. El template del PDF
      // acepta `Date | string` así que pasamos el shape directo.
      const perfil = result.perfil as PerfilDecisionFinal;
      try {
        const pdf = await generarPdfSintesis(perfil);
        // Storage Blob (Fase 8 cerrada 2026-05-13). Gated por
        // `BLOB_READ_WRITE_TOKEN` + presencia de la dep `@vercel/blob` (ver
        // `lib/storage/blob.ts`). Si no está configurado, `uploadPdfToBlob`
        // devuelve null y el step sigue sin persistir URL.
        const pathname = `sintesis/${result.perfil_id}.pdf`;
        const url = await uploadPdfToBlob(pdf.buffer, pathname);

        if (url) {
          // Persistir la URL. UPDATE simple sobre perfil_decision_final.
          // Idempotente: si re-run del cron repite la subida, el UPDATE
          // sobreescribe con la URL nueva (Blob no garantiza URL estable si
          // el caller no pasa `addRandomSuffix: false`).
          try {
            await db
              .update(perfil_decision_final)
              .set({ pdf_url: url })
              .where(eq(perfil_decision_final.id, result.perfil_id));
          } catch (dbErr) {
            // Non-fatal: PDF ya está en Blob, la URL solo se perdió. El
            // admin viewer mostrará el perfil sin link al PDF. Log para audit.
            logger.error('inngest.generar_pdf.persist_url_fallo', {
              event_id: event.id,
              sesion_id: data.sesion_id,
              perfil_id: result.perfil_id,
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          }
        }

        logger.info('inngest.generar_pdf.ok', {
          event_id: event.id,
          sesion_id: data.sesion_id,
          perfil_id: result.perfil_id,
          pdf_bytes: pdf.bytes,
          pdf_url_persisted: url !== null,
        });
        return { bytes: pdf.bytes, pdf_url: url };
      } catch (err) {
        logger.error('inngest.generar_pdf.fallo', {
          event_id: event.id,
          sesion_id: data.sesion_id,
          perfil_id: result.perfil_id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Non-fatal: el perfil ya está persistido. Devolvemos error markdown
        // sin re-throw para que Inngest no reintente este step.
        return { error: err instanceof Error ? err.message : 'unknown' };
      }
    });

    // El return final NO incluye `perfil` — Inngest persiste el output
    // completo del handler en su event history y no queremos duplicar la
    // jsonb del perfil que ya vive en perfil_decision_final.
    return {
      perfil_id: result.perfil_id,
      version: result.version,
      status_transition: result.status_transition,
    };
  }
);
