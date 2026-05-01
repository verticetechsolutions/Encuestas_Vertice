import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readSessionCookie } from '@/lib/auth/cookie';

interface Props {
  params: Promise<{ sesion_id: string }>;
}

// Placeholder para el motor (Fase 5). Por ahora valida cookie + consentimiento y
// renderiza un confirm visual de que el flujo de auth funciona end-to-end.
export default async function EntrevistaPage({ params }: Props) {
  const { sesion_id } = await params;
  const cookie = await readSessionCookie();
  if (cookie !== sesion_id) redirect('/acceso/expirado?razon=sin_sesion');

  const [row] = await db
    .select({
      consentimiento_at: sesiones.consentimiento_at,
      cajas_aplicables: sesiones.cajas_aplicables,
      status: sesiones.status,
      razon_social: instituciones.razon_social,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!row) redirect('/acceso/expirado?razon=sin_sesion');
  if (!row.consentimiento_at) redirect(`/entrevista/${sesion_id}/bienvenida`);

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{row.razon_social}</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Sesión <code style={{ fontSize: 13 }}>{sesion_id}</code> · {row.cajas_aplicables} cajas aplicables · status: {row.status}
      </p>
      <section style={{ background: '#fefce8', border: '1px solid #fde047', padding: 24, borderRadius: 8 }}>
        <p style={{ margin: 0, color: '#713f12' }}>
          <strong>Placeholder Fase 4.</strong> El motor conversacional entra en Fase 5.
          Auth + consentimiento + cookie funcionan correctamente — esto comprueba el end-to-end.
        </p>
      </section>
    </main>
  );
}
