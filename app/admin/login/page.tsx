// Admin login — Sprint 1 security audit 2026-05-12.
//
// PRIMARY: Google SSO con dominio @verticemexico.com (per-user auth +
// audit log). El usuario hace click → flow Auth.js → callback resuelve
// rol=admin si email termina en @verticemexico.com.
//
// FALLBACK: token compartido (`ADMIN_PANEL_TOKEN`) SOLO activo cuando
// la env `ADMIN_EMERGENCY_MODE=1` está seteada. Para incidents donde
// Google esté caído. Por default, el form de token NO se muestra.
//
// Si `?next=/admin/algo` viene en URL, lo preservamos para volver al
// destino tras login.

import { redirect } from 'next/navigation';
import { loginAdmin } from '@/app/actions/adminAuth';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { GoogleSignInButton } from './google-sign-in-button';

const EMERGENCY_MODE = process.env.ADMIN_EMERGENCY_MODE === '1';

interface SearchParams {
  next?: string;
  error?: string;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = params.next ?? '/admin';

  // Si ya está autenticado, no muestres el form — redirige directo.
  if (await isAdminAuthenticated()) {
    redirect(next.startsWith('/admin') ? next : '/admin');
  }

  return (
    <main className="min-h-screen bg-survey-bg">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-3xl bg-cream p-8 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Vértice · panel
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Acceso administrador
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Continúa con tu cuenta de Google del equipo Vértice
            (<code className="font-mono text-foreground/80">@verticemexico.com</code>).
          </p>

          <div className="mt-6">
            <GoogleSignInButton next={next} />
          </div>

          {EMERGENCY_MODE && (
            <>
              <div className="mt-6 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-px flex-1 bg-foreground/10" />
                <span>emergencia</span>
                <span className="h-px flex-1 bg-foreground/10" />
              </div>
              <form action={loginAdmin} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="next" value={next} />
                <label className="block">
                  <span className="text-xs font-medium text-foreground/85">
                    Token (ADMIN_PANEL_TOKEN)
                  </span>
                  <input
                    name="token"
                    type="password"
                    required
                    autoComplete="off"
                    className="mt-1.5 w-full rounded-xl border-0 bg-background px-3 py-2.5 font-mono text-sm text-foreground ring-1 ring-foreground/10 outline-none focus:ring-2 focus:ring-ink/30"
                    placeholder="••••••••"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold tracking-tight text-primary-foreground transition hover:bg-[var(--ink-raised)] active:scale-[0.98]"
                >
                  Entrar con token
                </button>
              </form>
            </>
          )}

          {params.error && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200/70">
              {decodeMessage(params.error)}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function decodeMessage(code: string): string {
  switch (code) {
    case 'admin_invalid_token':
      return 'El token no coincide. Verifica el valor en `.env.local`.';
    case 'admin_disabled':
      return 'El panel está deshabilitado: falta `ADMIN_PANEL_TOKEN` en el servidor.';
    case 'admin_rate_limited':
      return 'Demasiados intentos en poco tiempo. Espera 15 minutos antes de reintentar.';
    default:
      return 'No se pudo iniciar sesión. Reintenta.';
  }
}
