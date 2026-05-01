import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

// Cheap gate: redirect if there's no session cookie. Full validation (cookie value
// matches a real sesion_id, consentimiento_at non-null, etc.) lives in the page —
// the middleware just keeps cookieless traffic out without touching the DB.
export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/acceso/expirado';
    url.searchParams.set('razon', 'sin_sesion');
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/entrevista/:path*'],
};
