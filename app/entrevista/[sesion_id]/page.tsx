import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { readSessionCookie } from '@/lib/auth/cookie';
import {
  CAJAS_CANON,
  CAJAS_EXTENSION_POR_TIPO,
  GrupoUISchema,
  type GrupoUI,
} from '@/lib/schemas/cajas';
import { cargarRehidratacion } from '@/lib/motor/rehidratacion';
import { EntrevistaShell } from './entrevista-shell';

interface Props {
  params: Promise<{ sesion_id: string }>;
}

// Totals per grupo_ui derived from CAJAS_CANON + extension[tipo]. The shell
// uses these as the denominator for the right-hand progress panel.
function computeTotalesPorGrupo(
  tipo: typeof instituciones.$inferSelect.tipo
): Record<GrupoUI, number> {
  const out = {} as Record<GrupoUI, number>;
  for (const g of GrupoUISchema.options) out[g] = 0;
  for (const c of CAJAS_CANON) out[c.grupo_ui]++;
  for (const c of CAJAS_EXTENSION_POR_TIPO[tipo] ?? []) out[c.grupo_ui]++;
  return out;
}

// Server Component for the entrevista. Validates cookie ↔ sesion_id ↔
// consentimiento_at, then hands off to the client shell with the data the
// client needs (institution name + totales por grupo). The shell carga el
// PRIMER_BATCH_BIENVENIDA hardcoded (identidad institucional) en mount; los
// batches subsecuentes los emite Sonnet vía /api/turn. Modo preview (sandbox
// de diseño) sigue cargando el fixture mock para QA visual.
export default async function EntrevistaPage({ params }: Props) {
  const { sesion_id } = await params;
  const cookie = await readSessionCookie();
  if (cookie !== sesion_id) redirect('/acceso/expirado?razon=sin_sesion');

  const [row] = await db
    .select({
      consentimiento_at: sesiones.consentimiento_at,
      status: sesiones.status,
      razon_social: instituciones.razon_social,
      nombre_comercial: instituciones.nombre_comercial,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!row) redirect('/acceso/expirado?razon=sin_sesion');
  if (!row.consentimiento_at) redirect(`/entrevista/${sesion_id}/bienvenida`);

  const nombre_institucion = row.nombre_comercial ?? row.razon_social;
  const totales_por_grupo = computeTotalesPorGrupo(row.tipo);

  // Rehidratación O1: si Sonnet ya emitió un batch en esta sesión y el último
  // turno agente coincide, lo cargamos server-side y se lo pasamos al shell
  // como estado inicial. Null si no hay batch persistido o si es stale.
  const rehidratacion = await cargarRehidratacion({
    sesion_id,
    tipo: row.tipo,
  });

  return (
    <EntrevistaShell
      sesion_id={sesion_id}
      nombre_institucion={nombre_institucion}
      totales_por_grupo={totales_por_grupo}
      rehidratacion={rehidratacion}
    />
  );
}
