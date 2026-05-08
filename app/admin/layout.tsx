// Admin layout. Protege todas las rutas `/admin/*` (excepto /admin/login que
// está fuera del segmento — su page.tsx renderiza el form sin guard).
//
// El header repite el branding del producto pero con un ribbon visible que
// recuerda al operador que está en panel administrativo (evita confusión
// entre admin y entrevistado vista).

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { logoutAdmin } from '@/app/actions/adminAuth';
import { CommandPaletteTrigger } from '@/components/admin/command-palette-trigger';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-foreground/10 bg-forest-deep text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
                <span className="text-xs font-bold tracking-tight">V</span>
              </div>
              <div className="leading-tight">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground/60">
                  Vértice
                </p>
                <p className="text-sm font-medium tracking-tight">
                  Panel administrativo
                </p>
              </div>
            </Link>
            <nav className="ml-6 hidden items-center gap-1 md:flex">
              <NavLink href="/admin">Resumen</NavLink>
              <NavLink href="/admin/sesiones">Sesiones</NavLink>
              <NavLink href="/admin/instituciones">Instituciones</NavLink>
              <NavLink href="/admin/instituciones/nueva">
                Nueva institución
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <CommandPaletteTrigger />
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-full bg-forest/40 px-3 py-1.5 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-forest/70"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-xs font-medium text-primary-foreground/75 transition hover:bg-forest/40 hover:text-primary-foreground"
    >
      {children}
    </Link>
  );
}
