// Catálogo de instituciones — pivot principal del admin. Server component
// hace el fetch agregado (sesiones + perfiles via subqueries) y delega la
// UI a InstitucionesView (client) que incluye hero KPI, card de navegación
// orgánico con searchbar + CTA, y feed cappeado con scroll interno.

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  InstitucionesView,
  type InstitucionRow,
} from '@/components/admin/instituciones-view';

export const dynamic = 'force-dynamic';

async function fetchInstituciones(): Promise<InstitucionRow[]> {
  // SQL crudo para subquery agregada — Drizzle requiere CTEs para esto y se
  // alarga; sql crudo es más legible. Postgres-js parsea timestamps a Date
  // automáticamente cuando vienen como columna timestamptz.
  const result = await db.execute(sql`
    SELECT
      i.id,
      i.razon_social,
      i.nombre_comercial,
      i.tipo::text AS tipo,
      i.email_contacto,
      i.created_at,
      COALESCE(s.total_sesiones, 0)::int AS total_sesiones,
      s.ultimo_turno_at,
      COALESCE(p.total_perfiles, 0)::int AS total_perfiles
    FROM instituciones i
    LEFT JOIN (
      SELECT institucion_id,
             count(*) AS total_sesiones,
             max(ultimo_turno_at) AS ultimo_turno_at
      FROM sesiones
      GROUP BY institucion_id
    ) s ON s.institucion_id = i.id
    LEFT JOIN (
      SELECT institucion_id, count(*) AS total_perfiles
      FROM perfil_decision_final
      GROUP BY institucion_id
    ) p ON p.institucion_id = i.id
    ORDER BY i.created_at DESC
  `);
  return result as unknown as InstitucionRow[];
}

export default async function AdminInstitucionesPage() {
  const rows = await fetchInstituciones();
  return <InstitucionesView rows={rows} />;
}
