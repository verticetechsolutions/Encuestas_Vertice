// Admin panel auth — refactored Sprint 1 security audit 2026-05-12.
//
// ANTES: un solo token compartido (`ADMIN_PANEL_TOKEN` env) sin per-user,
// sin audit log.
//
// AHORA: Auth.js v6 (Google SSO) + tabla `usuarios` con role='admin'.
// Decisión de admin = usuario logueado vía Google con dominio
// @verticemexico.com (hardcoded en lib/auth/usuarios.ts).
//
// Emergency fallback:
//   El `ADMIN_PANEL_TOKEN` queda activo SOLO si la env `ADMIN_EMERGENCY_MODE=1`
//   está seteada. Sin esa flag, el token compartido no se acepta — toda la
//   auth pasa por Google. Mantenemos el fallback para incidents donde Google
//   esté caído o las credenciales OAuth se hayan revocado.
//
// API preservada:
//   requireAdmin(), isAdminAuthenticated(), adminGuardOrThrow(),
//   validateAdminTokenInput(), setAdminCookie(), clearAdminCookie(),
//   getAdminPanelToken() — todos siguen funcionando. Lo que cambió es la
//   implementación interna de isAdminAuthenticated().

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const ADMIN_COOKIE = 'vertice_admin';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/** Token compartido legacy (emergency fallback). NO usar en producción
 *  rutinaria — Google SSO es la vía canónica. */
export function getAdminPanelToken(): string | null {
  const t = process.env.ADMIN_PANEL_TOKEN;
  if (!t || t.trim().length === 0) return null;
  return t;
}

/** Indica si el emergency mode está habilitado vía env. */
function isEmergencyModeEnabled(): boolean {
  return process.env.ADMIN_EMERGENCY_MODE === '1';
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

/**
 * Decide si el caller es admin. Prioridad:
 *   1. Auth.js session con role='admin' → admin.
 *   2. Si ADMIN_EMERGENCY_MODE=1: validar cookie `vertice_admin` vs env.
 *   3. Caso contrario: false.
 *
 * Importante: NO cortocircuita en el emergency mode si Google session falla,
 * por orden de evaluación: primero Google, si no admin → si emergency, fallback.
 * Esto permite que un usuario logueado vía Google con role!='admin' NO
 * se promueva por tener cookie del emergency token (defensa en profundidad).
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  // Path canónica: Google SSO + role en DB.
  const session = await auth();
  if (session?.user?.role === 'admin') return true;

  // Fallback solo si Google session NO admin Y emergency mode habilitado.
  if (isEmergencyModeEnabled()) {
    const expected = getAdminPanelToken();
    if (!expected) return false;
    const cookieValue = await readAdminCookie();
    if (!cookieValue) return false;
    return safeEqual(expected, cookieValue);
  }

  return false;
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

// Validación del token enviado por el usuario al endpoint de login.
// Solo aplica al emergency path; rechaza si emergency mode está apagado.
export function validateAdminTokenInput(input: string): boolean {
  if (!isEmergencyModeEnabled()) return false;
  const expected = getAdminPanelToken();
  if (!expected) return false;
  if (!input || input.length === 0) return false;
  return safeEqual(expected, input);
}

/** Helper para que callers (server actions admin) obtengan el usuario_id
 *  del admin actual sin re-llamar a auth(). NULL si auth via emergency
 *  token (sin identidad individual). */
export async function getAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role === 'admin') return session.user.usuarioId;
  return null;
}
