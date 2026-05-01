// Route Handler — verifies magic-link token + sets session cookie + redirects.
// We use a Route Handler (not a Server Component page) because Next 15 only allows
// cookie WRITES inside Server Actions or Route Handlers; calling cookies().set()
// during a Server Component render throws "Cookies can only be modified in a Server
// Action or Route Handler".

import { NextResponse, type NextRequest } from 'next/server';
import { verificarMagicLink } from '@/app/actions/auth';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const outcome = await verificarMagicLink(token);

  if (outcome.ok) {
    const target = new URL(`/entrevista/${outcome.sesion_id}/bienvenida`, req.url);
    const res = NextResponse.redirect(target);
    res.cookies.set(SESSION_COOKIE, outcome.sesion_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: THIRTY_DAYS_SECONDS,
    });
    return res;
  }

  const fail = new URL(`/acceso/expirado?razon=${outcome.razon}`, req.url);
  return NextResponse.redirect(fail);
}
