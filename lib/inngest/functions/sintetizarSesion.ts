// Inngest function que escucha `sesion/lista_para_sintesis` y orquesta la
// síntesis final via Opus 4.7 con extended thinking 8K (Fase 8).
//
// Estado al cierre de step 5: PLACEHOLDER. La función está cableada y recibe
// eventos correctamente, pero el `step.run('sintetizar')` solo logguea — la
// implementación real de `lib/motor/sintesis_final.ts` (LLM call + perfil
// final + UPDATE sesiones.status='completa' o 'abandonada') es Fase 8.
//
// Por qué este placeholder y no diferir el wiring entero:
//   1. Sin función registrada, `inngest.send()` desde el motor solo encola
//      eventos huérfanos en el dev server / cloud — sin handler que los
//      consuma queda como dead event.
//   2. Tener el handler vivo confirma que el flujo end-to-end (motor → Inngest
//      → handler) funciona, aunque no haga el trabajo final todavía.
//   3. El reemplazo Fase 8 es local a este archivo: substituir el step.run
//      "placeholder" por la cadena real (validar perfil, llamar Opus, persistir,
//      transición de status, etc.). Cero cambios al motor.
//
// API Inngest v4: `createFunction(options, handler)`. El trigger va dentro de
// `options.triggers` (single-or-array). v3 usaba 3 args `(options, trigger,
// handler)` — migrado.

import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/observability/axiom';

export const sintetizarSesion = inngest.createFunction(
  {
    id: 'sintetizar-sesion',
    triggers: [{ event: 'sesion/lista_para_sintesis' }],
    // Reintentos automáticos: 4 intentos con backoff exponencial. La síntesis
    // real (Fase 8) hace LLM calls — una falla transitoria no debe abortar
    // permanentemente. Si tras 4 reintentos sigue fallando, motor lo registrará
    // como `sesion.sintesis_failed` y el sesion.status quedará 'sintetizando'
    // (necesita intervención manual para mover a 'abandonada').
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

    await step.run('placeholder-fase-8', async () => {
      // TODO Fase 8: invocar lib/motor/sintesis_final.ts con el shape:
      //   const perfil = await sintetizarFinal({ sesion_id: data.sesion_id });
      //   await marcarSesionCompleta(data.sesion_id, perfil);
      // En caso de error: motor maneja la transición a 'abandonada' + emite
      // logger.sesion.sintesisFailed.
      logger.info('inngest.sintetizar_sesion.placeholder', {
        event_id: event.id,
        sesion_id: data.sesion_id,
        ultimo_review_id: data.ultimo_review_id,
        total_reviews: data.total_reviews,
        total_profundizaciones: data.total_profundizaciones,
        total_casos: data.total_casos,
        nota: 'sintesis_final.ts no implementado todavía (Fase 8). Función registrada para evitar eventos huérfanos.',
      });
      return { received: true, sesion_id: data.sesion_id };
    });
  }
);
