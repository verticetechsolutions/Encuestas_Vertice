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
  batch: PreguntaBatch;
  llenas_por_grupo: Record<GrupoUI, number>;
  drafts: Record<string, string>;
}

interface CargarArgs {
  sesion_id: string;
  tipo: typeof instituciones.$inferSelect.tipo;
}

/**
 * Carga el estado de rehidratación desde DB. Devuelve null si no hay batch
 * persistido o si el batch es stale (no corresponde al último turno agente).
 */
export async function cargarRehidratacion(
  args: CargarArgs
): Promise<RehidratacionPayload | null> {
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

  if (!meta?.ultimo_batch) return null;

  // 2. Validar shape del ultimo_batch contra Zod. Si la DB tiene basura
  //    (versión vieja del producto, jsonb corrupto), preferimos fallback
  //    silencioso a fallar el render del page.
  const parsed = UltimoBatchSchema.safeParse(meta.ultimo_batch);
  if (!parsed.success) {
    logger.warn('rehidratacion.ultimo_batch_invalido', {
      sesion_id,
      error: parsed.error.message,
    });
    return null;
  }
  const ultimo = parsed.data;

  // 3. Freshness: el batch debe corresponder al último turno agente. Si el
  //    último turno es usuario o un agente posterior sin batch, esta es stale.
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
    return null;
  }

  // 4. Computar llenas_por_grupo desde extracciones activas + declinadas.
  //    Mismo cálculo que /api/turn hace post-extracción para el panel live.
  const cajasAplicables = getCajasAplicables(tipo);
  const [activas, declinadas] = await Promise.all([
    listarExtraccionesActivas(sesion_id),
    listarCajasDeclinadas(sesion_id),
  ]);
  const mapa = computeMapaIncertidumbre(activas, cajasAplicables, declinadas);
  const llenas_por_grupo = computeLlenasPorGrupo(mapa.cajas);

  // 5. Drafts del usuario para preguntas en el batch. Filtramos al hidratar
  //    en el store por seguridad (drop drafts de batches anteriores).
  const drafts: Record<string, string> = {};
  if (meta.borrador && typeof meta.borrador === 'object') {
    for (const [pid, texto] of Object.entries(meta.borrador)) {
      if (typeof texto === 'string') drafts[pid] = texto;
    }
  }

  return {
    batch: ultimo.batch,
    llenas_por_grupo,
    drafts,
  };
}
