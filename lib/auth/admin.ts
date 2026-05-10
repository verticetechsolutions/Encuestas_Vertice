// Admin panel auth — separada del flujo entrevistado.
//
// Diseño MVP: una sola "credencial" compartida por el equipo Vértice
// (`ADMIN_PANEL_TOKEN` en el env). El founder visita `/admin/login?t=<token>`,
// el route handler valida y setea cookie `vertice_admin` con el mismo valor.
// Toda página `/admin/*` valida que la cookie matchee el env.
//
// Por qué no magic link como entrevistado:
//   - No depende de Resend (founder pidió sin keys).
//   - Audiencia fija (equipo interno), token rotable cambiando env var.
//   - Trade-off aceptado: si el token leak, hay que rotarlo en Vercel.
//
// Producción puede luego pivotar a OAuth/SSO sin tocar el contrato de
// `requireAdmin()` — sólo la implementación interna. El plan completo
// (provider, scope, mapping, domain whitelist, convivencia con magic
// link) está documentado en IMPLEMENTATION.md §19 "Google SSO real".

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_COOKIE = 'vertice_admin';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function getAdminPanelToken(): string | null {
  const t = process.env.ADMIN_PANEL_TOKEN;
  if (!t || t.trim().length === 0) return null;
  return t;
}

export async function setAdminCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export async function readAdminCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value;
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

// Constant-time string compare. Para evitar timing attacks sobre el token
// (poco realista en este contexto, pero el costo es trivial).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = getAdminPanelToken();
  if (!expected) return false; // env no configurado → admin deshabilitado
  const cookieValue = await readAdminCookie();
  if (!cookieValue) return false;
  return safeEqual(expected, cookieValue);
}

// Server-component guard. Llamar al inicio de cada page.tsx en /admin/*.
// Si no está autenticado, redirige a /admin/login. NO usar en route handlers
// que sirven JSON — esos deben retornar 401/403 manualmente.
export async function requireAdmin(): Promise<void> {
  const ok = await isAdminAuthenticated();
  if (!ok) redirect('/admin/login');
}

// Para route handlers — boolean check sin redirect.
export async function adminGuardOrThrow(): Promise<void> {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new Error('admin_unauthorized');
}

// Validación del token enviado por el usuario al endpoint de login. Compara
// contra el env via constant-time. Útil para que el route handler decida si
// setear la cookie o rechazar.
export function validateAdminTokenInput(input: string): boolean {
  const expected = getAdminPanelToken();
  if (!expected) return false;
  if (!input || input.length === 0) return false;
  return safeEqual(expected, input);
}
