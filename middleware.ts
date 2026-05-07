import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { ADMIN_COOKIE } from '@/lib/auth/admin';

// Cheap cookie-presence gate. Full validation (cookie value matches a real
// sesion_id / valid admin token, consentimiento_at non-null, etc.) vive en la
// página — el middleware solo descarta tráfico sin cookie sin tocar la DB.
//
// `/admin/login` está intencionalmente fuera del matcher para que el form de
// login sea accesible sin cookie previa.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Admin gate: presencia de la cookie. La validación contra ADMIN_PANEL_TOKEN
  // ocurre en `requireAdmin()` server-side — el middleware sólo evita que
  // tráfico sin cookie llegue a las páginas admin.
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const adminCookie = req.cookies.get(ADMIN_COOKIE);
    if (!adminCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Entrevista gate (preexistente).
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
  matcher: ['/entrevista/:path*', '/admin/:path*'],
};
