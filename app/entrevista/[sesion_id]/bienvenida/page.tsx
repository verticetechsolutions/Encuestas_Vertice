import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { readSessionCookie } from '@/lib/auth/cookie';
import { ConsentimientoForm } from './consentimiento-form';

interface Props {
  params: Promise<{ sesion_id: string }>;
}

// Bienvenida + LFPDPPP consent. Cookie must be set (the cookie matches `sesion_id`
// from the URL — anything else is treated as a stale link). If the user already gave
// consent for this sesión, skip straight to the entrevista.
export default async function BienvenidaPage({ params }: Props) {
  const { sesion_id } = await params;
  const cookie = await readSessionCookie();
  if (cookie !== sesion_id) {
    redirect(`/acceso/expirado?razon=sin_sesion`);
  }

  const [row] = await db
    .select({
      sesion_id: sesiones.id,
      consentimiento_at: sesiones.consentimiento_at,
      razon_social: instituciones.razon_social,
      nombre_comercial: instituciones.nombre_comercial,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!row) redirect('/acceso/expirado?razon=sin_sesion');

  if (row.consentimiento_at) {
    redirect(`/entrevista/${sesion_id}`);
  }

  const nombreMostrado = row.nombre_comercial ?? row.razon_social;

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Bienvenido, {nombreMostrado}</h1>
      <p style={{ color: '#444', marginBottom: 32, lineHeight: 1.6 }}>
        Vamos a hacerte una entrevista guiada por IA para construir tu perfil de criterios crediticios.
        Toma entre 30 y 45 minutos. Puedes pausar cuando quieras y retomar después con el mismo enlace.
      </p>

      <section style={{ background: '#f6f6f5', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Aviso de privacidad (LFPDPPP)</h2>
        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 8 }}>
          Vértice recolecta los datos que nos compartas durante esta entrevista —
          nombre comercial, criterios de crédito, contactos operativos — exclusivamente
          para construir el perfil de decisión crediticia de tu institución y operar
          el matching con solicitantes en plataformas aliadas.
        </p>
        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 8 }}>
          No compartiremos los datos identificables con terceros sin tu autorización
          previa. Puedes ejercer tus derechos ARCO escribiendo a contacto@verticemexico.com.
        </p>
        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          La transcripción y los datos extraídos se almacenan en una base de datos cifrada
          en Neon (Frankfurt y N. Virginia). Las llamadas al modelo conversacional
          (Anthropic Claude) y al transcriptor (Deepgram) operan bajo acuerdo de no-retención
          de datos. Al continuar, manifiestas que tienes facultades para representar a
          tu institución y otorgas el consentimiento para este tratamiento.
        </p>
      </section>

      <ConsentimientoForm sesion_id={sesion_id} />
    </main>
  );
}
