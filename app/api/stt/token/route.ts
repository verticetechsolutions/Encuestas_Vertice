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

// Pin la función a us-east-1 (iad1). Neon (us-east-1) + Deepgram (us-east-1
// default) viven ahí; sin pin, Vercel puede arrancar la Fluid Compute en
// gru1/cdg1 y pagás ~80-200ms transatlántico por hop (DB SELECT + Deepgram
// grant son ambos serial en este endpoint). El cliente conecta vía Vercel
// edge igual de cerca, así que el round-trip user → edge no cambia.
export const preferredRegion = 'iad1';
export const runtime = 'nodejs';

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
  // Dev bypass: la ruta /preview/ui no tiene cookie de sesión real porque
  // vive fuera del flujo magic-link → /entrevista. En dev, si no hay cookie,
  // saltamos validación de DB para que el preview pueda probar el botón de
  // dictado. NODE_ENV=development NO se cumple en deploys de Vercel (ni
  // preview ni production), solo en local — no abre puerta de produccion.
  const isDevPreview =
    process.env.NODE_ENV === 'development' && !cookie;
  if (!cookie && !isDevPreview) {
    return NextResponse.json({ error: 'sin_sesion' }, { status: 401 });
  }

  // Rate limit. En dev preview usamos IP como clave (no hay sesion_id real).
  // En prod la cookie ya garantiza identidad, así que la key es sesion-bound.
  const ip = getClientIp(req);
  const rlKey = cookie ? `stt:sesion:${cookie}` : `stt:dev-preview:${ip}`;
  const rl = await checkRateLimit(rlKey, RATE_LIMITS.sttPerSesion);
  if (!rl.allowed) {
    logger.warn('stt.rate_limit', {
      sesion_id: cookie ?? '(dev-preview)',
      ip,
      retry_after_s: rl.retryAfterSeconds,
    });
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  // En dev preview no validamos contra DB (no hay sesion_id real). En prod,
  // verificamos que la cookie apunte a una sesion abierta.
  if (cookie) {
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
  } else if (isDevPreview) {
    logger.info('stt.dev_preview_token_grant', { ip });
  }

  try {
    const token = await grantEphemeralToken(TOKEN_TTL_SECONDS);
    return NextResponse.json({
      access_token: token.access_token,
      expires_in: token.expires_in,
    });
  } catch (err) {
    // Mantener mensaje genérico hacia el browser; el detalle queda en logs.
    // Sin esto el debug es ciego: el frontend solo ve `token_grant_failed` y
    // el origen real (403 de Deepgram por scope, network, etc.) se pierde.
    logger.error('stt.token_grant_failed', {
      sesion_id: cookie,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'token_grant_failed' }, { status: 502 });
  }
}
