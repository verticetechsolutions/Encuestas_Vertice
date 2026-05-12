// Índice global de sesiones — rediseño coherente con design system de
// /admin (Resumen). El server component sólo se ocupa del fetch + parse
// de status filter; toda la UI vive en SesionesView (client) que maneja
// state de búsqueda, hero reactivo, card de nav orgánico y feed cappeado
// con scroll interno.

import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { parseStatusFilter } from '@/lib/admin/parse-status-filter';
import { SesionesView } from '@/components/admin/sesiones-view';

export const dynamic = 'force-dynamic';

const HARD_LIMIT = 500;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminSesionesIndexPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeStatuses = parseStatusFilter(status);

  const rows = await db
    .select({
      sesion_id: sesiones.id,
      status: sesiones.status,
      started_at: sesiones.started_at,
      ultimo_turno_at: sesiones.ultimo_turno_at,
      cajas_llenas: sesiones.cajas_llenas_count,
      cajas_aplicables: sesiones.cajas_aplicables,
      institucion_id: instituciones.id,
      razon_social: instituciones.razon_social,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(inArray(sesiones.status, activeStatuses))
    .orderBy(desc(sesiones.ultimo_turno_at))
    .limit(HARD_LIMIT + 1);

  const truncated = rows.length > HARD_LIMIT;
  const visible = truncated ? rows.slice(0, HARD_LIMIT) : rows;

  return (
    <SesionesView
      rows={visible}
      activeStatuses={activeStatuses}
      truncated={truncated}
      hardLimit={HARD_LIMIT}
      hasExplicitFilter={status !== undefined}
    />
  );
}
