// Catálogo de instituciones — pivot principal del admin.
//
// Performance: el page wrappea el data-fetch en `<Suspense>` para que el
// shell (header + skeleton) llegue al cliente INMEDIATAMENTE en cada
// navegación. El RSC chunk con los datos reales fluye después por streaming.
// Patrón canónico Vercel/Linear/Resend.

import { Suspense } from 'react';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  InstitucionesView,
  type InstitucionRow,
} from '@/components/admin/instituciones-view';
import { ListPageSkeleton } from '@/components/admin/loading-skeleton';

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
      i.telefono_contacto,
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

async function InstitucionesContent() {
  const rows = await fetchInstituciones();
  return <InstitucionesView rows={rows} />;
}

export default function AdminInstitucionesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InstitucionesContent />
    </Suspense>
  );
}
