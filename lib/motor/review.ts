// Motor del review handoff Sonnet→Opus (Phase 5 step iii).
//
// Spec v2 §4 (orquestación) + §5 (telemetría) + §6 (side-effects de motor) + §7
// (materialización de decline_to_answer durante la sesión).
//
// Entry point: `processSolicitarReview` recibe el input validado del tool
// `solicitar_review_seccion` y devuelve un `ProcessReviewResult` que el route
// handler `/api/turn` usa para decidir qué inyectar al siguiente turn de Sonnet
// (guidance, cierre de grupo, lista para síntesis, etc.).
//
// Lo que hace internamente:
//   1. Determina round (1 o 2) consultando `reviews_seccion`.
//   2. Persiste fila en `reviews_seccion` con decision_opus=NULL.
//   3. Llama a Opus (placeholder hasta step iv — arroja OpusReviewPromptNotReady).
//   4. Enforza reglas del motor sobre la respuesta de Opus (round 2 + profundizar
//      → reject; cap_casos + caso_sintetico → reject).
//   5. UPDATE de la fila con la decisión final.
//   6. Side-effects por rama (avanzar / profundizar / caso_sintetico).
//   7. Telemetría a Axiom para cada paso.
//
// Inyección de dependencia: `processSolicitarReview` acepta `opusCall` opcional
// para tests. Producción usa el placeholder hasta step iv.

import { sql, eq, and, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  reviews_seccion,
  cajas_declinadas,
  casos_generados,
} from '@/db/schema';
import {
  RespuestaOpusSchema,
  type SolicitarReviewSeccionInput,
  type RespuestaOpus,
  type RazonDecline,
  type CajaNoClausurada,
} from '@/lib/schemas/review_seccion';
import type { GrupoUI } from '@/lib/schemas/cajas';
import { logger } from '@/lib/observability/axiom';
import { OPUS_DIRECTOR_PROMPT_READY } from '@/lib/prompts/opus_director';
import { inngest } from '@/lib/inngest/client';

// =============================================================================
// Constantes spec v2
// =============================================================================

// Orden canónico (spec §4.3). Opus debe respetarlo en `siguiente_grupo_ui`.
export const ORDEN_CANONICO_GRUPOS: readonly GrupoUI[] = [
  'identificacion',
  'productos_y_mercado',
  'numeros_del_negocio',
  'operacion',
  'pricing_y_criterio',
  'contacto_y_especificos',
] as const;

// Cap global per-sesión. Memoria project_cap_casos cementa esto. NO ajustar.
export const CAP_CASOS_SINTETICOS = 5;

// =============================================================================
// Tipos públicos
// =============================================================================

export type ReviewEstado =
  | 'profundizar_pendiente' // round 1 profundizar — Sonnet recibe guidance
  | 'grupo_cerrado' // avanzar a siguiente grupo
  | 'sesion_lista_para_sintesis' // último grupo cerrado
  | 'caso_solicitado'; // caso_sintetico aprobado

export interface ProcessReviewResult {
  estado: ReviewEstado;
  review_id: string;
  // Solo presentes si estado === 'profundizar_pendiente':
  guidance_para_sonnet?: string;
  cajas_a_reabordar?: string[];
  // Solo presente si estado === 'grupo_cerrado':
  siguiente_grupo_ui?: GrupoUI;
  // Solo presentes si estado === 'caso_solicitado':
  cajas_objetivo_caso?: string[];
  hipotesis_a_clausurar?: string;
  urgencia_caso?: 'alta' | 'media';
}

export type OpusCallPayload = {
  sonnet_input: SolicitarReviewSeccionInput;
  round: number;
  casos_usados: number;
};

export type OpusCallFn = (payload: OpusCallPayload) => Promise<RespuestaOpus>;

export class OpusReviewPromptNotReady extends Error {
  constructor() {
    super(
      'OpusReviewPromptNotReady: el system_prompt del director (step iv) no está listo. ' +
        'Espera a que founder firme `lib/prompts/opus_director.ts` con prompt y few-shots.'
    );
    this.name = 'OpusReviewPromptNotReady';
  }
}

// =============================================================================
// Producción opusCall — placeholder hasta step (iv)
// =============================================================================

export const productionOpusCall: OpusCallFn = async () => {
  if (!OPUS_DIRECTOR_PROMPT_READY) {
    throw new OpusReviewPromptNotReady();
  }
  // TODO step (iv): wire real Opus call con SDK Anthropic + system_prompt literal +
  // tool-output schema (RespuestaOpusSchema vía z.toJSONSchema).
  throw new OpusReviewPromptNotReady();
};

// =============================================================================
// Entry point
// =============================================================================

export async function processSolicitarReview(
  input: SolicitarReviewSeccionInput,
  ctx: { sesion_id: string; opusCall?: OpusCallFn }
): Promise<ProcessReviewResult> {
  const { sesion_id } = ctx;
  const opusCall = ctx.opusCall ?? productionOpusCall;

  // 1. Determinar round (1 si no hay review previa para este grupo; 2 si la previa
  //    fue profundizar).
  const round = await determinarRound(sesion_id, input.grupo_ui_codigo);

  // 2. Insertar fila inicial con decision_opus=NULL (motor inserta antes de Opus).
  const [inserted] = await db
    .insert(reviews_seccion)
    .values({
      sesion_id,
      grupo_ui_codigo: input.grupo_ui_codigo,
      turno_disparador: input.turno_disparador,
      round,
      hipotesis_sonnet: input.hipotesis_sonnet,
      extracciones_snapshot: input.extracciones_snapshot,
      cajas_no_clausuradas: input.cajas_no_clausuradas,
    })
    .returning({ id: reviews_seccion.id });
  const reviewId = inserted.id;

  // 3. Contar casos usados para enforcement de cap.
  const casosUsados = await contarCasosUsados(sesion_id);

  // 4. Telemetría: review.disparado.
  logger.review.disparado({
    sesion_id,
    grupo_ui: input.grupo_ui_codigo,
    round,
    turno_disparador: input.turno_disparador,
    num_cajas_no_clausuradas: input.cajas_no_clausuradas.length,
  });

  // 5. Llamar a Opus (placeholder o inyectado en tests).
  const t0 = Date.now();
  let opusRaw: unknown;
  try {
    opusRaw = await opusCall({
      sonnet_input: input,
      round,
      casos_usados: casosUsados,
    });
  } catch (err) {
    logger.review.opusCallFallido({
      sesion_id,
      grupo_ui: input.grupo_ui_codigo,
      round,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  const latenciaMs = Date.now() - t0;

  // 6. Validar shape (incluso si placeholder/test devuelve algo, validamos siempre).
  const opusValidacion = RespuestaOpusSchema.safeParse(opusRaw);
  if (!opusValidacion.success) {
    logger.review.opusResponseInvalida({
      sesion_id,
      grupo_ui: input.grupo_ui_codigo,
      round,
      error: opusValidacion.error.message,
    });
    throw new Error(
      `RespuestaOpus inválida: ${opusValidacion.error.message}`
    );
  }
  const decisionInicial = opusValidacion.data;

  // 7. Enforzar reglas del motor (round 2 + profundizar; cap + caso).
  const decisionFinal = enforzarReglasMotor(decisionInicial, {
    round,
    casos_usados: casosUsados,
    sesion_id,
    grupo_ui: input.grupo_ui_codigo,
  });

  logger.review.opusDecidio({
    sesion_id,
    grupo_ui: input.grupo_ui_codigo,
    round,
    decision: decisionFinal.decision,
    latencia_ms: latenciaMs,
  });

  // 8. UPDATE de la fila con decision details.
  await persistirDecisionEnReview(reviewId, decisionFinal);

  // 9. Side-effects por rama.
  return await aplicarDecisionRama(decisionFinal, {
    reviewId,
    sesion_id,
    grupo_ui: input.grupo_ui_codigo,
    round,
    cajas_no_clausuradas: input.cajas_no_clausuradas,
  });
}

// =============================================================================
// Helpers — round determination
// =============================================================================

async function determinarRound(
  sesion_id: string,
  grupo_ui: string
): Promise<number> {
  const previas = await db
    .select({ decision_opus: reviews_seccion.decision_opus })
    .from(reviews_seccion)
    .where(
      and(
        eq(reviews_seccion.sesion_id, sesion_id),
        eq(reviews_seccion.grupo_ui_codigo, grupo_ui)
      )
    );
  // Si hay alguna review previa con decision='profundizar', esta es round 2.
  // Si hay previas pero ninguna con profundizar, ya cerró antes — no debería
  // dispararse de nuevo, pero permitimos round=1 (el unique index lo bloqueará).
  const huboProfundizar = previas.some((p) => p.decision_opus === 'profundizar');
  return huboProfundizar ? 2 : 1;
}

async function contarCasosUsados(sesion_id: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(casos_generados)
    .where(eq(casos_generados.sesion_id, sesion_id));
  return row?.n ?? 0;
}

// =============================================================================
// Reglas del motor — enforcement post-Opus (spec §3 reglas 1, 2, 3)
// =============================================================================

interface EnforzarCtx {
  round: number;
  casos_usados: number;
  sesion_id: string;
  grupo_ui: string;
}

export function enforzarReglasMotor(
  d: RespuestaOpus,
  ctx: EnforzarCtx
): RespuestaOpus {
  // Regla 1: profundizar solo en round 1.
  if (d.decision === 'profundizar' && ctx.round >= 2) {
    logger.review.profundizacionRejected({
      sesion_id: ctx.sesion_id,
      grupo_ui: ctx.grupo_ui,
    });
    // Coerción a avanzar con anotación. Las cajas_no_clausuradas se declinarán
    // como `estancada_post_profundizar` aguas abajo (ver aplicarDecisionRama).
    return {
      decision: 'avanzar',
      siguiente_grupo_ui: siguienteGrupoCanonico(ctx.grupo_ui),
      anotacion_audit:
        'motor_coerced: round 2 con profundizar rechazado, forzado a avanzar',
    };
  }

  // Regla 2: caso_sintetico solo si bajo el cap.
  if (
    d.decision === 'caso_sintetico' &&
    ctx.casos_usados >= CAP_CASOS_SINTETICOS
  ) {
    logger.review.escalacionCasoRejectedPorCap({
      sesion_id: ctx.sesion_id,
      grupo_ui: ctx.grupo_ui,
    });
    return {
      decision: 'avanzar',
      siguiente_grupo_ui: siguienteGrupoCanonico(ctx.grupo_ui),
      anotacion_audit:
        'motor_coerced: cap_casos_alcanzado, forzado a avanzar con decline cap_casos_alcanzado',
    };
  }

  // Regla 3: avanzar.siguiente_grupo_ui debe respetar orden canónico o ser null.
  if (d.decision === 'avanzar') {
    const esperado = siguienteGrupoCanonico(ctx.grupo_ui);
    if (d.siguiente_grupo_ui !== esperado) {
      logger.review.siguienteGrupoCorregido({
        sesion_id: ctx.sesion_id,
        grupo_ui: ctx.grupo_ui,
        opus_dijo: d.siguiente_grupo_ui,
        canonico: esperado,
      });
      return { ...d, siguiente_grupo_ui: esperado };
    }
  }

  return d;
}

export function siguienteGrupoCanonico(grupoActual: string): GrupoUI | null {
  const idx = ORDEN_CANONICO_GRUPOS.indexOf(grupoActual as GrupoUI);
  if (idx < 0 || idx >= ORDEN_CANONICO_GRUPOS.length - 1) return null;
  return ORDEN_CANONICO_GRUPOS[idx + 1];
}

// =============================================================================
// Persistencia de la decisión en reviews_seccion
// =============================================================================

async function persistirDecisionEnReview(
  reviewId: string,
  d: RespuestaOpus
): Promise<void> {
  const decidio_at = new Date();
  if (d.decision === 'avanzar') {
    await db
      .update(reviews_seccion)
      .set({
        decision_opus: 'avanzar',
        siguiente_grupo_ui: d.siguiente_grupo_ui,
        decidio_at,
      })
      .where(eq(reviews_seccion.id, reviewId));
  } else if (d.decision === 'profundizar') {
    await db
      .update(reviews_seccion)
      .set({
        decision_opus: 'profundizar',
        guidance_opus: d.guidance,
        cajas_a_reabordar: d.cajas_a_reabordar,
        decidio_at,
      })
      .where(eq(reviews_seccion.id, reviewId));
  } else {
    // caso_sintetico — caso_sintetico_id se setea cuando el caso se persista
    // en el pipeline de generación (out of scope step iii).
    await db
      .update(reviews_seccion)
      .set({
        decision_opus: 'caso_sintetico',
        decidio_at,
      })
      .where(eq(reviews_seccion.id, reviewId));
  }
}

// =============================================================================
// Side-effects por rama
// =============================================================================

interface RamaCtx {
  reviewId: string;
  sesion_id: string;
  grupo_ui: string;
  round: number;
  cajas_no_clausuradas: CajaNoClausurada[];
}

async function aplicarDecisionRama(
  d: RespuestaOpus,
  ctx: RamaCtx
): Promise<ProcessReviewResult> {
  if (d.decision === 'profundizar') {
    return {
      estado: 'profundizar_pendiente',
      review_id: ctx.reviewId,
      guidance_para_sonnet: d.guidance,
      cajas_a_reabordar: d.cajas_a_reabordar,
    };
  }

  if (d.decision === 'caso_sintetico') {
    // El caso se genera en pipeline separado (caso pipeline existente). Aquí solo
    // marcamos la solicitud y devolvemos los args. El route handler dispara la
    // generación.
    return {
      estado: 'caso_solicitado',
      review_id: ctx.reviewId,
      cajas_objetivo_caso: d.cajas_objetivo,
      hipotesis_a_clausurar: d.hipotesis_a_clausurar,
      urgencia_caso: d.urgencia,
    };
  }

  // avanzar — side-effects: decline cajas no clausuradas + merge secciones_cerradas.
  const razonDecline = razonDeclineParaAvanzar(d, ctx);
  await Promise.all(
    ctx.cajas_no_clausuradas.map((c) =>
      declinarCaja({
        sesion_id: ctx.sesion_id,
        caja_codigo: c.caja_codigo,
        razon: razonDecline,
        review_id_origen: ctx.reviewId,
        detalle: c.detalle,
      })
    )
  );

  await mergeSeccionCerrada(ctx.sesion_id, ctx.grupo_ui, {
    cerrada_at: new Date().toISOString(),
    review_id: ctx.reviewId,
    declino_cajas: ctx.cajas_no_clausuradas.map((c) => c.caja_codigo),
  });

  // Si era el último grupo, transicionar sesión a 'sintetizando'.
  if (d.siguiente_grupo_ui === null) {
    const transicionado = await transicionarSesionASintetizando(ctx.sesion_id);
    if (transicionado) {
      await dispatchSesionListaParaSintesis(ctx.sesion_id, ctx.reviewId);
    }
    return {
      estado: 'sesion_lista_para_sintesis',
      review_id: ctx.reviewId,
    };
  }

  return {
    estado: 'grupo_cerrado',
    review_id: ctx.reviewId,
    siguiente_grupo_ui: d.siguiente_grupo_ui,
  };
}

export function razonDeclineParaAvanzar(
  d: RespuestaOpus,
  ctx: { round: number }
): RazonDecline {
  // d aquí es siempre 'avanzar' (los otros branches retornaron arriba).
  // La razón depende del CONTEXTO de cómo llegamos a avanzar, no del payload.
  const anotacion = (d as { anotacion_audit?: string }).anotacion_audit ?? '';
  if (anotacion.includes('cap_casos_alcanzado')) return 'cap_casos_alcanzado';
  if (anotacion.includes('round 2')) return 'estancada_post_profundizar';
  // Default: round 2 normal o round 1 con avanzar — distinguimos por round.
  if (ctx.round >= 2) return 'estancada_post_profundizar';
  // round 1 con cajas_no_clausuradas y Opus avanzó → aceptada_round_1.
  return 'aceptada_round_1';
}

// =============================================================================
// Side-effect helpers — cajas_declinadas
// =============================================================================

interface DeclinarCajaArgs {
  sesion_id: string;
  caja_codigo: string;
  razon: RazonDecline;
  review_id_origen: string;
  detalle?: string;
}

export async function declinarCaja(args: DeclinarCajaArgs): Promise<void> {
  // ON CONFLICT DO NOTHING — idempotente. Una caja se declina una sola vez por
  // sesión (unique index sesion_id, caja_codigo). Si Sonnet luego logra
  // extraerla via caso sintético, otro flujo borra la fila antes de re-extraer.
  await db.execute(sql`
    INSERT INTO cajas_declinadas (sesion_id, caja_codigo, razon, review_id_origen, detalle)
    VALUES (${args.sesion_id}, ${args.caja_codigo}, ${args.razon}, ${args.review_id_origen}, ${args.detalle ?? null})
    ON CONFLICT (sesion_id, caja_codigo) DO NOTHING
  `);

  logger.decline.registrado({
    sesion_id: args.sesion_id,
    caja_codigo: args.caja_codigo,
    razon: args.razon,
    review_id_origen: args.review_id_origen,
  });
}

// =============================================================================
// Side-effect helpers — sesiones.secciones_cerradas atomic merge (spec §4.5)
// =============================================================================

export interface SeccionCerradaPayload {
  cerrada_at: string;
  review_id: string;
  declino_cajas: string[];
}

/**
 * Atomic merge en `sesiones.secciones_cerradas` (jsonb).
 *
 * Antipatrón evitado: read-modify-write desde JS (race condition).
 * Patrón correcto: UPDATE atómico con operador `||` jsonb de Postgres.
 *
 * Idempotente: si `grupo` ya existía en el jsonb, se reemplaza con el nuevo
 * payload (el merge shallow del operador `||` favorece al lado derecho).
 */
export async function mergeSeccionCerrada(
  sesion_id: string,
  grupo: string,
  payload: SeccionCerradaPayload
): Promise<void> {
  const merge = JSON.stringify({ [grupo]: payload });
  await db.execute(sql`
    UPDATE sesiones
    SET secciones_cerradas = COALESCE(secciones_cerradas, '{}'::jsonb)
                             || ${merge}::jsonb
    WHERE id = ${sesion_id}
  `);
}

// =============================================================================
// Side-effect helpers — transición de status (spec §4.2.4)
// =============================================================================

/**
 * Transición atómica `sesiones.status = 'sintetizando'` con guard contra dobles
 * transiciones por race. Devuelve `true` si la fila fue actualizada (i.e. era
 * 'abierta' antes y ahora es 'sintetizando'), `false` si ya estaba en otro
 * estado terminal — race condition esperada cuando dos eventos finales llegan
 * casi simultáneos.
 */
export async function transicionarSesionASintetizando(
  sesion_id: string
): Promise<boolean> {
  const result = await db
    .update(sesiones)
    .set({ status: 'sintetizando' })
    .where(and(eq(sesiones.id, sesion_id), eq(sesiones.status, 'abierta')))
    .returning({ id: sesiones.id });
  return result.length > 0;
}

// =============================================================================
// Inngest dispatch — sesion/lista_para_sintesis (Phase 5 step 5 commit 9)
// =============================================================================

/**
 * Despacha el evento `sesion/lista_para_sintesis` al plano de Inngest. El
 * handler en `lib/inngest/functions/sintetizarSesion.ts` lo recibe y orquesta
 * la síntesis final (Fase 8).
 *
 * Por convención: emitimos a Axiom DESPUÉS de inngest.send con el `event_id`
 * retornado en el payload — esto permite correlacionar el evento Axiom con la
 * ejecución concreta de la función Inngest si necesitamos auditar fallas.
 *
 * Si `inngest.send` arroja (network/auth/etc.), Axiom recibe
 * `sesion.sintesis_failed` y propagamos el error para que la transición de
 * status al caller pueda revertirse o quedar en 'sintetizando' pendiente.
 */
export async function dispatchSesionListaParaSintesis(
  sesion_id: string,
  ultimo_review_id: string
): Promise<void> {
  // Métricas básicas para audit + dashboard. Mismo shape que recibe el handler
  // de Inngest como event.data.
  const totales = await calcularTotalesSesion(sesion_id);

  const payload = {
    sesion_id,
    ultimo_review_id,
    total_reviews: totales.total_reviews,
    total_profundizaciones: totales.total_profundizaciones,
    total_casos: totales.total_casos,
    completitud_estimada: totales.completitud_estimada,
  };

  let event_id: string | undefined;
  try {
    const result = await inngest.send({
      name: 'sesion/lista_para_sintesis',
      data: payload,
    });
    // Inngest devuelve { ids: string[] } — un id por evento enviado.
    event_id = result.ids[0];
  } catch (err) {
    logger.sesion.sintesisFailed({
      sesion_id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  logger.sesion.listaParaSintesis({
    ...payload,
    // event_id correlaciona Axiom ↔ Inngest run para audit.
    inngest_event_id: event_id,
  });
}

interface TotalesSesion {
  total_reviews: number;
  total_profundizaciones: number;
  total_casos: number;
  completitud_estimada: number | null;
}

async function calcularTotalesSesion(sesion_id: string): Promise<TotalesSesion> {
  const [reviewsRow] = await db
    .select({ n: count() })
    .from(reviews_seccion)
    .where(eq(reviews_seccion.sesion_id, sesion_id));
  const [profRow] = await db
    .select({ n: count() })
    .from(reviews_seccion)
    .where(
      and(
        eq(reviews_seccion.sesion_id, sesion_id),
        eq(reviews_seccion.decision_opus, 'profundizar')
      )
    );
  const [casosRow] = await db
    .select({ n: count() })
    .from(casos_generados)
    .where(eq(casos_generados.sesion_id, sesion_id));

  // completitud_estimada: lo computa sintesis_final.ts con el perfil completo.
  // Aquí dejamos null para evitar duplicar lógica.
  return {
    total_reviews: reviewsRow?.n ?? 0,
    total_profundizaciones: profRow?.n ?? 0,
    total_casos: casosRow?.n ?? 0,
    completitud_estimada: null,
  };
}
