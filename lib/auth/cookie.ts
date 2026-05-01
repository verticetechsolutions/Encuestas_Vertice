// Session cookie helpers. The cookie value is the opaque sesion_id (UUID); every
// gated request looks up `sesiones` by that id. No HMAC signing because the value
// is already a 128-bit unguessable identifier and the verification is a DB lookup.

import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'vertice_session';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function setSessionCookie(sesionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sesionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
