// Route Handler — verifies magic-link token + sets session cookie + redirects.
// We use a Route Handler (not a Server Component page) because Next 15 only allows
// cookie WRITES inside Server Actions or Route Handlers; calling cookies().set()
// during a Server Component render throws "Cookies can only be modified in a Server
// Action or Route Handler".

import { NextResponse, type NextRequest } from 'next/server';
import { verificarMagicLink } from '@/app/actions/auth';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security/rate-limit';
import { logger } from '@/lib/observability/axiom';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit per-IP. Magic tokens son base64url 24 bytes (192 bits) —
  // brute force es computacionalmente infeasible incluso sin cap, pero
  // el cap evita amplificación + protege contra patrones de scraping
  // automatizado de URLs sospechosas. 10/min/IP da 5-10 reintentos
  // genuinos antes de bloquear.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`acceso:ip:${ip}`, RATE_LIMITS.accesoPerIp);
  if (!rl.allowed) {
    logger.warn('acceso.rate_limit', { ip, retry_after_s: rl.retryAfterSeconds });
    // Redirect a expirado con razón especial — ya tenemos la página
    // /acceso/expirado preparada para mostrar mensaje al usuario.
    const fail = new URL('/acceso/expirado?razon=rate_limited', req.url);
    const res = NextResponse.redirect(fail);
    res.headers.set('Retry-After', String(rl.retryAfterSeconds));
    return res;
  }

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
