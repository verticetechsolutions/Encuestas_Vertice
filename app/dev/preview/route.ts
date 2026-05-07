// Dev-only bypass para previsualizar el shell de entrevista sin pelearse con
// el flujo de magic link (single-use → consumido al primer click → segunda
// visita 307 a /acceso/expirado).
//
// Garantías:
//   - Devuelve 404 si NODE_ENV === 'production'.
//   - NO crea instituciones/sesiones nuevas — toma la sesión `abierta` más
//     reciente. Si no existe ninguna, 404.
//   - Setea consentimiento_at = NOW() si era NULL (idempotente).
//   - Setea cookie vertice_session = sesion_id y redirige a /entrevista/{id}.
//
// NUNCA expongas esta ruta en producción. Vive bajo /app/dev/* que documentamos
// como sandbox dev-only en IMPLEMENTATION.md.
//
// Uso:
//   - Crear una sesión cualquiera (e.g. `npx tsx scripts/invitar.ts ... --dry-run`)
//     y luego abrir http://localhost:3000/dev/preview en cualquier navegador.

import { NextResponse, type NextRequest } from 'next/server';
import { sql, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones } from '@/db/schema';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const [sesion] = await db
    .select({ id: sesiones.id, consentimiento_at: sesiones.consentimiento_at })
    .from(sesiones)
    .where(sql`${sesiones.status} = 'abierta'`)
    .orderBy(desc(sesiones.started_at))
    .limit(1);

  if (!sesion) {
    return new NextResponse(
      'No hay sesiones abiertas. Corre `npx tsx scripts/invitar.ts --razon-social "X" --tipo banco --email x@y.z --dry-run` primero.',
      { status: 404 }
    );
  }

  if (!sesion.consentimiento_at) {
    await db
      .update(sesiones)
      .set({ consentimiento_at: new Date() })
      .where(sql`${sesiones.id} = ${sesion.id}`);
  }

  const target = new URL(`/entrevista/${sesion.id}`, req.url);
  const res = NextResponse.redirect(target);
  res.cookies.set(SESSION_COOKIE, sesion.id, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
  return res;
}
