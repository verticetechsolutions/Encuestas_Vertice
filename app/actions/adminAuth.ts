'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  setAdminCookie,
  clearAdminCookie,
  validateAdminTokenInput,
  getAdminPanelToken,
} from '@/lib/auth/admin';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { logger } from '@/lib/observability/axiom';

// Truncado para no logear UAs patológicos. 200 cubre todos los UA reales.
function getRequestMetadata(h: Headers): { ip: string; user_agent: string | null } {
  const xff = h.get('x-forwarded-for');
  const ip = xff ? (xff.split(',')[0]?.trim() ?? 'unknown') : (h.get('x-real-ip') ?? 'unknown');
  const ua = h.get('user-agent');
  return { ip, user_agent: ua ? ua.slice(0, 200) : null };
}

// Server Action invocada desde el form en `/admin/login`. El token llega vía
// FormData (no URL param) para no quedar en logs HTTP. En error, redirige al
// mismo /admin/login con `?error=<code>` para que el form muestre el mensaje;
// en éxito, setea cookie y redirige a `next` (default `/admin`).
//
// Audit log: cada intento (éxito o fallo) se loguea con IP + UA. NUNCA se
// loguea el token; en éxito sólo el hecho de que la auth pasó.
//
// Throttle: 5 intentos / 15 min / IP. Sin esto el ADMIN_PANEL_TOKEN podría
// ser brute-forced si tuviera longitud insuficiente.
export async function loginAdmin(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const next = String(formData.get('next') ?? '/admin');
  const safeNext = next.startsWith('/admin') ? next : '/admin';
  const nextParam = encodeURIComponent(safeNext);

  const meta = getRequestMetadata(await headers());

  // Rate limit antes de cualquier validación. Aplica al IP no autenticado.
  const rl = await checkRateLimit(`admin-login:ip:${meta.ip}`, RATE_LIMITS.adminLoginPerIp);
  if (!rl.allowed) {
    logger.admin.loginFallido({ ...meta, razon: 'rate_limited' });
    redirect(`/admin/login?error=admin_rate_limited&next=${nextParam}`);
  }

  if (!getAdminPanelToken()) {
    // Defensa explícita: si la env var no está, el panel está deshabilitado.
    logger.admin.loginFallido({ ...meta, razon: 'admin_disabled' });
    redirect(`/admin/login?error=admin_disabled&next=${nextParam}`);
  }

  if (!validateAdminTokenInput(token)) {
    logger.admin.loginFallido({ ...meta, razon: 'admin_invalid_token' });
    redirect(`/admin/login?error=admin_invalid_token&next=${nextParam}`);
  }

  // Cookie value = el token. La validación cruza con env en cada requireAdmin.
  await setAdminCookie(token);
  logger.admin.login(meta);
  redirect(safeNext);
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminCookie();
  redirect('/admin/login');
}
