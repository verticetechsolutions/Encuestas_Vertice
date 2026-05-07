'use server';

import { redirect } from 'next/navigation';
import {
  setAdminCookie,
  clearAdminCookie,
  validateAdminTokenInput,
  getAdminPanelToken,
} from '@/lib/auth/admin';

// Server Action invocada desde el form en `/admin/login`. El token llega vía
// FormData (no URL param) para no quedar en logs HTTP. En error, redirige al
// mismo /admin/login con `?error=<code>` para que el form muestre el mensaje;
// en éxito, setea cookie y redirige a `next` (default `/admin`).
export async function loginAdmin(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const next = String(formData.get('next') ?? '/admin');
  const safeNext = next.startsWith('/admin') ? next : '/admin';
  const nextParam = encodeURIComponent(safeNext);

  if (!getAdminPanelToken()) {
    // Defensa explícita: si la env var no está, el panel está deshabilitado.
    redirect(`/admin/login?error=admin_disabled&next=${nextParam}`);
  }

  if (!validateAdminTokenInput(token)) {
    redirect(`/admin/login?error=admin_invalid_token&next=${nextParam}`);
  }

  // Cookie value = el token. La validación cruza con env en cada requireAdmin.
  await setAdminCookie(token);
  redirect(safeNext);
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminCookie();
  redirect('/admin/login');
}
