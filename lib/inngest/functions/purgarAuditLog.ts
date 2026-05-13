// Inngest cron function que aplica la retention policy de `audit_admin_actions`
// (deuda #7 cerrada 2026-05-13).
//
// Política:
//   - Acciones tipo `auth.*` o `exports.*` o `login*` → 90 días.
//   - Resto (incluye `*.crear`, `*.editar`, `*.eliminar`, `*.revocar`,
//     `magic_links.*`, etc.) → 1 año (365 días).
//   El criterio es: las acciones destructivas o de mutación se conservan más
//   tiempo porque pueden requerir forensics (compliance, disputas, postmortems).
//   Las lecturas y logins se purgan antes porque son alto volumen y bajo
//   valor forensico individual.
//
// Schedule: diario a las 03:00 UTC (21:00 CDMX). Hora baja de tráfico para
// minimizar contention con queries activas del panel admin.
//
// Implementación:
//   - DELETE batched de 1000 rows a la vez (CTE con LIMIT) para no bloquear
//     queries activas con un DELETE masivo. Si hay >1000 rows expiradas, el
//     próximo run del cron los limpia.
//   - Idempotente: si no hay rows expiradas, el DELETE no hace nada.
//   - Logging Axiom: emitimos un evento por run con el conteo de filas borradas
//     por bucket (corto vs largo).

import { sql } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/observability/axiom';

// TTL por bucket en días. Cambios aquí no requieren migración.
const RETENTION_SHORT_DAYS = 90; // auth.*, exports.*, login*
const RETENTION_LONG_DAYS = 365; // resto

// Batch size del DELETE. 1000 evita lock contention con queries del panel.
const DELETE_BATCH_SIZE = 1000;

interface PurgeBucketResult {
  bucket: 'short' | 'long';
  deletedRows: number;
}

async function purgeBucket(
  bucket: 'short' | 'long',
  ttlDays: number
): Promise<PurgeBucketResult> {
  // Las acciones del bucket "short" matchean prefijos. El resto entra al "long".
  // Usamos OR de LIKEs en lugar de regex para que el planner pueda usar el
  // index (action, created_at) escaneando rangos contiguos.
  const shortPredicate = sql`(
    "action" LIKE 'auth.%'
    OR "action" LIKE 'exports.%'
    OR "action" LIKE 'login%'
  )`;
  const actionPredicate = bucket === 'short' ? shortPredicate : sql`NOT ${shortPredicate}`;

  const result = await db.execute(sql`
    WITH expired AS (
      SELECT id FROM audit_admin_actions
      WHERE ${actionPredicate}
        AND created_at < NOW() - (${ttlDays} || ' days')::interval
      ORDER BY created_at
      LIMIT ${DELETE_BATCH_SIZE}
    )
    DELETE FROM audit_admin_actions
    WHERE id IN (SELECT id FROM expired)
    RETURNING id
  `);

  // postgres-js returns rows as `result` or `result.rows` depending on the
  // statement. Use both as fallback for safety.
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
  return { bucket, deletedRows: rows.length };
}

export const purgarAuditLog = inngest.createFunction(
  {
    id: 'purgar-audit-log',
    triggers: [{ cron: '0 3 * * *' }], // diario 03:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    const short = await step.run('purge-short-retention', () =>
      purgeBucket('short', RETENTION_SHORT_DAYS)
    );
    const long = await step.run('purge-long-retention', () =>
      purgeBucket('long', RETENTION_LONG_DAYS)
    );

    logger.info('inngest.purgar_audit_log.ok', {
      short_deleted: short.deletedRows,
      long_deleted: long.deletedRows,
      short_ttl_days: RETENTION_SHORT_DAYS,
      long_ttl_days: RETENTION_LONG_DAYS,
      batch_size: DELETE_BATCH_SIZE,
    });

    return {
      short_deleted: short.deletedRows,
      long_deleted: long.deletedRows,
    };
  }
);
