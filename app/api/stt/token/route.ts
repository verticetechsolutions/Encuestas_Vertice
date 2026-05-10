// Mints an ephemeral Deepgram JWT for the browser to open a streaming socket.
// The real DEEPGRAM_API_KEY never leaves the server.
//
// Auth: requires a session cookie that maps to a non-closed `sesiones` row.
// The middleware in /middleware.ts already filters cookieless traffic for
// /entrevista/*; this endpoint is also reachable from the demo page so we
// re-validate on the server. No DB write, just a SELECT.

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { readSessionCookie } from '@/lib/auth/cookie';
import { db } from '@/lib/db';
import { sesiones } from '@/db/schema';
import { grantEphemeralToken } from '@/lib/stt/client';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security/rate-limit';
import { checkSameOrigin } from '@/lib/security/csrf';
import { logger } from '@/lib/observability/axiom';

const TOKEN_TTL_SECONDS = 60;

export async function POST(req: Request): Promise<NextResponse> {
  // CSRF gate: same-origin obligatorio.
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    logger.warn('stt.csrf_rechazado', { error: csrf.error });
    return NextResponse.json(
      { error: 'forbidden_origin', message: csrf.error },
      { status: 403 }
    );
  }

  const cookie = await readSessionCookie();
  if (!cookie) {
    return NextResponse.json({ error: 'sin_sesion' }, { status: 401 });
  }

  // Rate limit per-sesion. 20/min cubre reconexiones razonables; bloquea
  // loops del cliente que pidan token continuamente. Catch-all per-IP no
  // hace falta acá porque ya se requiere cookie de sesión válida.
  const rl = checkRateLimit(`stt:sesion:${cookie}`, RATE_LIMITS.sttPerSesion);
  if (!rl.allowed) {
    const ip = getClientIp(req);
    logger.warn('stt.rate_limit', {
      sesion_id: cookie,
      ip,
      retry_after_s: rl.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const [row] = await db
    .select({ id: sesiones.id, status: sesiones.status })
    .from(sesiones)
    .where(eq(sesiones.id, cookie))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'sesion_no_encontrada' }, { status: 401 });
  }
  if (row.status === 'completa' || row.status === 'abandonada') {
    return NextResponse.json({ error: 'sesion_cerrada' }, { status: 401 });
  }

  try {
    const token = await grantEphemeralToken(TOKEN_TTL_SECONDS);
    return NextResponse.json({
      access_token: token.access_token,
      expires_in: token.expires_in,
    });
  } catch {
    // Mantener mensaje genérico hacia el browser; el detalle queda en logs.
    return NextResponse.json({ error: 'token_grant_failed' }, { status: 502 });
  }
}
