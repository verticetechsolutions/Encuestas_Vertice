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
  //
  // El header `x-pathname` se inyecta en TODA request /admin/* para que el
  // layout pueda detectar si está renderizando /admin/login (página pública)
  // y omitir `requireAdmin()` — sin esto, el layout aplicaría a /admin/login
  // y crearía un bucle de redirect infinito.
  if (path.startsWith('/admin')) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-pathname', path);
    // /admin/login y /admin/api/* nunca se redirigen aquí. El form de login
    // necesita ser público; los route handlers manejan auth ellos mismos vía
    // `adminGuardOrThrow()` y devuelven 401 JSON — un redirect 307→HTML rompe
    // a clientes fetch que esperan JSON (e.g. el command palette).
    if (path === '/admin/login' || path.startsWith('/admin/api/')) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const adminCookie = req.cookies.get(ADMIN_COOKIE);
    if (!adminCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
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
