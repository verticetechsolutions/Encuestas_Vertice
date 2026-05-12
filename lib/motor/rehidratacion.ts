// Rehidratación server-side de /entrevista al reload (fix bug O1 doc
// bugs-encontrados-2026-05-11-e2e.md §O1).
//
// Antes: el shell siempre cargaba PRIMER_BATCH_BIENVENIDA hardcoded en mount,
// ignorando los turnos ya persistidos. Tras 5 cajas respondidas, un reload
// devolvía al usuario a la pregunta de bienvenida.
//
// Ahora: el route handler `generar_batch_preguntas` persiste el batch emitido
// en `sesiones.metadata.ultimo_batch` con el numero_turno_emitido. En reload,
// el server component lee ese metadata + computa el snapshot de
// llenas_por_grupo desde extracciones+declinadas, y se lo pasa al shell.
//
// Freshness check: el batch persistido solo se considera FRESCO si el último
// turno del agente en DB coincide con `numero_turno_emitido`. Si Sonnet
// re-respondió en un turno posterior sin emitir batch (e.g. solo
// registrar_extraccion + stop), el batch persistido es STALE y devolvemos
// null — el shell cae al fallback de `cargarPrimerBatch`.

import { sql, eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, turnos_conversacion } from '@/db/schema';
import {
  UltimoBatchSchema,
  type PreguntaBatch,
} from '@/lib/schemas/pregunta-batch';
import {
  listarExtraccionesActivas,
  listarCajasDeclinadas,
} from '@/lib/motor/persistence';
import {
  computeMapaIncertidumbre,
  computeLlenasPorGrupo,
} from '@/lib/motor/mapa';
import {
  getCajasAplicables,
  type GrupoUI,
} from '@/lib/schemas/cajas';
import type { instituciones } from '@/db/schema';
import { logger } from '@/lib/observability/axiom';

export interface RehidratacionPayload {
  /**
   * Batch fresco del último turno agente. `null` cuando aún no se emitió un
   * batch via /api/turn (sesión nueva en PRIMER_BATCH_BIENVENIDA) o cuando el
   * batch persistido está stale (último turno agente no coincide). El shell
   * cae al fallback `cargarPrimerBatch` cuando es null.
   */
  batch: PreguntaBatch | null;
  llenas_por_grupo: Record<GrupoUI, number>;
  /**
   * Drafts autosaved en `metadata.borrador_respuestas`. Se devuelven SIEMPRE,
   * incluso cuando `batch` es null — necesario para preservar la respuesta
   * del usuario al PRIMER_BATCH antes de mandar el primer turn al motor (sin
   * esto, F5 borra el draft del Q1 hardcoded de bienvenida).
   */
  drafts: Record<string, string>;
}

interface CargarArgs {
  sesion_id: string;
  tipo: typeof instituciones.$inferSelect.tipo;
}

/**
 * Carga el estado de rehidratación desde DB. Siempre devuelve un payload con
 * `llenas_por_grupo` + `drafts`; `batch` puede ser null si todavía no hubo
 * primer turn o si el batch persistido es stale.
 */
export async function cargarRehidratacion(
  args: CargarArgs
): Promise<RehidratacionPayload> {
  const { sesion_id, tipo } = args;

  // 1. Leer metadata de la sesión: ultimo_batch + borrador_respuestas.
  const [meta] = await db
    .select({
      ultimo_batch: sql<unknown>`${sesiones.metadata} -> 'ultimo_batch'`,
      borrador: sql<Record<string, string> | null>`${sesiones.metadata} -> 'borrador_respuestas'`,
    })
    .from(sesiones)
    .where(eq(sesiones.id, sesion_id))
    .limit(1);

  // 2. Drafts (siempre que existan). Preservados aunque no haya batch.
  const drafts: Record<string, string> = {};
  if (meta?.borrador && typeof meta.borrador === 'object') {
    for (const [pid, texto] of Object.entries(meta.borrador)) {
      if (typeof texto === 'string') drafts[pid] = texto;
    }
  }

  // 3. Computar llenas_por_grupo desde extracciones activas + declinadas.
  //    Mismo cálculo que /api/turn hace post-extracción para el panel live.
  const cajasAplicables = getCajasAplicables(tipo);
  const [activas, declinadas] = await Promise.all([
    listarExtraccionesActivas(sesion_id),
    listarCajasDeclinadas(sesion_id),
  ]);
  const mapa = computeMapaIncertidumbre(activas, cajasAplicables, declinadas);
  const llenas_por_grupo = computeLlenasPorGrupo(mapa.cajas);

  // 4. Si no hay ultimo_batch, devolvemos sin batch — el shell hará
  //    cargarPrimerBatch y los drafts del PRIMER_BATCH se preservan via init.
  if (!meta?.ultimo_batch) {
    return { batch: null, llenas_por_grupo, drafts };
  }

  // 5. Validar shape contra Zod. Si la DB tiene basura, batch null.
  const parsed = UltimoBatchSchema.safeParse(meta.ultimo_batch);
  if (!parsed.success) {
    logger.warn('rehidratacion.ultimo_batch_invalido', {
      sesion_id,
      error: parsed.error.message,
    });
    return { batch: null, llenas_por_grupo, drafts };
  }
  const ultimo = parsed.data;

  // 6. Freshness: el batch debe corresponder al último turno agente. Si el
  //    último turno es usuario o un agente posterior sin batch, batch null.
  const [latestAgent] = await db
    .select({ numero_turno: turnos_conversacion.numero_turno })
    .from(turnos_conversacion)
    .where(
      and(
        eq(turnos_conversacion.sesion_id, sesion_id),
        eq(turnos_conversacion.rol, 'agente')
      )
    )
    .orderBy(desc(turnos_conversacion.numero_turno))
    .limit(1);

  if (!latestAgent || latestAgent.numero_turno !== ultimo.numero_turno_emitido) {
    logger.info('rehidratacion.batch_stale', {
      sesion_id,
      numero_turno_emitido: ultimo.numero_turno_emitido,
      ultimo_agent_numero: latestAgent?.numero_turno ?? null,
    });
    return { batch: null, llenas_por_grupo, drafts };
  }

  return { batch: ultimo.batch, llenas_por_grupo, drafts };
}
