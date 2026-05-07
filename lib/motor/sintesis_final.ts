// Motor de la síntesis final (Phase 8 scaffold).
//
// Spec IMPLEMENTATION.md §10 + §13 Fase 8. La síntesis final es el cierre de
// la sesión: el motor transforma todo el material recolectado (extracciones
// activas + cajas declinadas + casos sintéticos + metadata) en un
// `PerfilDecisionFinal` (lib/schemas/perfil_decision_final.ts) que se persiste
// en `perfil_decision_final.perfil_json`, y luego marca la sesión como
// `completa`.
//
// Entry point: `procesarSintesisFinal(sesion_id, ctx?)` recibe el id de
// sesión y devuelve `ProcessSintesisResult` con el perfil persistido y la
// transición de status. La función Inngest (`lib/inngest/functions/
// sintetizarSesion.ts`) la invoca al recibir `sesion/lista_para_sintesis`.
//
// Patrón espejo de `lib/motor/review.ts` (Phase 5 step 5) para coherencia:
//   1. Inyección de dependencia: ctx.opusCall opcional para tests. Producción
//      usa el placeholder hasta que el founder firme `OPUS_SINTESIS_FINAL_PROMPT_READY`.
//   2. Errores tipados (`OpusSintesisPromptNotReady`, `SintesisValidacionError`).
//   3. Validación Zod sobre output de Opus antes de persistir
//      (`PerfilDecisionFinalConsistenteSchema`).
//   4. Telemetría a Axiom para cada fase (placeholder via logger.info hasta
//      que se agreguen typed emitters dedicados).
//
// Lo que NO está aquí (scope deferido):
//   - Generación de PDF (vive en `lib/motor/sintesis_pdf.ts`).
//   - Storage del PDF (Vercel Blob/Postgres/etc — se decide cuando aterrice
//     la integración de blob storage; por ahora el PDF se genera en memoria
//     y se loguea su tamaño).
//   - Notificación admin por email (espera RESEND_API_KEY).

import { sql, eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  instituciones,
  extracciones as extraccionesTable,
  cajas_declinadas,
  casos_generados,
  perfil_decision_final,
} from '@/db/schema';
import {
  PerfilDecisionFinalConsistenteSchema,
  type PerfilDecisionFinal,
} from '@/lib/schemas/perfil_decision_final';
import {
  CAJAS_CANON,
  CAJAS_EXTENSION_POR_TIPO,
  type CajaCanon,
} from '@/lib/schemas/cajas';
import type { TipoInstitucion } from '@/lib/schemas/casos';
import { OPUS_SINTESIS_FINAL_PROMPT_READY } from '@/lib/prompts/opus_sintesis_final';
import { logger } from '@/lib/observability/axiom';

// =============================================================================
// Tipos del contrato Opus síntesis
// =============================================================================
//
// `SintesisInput` = lo que el motor le pasa a Opus. Mirror del `<input_contract>`
// del system_prompt en `lib/prompts/opus_sintesis_final.ts`. Cuando el founder
// firme el prompt y se haga el wiring real, este shape se serializa como
// user message + extended thinking 8K → tool_use con `PerfilDecisionFinal`.

export interface SintesisInputCajaExtraccion {
  caja_codigo: string;
  valor: unknown;
  confianza: number;
  evidencia_textual: string | null;
  fuente: 'llm' | 'manual';
  intentos: number;
}

export interface SintesisInputCajaDeclinada {
  caja_codigo: string;
  razon: string;
  intentos: number;
}

export interface SintesisInput {
  sesion: {
    id: string;
    institucion: {
      id: string;
      razon_social: string;
      nombre_comercial: string | null;
      tipo: TipoInstitucion;
    };
    cajas_aplicables: number; // pinned denominator
    fatiga_detectada: boolean;
    casos_sinteticos_aplicados: number;
  };
  cajas_aplicables_codigos: string[]; // CANON + EXTENSION[tipo].codigo
  extracciones: SintesisInputCajaExtraccion[];
  cajas_declinadas: SintesisInputCajaDeclinada[];
}

export type OpusSintesisCallFn = (
  input: SintesisInput
) => Promise<PerfilDecisionFinal>;

// =============================================================================
// Errores
// =============================================================================

export class OpusSintesisPromptNotReady extends Error {
  constructor() {
    super(
      'OpusSintesisPromptNotReady: el system_prompt de Opus síntesis final no está firmado. ' +
        'Founder debe revisar `lib/prompts/opus_sintesis_final.ts` y flippar OPUS_SINTESIS_FINAL_PROMPT_READY=true. ' +
        'Mientras tanto la sesión queda en status="sintetizando" y la Inngest function arroja para que reintenta.'
    );
    this.name = 'OpusSintesisPromptNotReady';
  }
}

export class SintesisValidacionError extends Error {
  readonly issues: unknown;
  constructor(issues: unknown) {
    super(
      'SintesisValidacionError: el perfil emitido por Opus no cumple PerfilDecisionFinalConsistenteSchema. ' +
        'Revisar `issues` para los paths exactos. Inngest reintentará hasta retries cap; al agotarse, ' +
        'motor marca sesión `abandonada` y deja el evento en logger.sesion.sintesisFailed.'
    );
    this.name = 'SintesisValidacionError';
    this.issues = issues;
  }
}

export class SesionNoEncontradaError extends Error {
  constructor(sesion_id: string) {
    super(`Sesión ${sesion_id} no encontrada al intentar sintetizar.`);
    this.name = 'SesionNoEncontradaError';
  }
}

// =============================================================================
// Producción opusCall — placeholder hasta firma del prompt
// =============================================================================

export const productionOpusSintesisCall: OpusSintesisCallFn = async () => {
  if (!OPUS_SINTESIS_FINAL_PROMPT_READY) {
    throw new OpusSintesisPromptNotReady();
  }
  // TODO Fase 8 wiring real: SDK Anthropic + extended thinking 8K +
  // OPUS_SINTESIS_FINAL_SYSTEM_PROMPT + tool-output schema vía z.toJSONSchema.
  // Reintento intra-llamada (1x) con error_context si Zod falla. Tras 2 fallos
  // intra-llamada se propaga SintesisValidacionError y la Inngest function
  // decide retries.
  throw new OpusSintesisPromptNotReady();
};

// =============================================================================
// buildSintesisInput — armado del payload para Opus
// =============================================================================

/**
 * Recolecta todo lo necesario para que Opus produzca el PerfilDecisionFinal.
 * Lee 5 fuentes: sesión, institución, extracciones activas, cajas declinadas,
 * casos generados. La forma final coincide con el `<input_contract>` del
 * system_prompt en lib/prompts/opus_sintesis_final.ts.
 */
export async function buildSintesisInput(sesion_id: string): Promise<SintesisInput> {
  const [sesionRow] = await db
    .select()
    .from(sesiones)
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!sesionRow) throw new SesionNoEncontradaError(sesion_id);

  const [institucionRow] = await db
    .select()
    .from(instituciones)
    .where(eq(instituciones.id, sesionRow.institucion_id))
    .limit(1);
  if (!institucionRow) {
    throw new Error(
      `Institucion ${sesionRow.institucion_id} de sesion ${sesion_id} no encontrada.`
    );
  }

  const tipo = institucionRow.tipo as TipoInstitucion;

  // CANON 49 + EXTENSION[tipo] — cajas aplicables a esta institución, cuyos
  // códigos el perfil final puede contener.
  const extension: readonly CajaCanon[] = CAJAS_EXTENSION_POR_TIPO[tipo] ?? [];
  const cajas_aplicables_codigos = [
    ...CAJAS_CANON.map((c) => c.codigo),
    ...extension.map((c) => c.codigo),
  ];

  // Extracciones activas (no superseded). Patrón espejo a
  // persistence.listarExtraccionesActivas, pero seleccionamos solo los campos
  // que Opus necesita.
  const extraccionesRows = await db
    .select({
      caja_codigo: extraccionesTable.caja_codigo,
      valor: extraccionesTable.valor,
      confianza: extraccionesTable.confianza,
      evidencia_textual: extraccionesTable.evidencia_textual,
      fuente: extraccionesTable.fuente,
    })
    .from(extraccionesTable)
    .where(
      and(eq(extraccionesTable.sesion_id, sesion_id), isNull(extraccionesTable.superseded_by))
    );

  // `intentos` = total de extracciones (incluyendo superseded) por caja_codigo.
  // Útil como señal de calidad de prompt — una caja que requirió 4 intentos
  // sugiere que la pregunta de Sonnet no aterrizó al primer intento.
  const intentosPorCaja = await db
    .select({
      caja_codigo: extraccionesTable.caja_codigo,
      total: sql<number>`count(*)::int`,
    })
    .from(extraccionesTable)
    .where(eq(extraccionesTable.sesion_id, sesion_id))
    .groupBy(extraccionesTable.caja_codigo);
  const intentosMap = new Map(intentosPorCaja.map((r) => [r.caja_codigo, r.total]));

  const extracciones: SintesisInputCajaExtraccion[] = extraccionesRows.map((r) => ({
    caja_codigo: r.caja_codigo,
    valor: r.valor,
    confianza: r.confianza,
    evidencia_textual: r.evidencia_textual,
    fuente: r.fuente as 'llm' | 'manual',
    intentos: intentosMap.get(r.caja_codigo) ?? 1,
  }));

  // Cajas declinadas con razón canónica spec v2 §6.
  const declinadasRows = await db
    .select({
      caja_codigo: cajas_declinadas.caja_codigo,
      razon: cajas_declinadas.razon,
    })
    .from(cajas_declinadas)
    .where(eq(cajas_declinadas.sesion_id, sesion_id));

  const cajasDeclinadasPayload: SintesisInputCajaDeclinada[] = declinadasRows.map((r) => ({
    caja_codigo: r.caja_codigo,
    razon: r.razon,
    intentos: intentosMap.get(r.caja_codigo) ?? 0,
  }));

  // Casos sintéticos consumidos en la sesión (cap global = 5).
  const [casosCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(casos_generados)
    .where(eq(casos_generados.sesion_id, sesion_id));
  const casos_sinteticos_aplicados = Math.min(casosCount?.n ?? 0, 5);

  // fatiga_detectada vive en sesiones.metadata.fatiga_detectada (jsonb).
  // Defensive: si la metadata aún no se materializó (sesiones que cerraron por
  // otras razones), default a false.
  const metadata = (sesionRow.metadata ?? {}) as { fatiga_detectada?: boolean };
  const fatiga_detectada = metadata.fatiga_detectada === true;

  return {
    sesion: {
      id: sesion_id,
      institucion: {
        id: institucionRow.id,
        razon_social: institucionRow.razon_social,
        nombre_comercial: institucionRow.nombre_comercial,
        tipo,
      },
      cajas_aplicables: sesionRow.cajas_aplicables,
      fatiga_detectada,
      casos_sinteticos_aplicados,
    },
    cajas_aplicables_codigos,
    extracciones,
    cajas_declinadas: cajasDeclinadasPayload,
  };
}

// =============================================================================
// generarSintesis — Opus call + Zod validation
// =============================================================================

/**
 * Llama a Opus con el SintesisInput y valida el output. Inyectable via
 * `opusCall` para tests. Si Opus arroja `OpusSintesisPromptNotReady`, propaga
 * sin reintentar localmente — la Inngest function captura y decide si la
 * sesión queda en `sintetizando` (esperando founder) o pasa a `abandonada`.
 */
export async function generarSintesis(
  input: SintesisInput,
  opusCall: OpusSintesisCallFn = productionOpusSintesisCall
): Promise<PerfilDecisionFinal> {
  const perfilRaw = await opusCall(input);

  const parsed = PerfilDecisionFinalConsistenteSchema.safeParse(perfilRaw);
  if (!parsed.success) {
    throw new SintesisValidacionError(parsed.error.issues);
  }
  return parsed.data;
}

// =============================================================================
// persistirPerfil — INSERT en perfil_decision_final con versionado
// =============================================================================

export interface PersistirPerfilResult {
  perfil_id: string;
  version: number;
}

/**
 * Persiste el perfil. `version` se autoincrementa por institución: si la
 * institución ya tenía una sesión completa con perfil, este es v2, etc.
 * Usado para auditar evoluciones (la institución reentrevistada el 2026-Q3
 * vs la versión original de 2026-Q1, por ejemplo).
 */
export async function persistirPerfil(
  perfil: PerfilDecisionFinal
): Promise<PersistirPerfilResult> {
  const [maxRow] = await db
    .select({ max_version: sql<number>`COALESCE(MAX(${perfil_decision_final.version}), 0)::int` })
    .from(perfil_decision_final)
    .where(eq(perfil_decision_final.institucion_id, perfil.institucion.id));
  const nextVersion = (maxRow?.max_version ?? 0) + 1;

  const [inserted] = await db
    .insert(perfil_decision_final)
    .values({
      institucion_id: perfil.institucion.id,
      sesion_id: perfil.sesion_id,
      version: nextVersion,
      perfil_json: perfil,
      schema_version: perfil.schema_version,
      completitud: perfil.metricas.completitud,
      confianza_global: perfil.metricas.confianza_global,
      // embedding queda null hasta v2 RAG (columna ya existe).
    })
    .returning({ id: perfil_decision_final.id });

  return { perfil_id: inserted.id, version: nextVersion };
}

// =============================================================================
// Transiciones de status
// =============================================================================

/**
 * Transiciona sesion.status a 'completa'. Guard: solo lo hace si está en
 * `sintetizando` (que es como llegó vía processSolicitarReview →
 * transicionarSesionASintetizando). Si está en otro estado, ya fue procesada
 * — no-op + log warn para investigación.
 */
export async function marcarSesionCompleta(sesion_id: string): Promise<boolean> {
  const result = await db
    .update(sesiones)
    .set({ status: 'completa' })
    .where(and(eq(sesiones.id, sesion_id), eq(sesiones.status, 'sintetizando')))
    .returning({ id: sesiones.id });
  return result.length === 1;
}

/**
 * Transiciona a `abandonada` cuando la síntesis falla terminalmente (e.g.
 * tras agotar retries de Inngest, o cuando OpusSintesisPromptNotReady deja
 * la sesión sin handler real). Guard: solo desde `sintetizando`.
 */
export async function marcarSesionAbandonada(sesion_id: string): Promise<boolean> {
  const result = await db
    .update(sesiones)
    .set({ status: 'abandonada' })
    .where(and(eq(sesiones.id, sesion_id), eq(sesiones.status, 'sintetizando')))
    .returning({ id: sesiones.id });
  return result.length === 1;
}

// =============================================================================
// Entry point
// =============================================================================

export interface ProcessSintesisResult {
  perfil_id: string;
  version: number;
  perfil: PerfilDecisionFinal;
  status_transition: 'completa' | 'noop_already_processed';
}

/**
 * Pipeline completo: build input → Opus → validar → persistir → marcar
 * completa. Errores tipados se propagan sin try/catch local — la Inngest
 * function que invoca esta función maneja retries vs abandonada según el
 * tipo de error.
 */
export async function procesarSintesisFinal(
  sesion_id: string,
  ctx: { opusCall?: OpusSintesisCallFn } = {}
): Promise<ProcessSintesisResult> {
  const input = await buildSintesisInput(sesion_id);
  const perfil = await generarSintesis(input, ctx.opusCall);
  const { perfil_id, version } = await persistirPerfil(perfil);

  const transicion = await marcarSesionCompleta(sesion_id);
  if (!transicion) {
    logger.warn('sesion.sintesis.transicion_noop', {
      sesion_id,
      reason: 'sesion no estaba en status=sintetizando al cerrar; investigar race o doble dispatch',
    });
  }

  return {
    perfil_id,
    version,
    perfil,
    status_transition: transicion ? 'completa' : 'noop_already_processed',
  };
}

// =============================================================================
// Helper: última sesión completa (para vista admin / debug)
// =============================================================================
// Útil para `lib/inngest/functions/sintetizarSesion.ts` (logging del último
// perfil) y futuras consultas. Mantiene shape DB-only.
export async function ultimoPerfilDeSesion(sesion_id: string) {
  const [row] = await db
    .select()
    .from(perfil_decision_final)
    .where(eq(perfil_decision_final.sesion_id, sesion_id))
    .orderBy(desc(perfil_decision_final.version))
    .limit(1);
  return row ?? null;
}
