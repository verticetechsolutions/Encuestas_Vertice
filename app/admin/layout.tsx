// Admin layout. Protege todas las rutas `/admin/*` excepto `/admin/login`.
//
// `/admin/login` SÍ vive bajo este segmento (`app/admin/login/page.tsx`), así
// que el layout también lo envuelve. Para evitar bucle de redirect, leemos el
// header `x-pathname` (inyectado por `middleware.ts`) y, si es `/admin/login`,
// renderizamos el form sin guard ni chrome admin.
//
// Chrome admin = AdminHeader floating-pill (client component con usePathname
// para active states + transición motion del active pill). Sticky top para
// que la nav siga alcanzable en páginas con tablas largas.
//
// Scroll model: el documento NO scrollea en admin. En su lugar, todo vive
// dentro de un AdminScrollArea (Base UI ScrollArea) que provee el mismo
// thumb overlay pill del command palette — fade-in en hover/scrolling,
// auto-hide al idle. Razones:
//  - Scrollbar custom consistente con el palette (ink/25 thumb, w-1.5).
//  - El scrollbar nativo del documento en Windows trae arrows pesados
//    aunque esté thin-styled en globals.css.
//  - `data-lenis-prevent` en el Viewport mantiene a Lenis (smooth-scroll
//    global) fuera del admin sin afectar el resto del sitio.
// El wrapper exterior usa `fixed inset-0` para cubrir el gutter de
// `scrollbar-gutter: stable` del html, evitando un strip taupe a la
// derecha. La AdminHeader sticky funciona normal porque sticky se ancla
// al scrolling ancestor más cercano (el Viewport).

import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth/admin';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminSvgDefs } from '@/components/admin/svg-defs';
import { AdminMotionProvider } from '@/components/admin/motion-provider';
import { AdminScrollArea } from '@/components/admin/scroll-area';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  if (h.get('x-pathname') === '/admin/login') {
    return <>{children}</>;
  }
  await requireAdmin();

  return (
    <AdminMotionProvider>
      {/* fixed inset-0: cubre el viewport entero incluyendo el gutter de
          scrollbar-gutter: stable del html (de otro modo quedaría un strip
          de canvas taupe a la derecha porque el documento ya no scrollea
          en admin). Fuera del document flow ⇒ body queda con altura 0 y
          no compite con scrollbars. */}
      <div data-admin-shell className="fixed inset-0 bg-survey-bg">
        {/* SVG filter defs centralizados (goo para dot clusters, etc).
            Single instance reused por todo el admin scope. */}
        <AdminSvgDefs />
        {/* resetOnPathChange: el AdminScrollArea persiste entre navegaciones
            (mismo layout); sin reset la siguiente página aparecería al
            scrollTop de la anterior. */}
        <AdminScrollArea maxHeight="h-full" resetOnPathChange>
          <AdminHeader />
          {/* pt-8 adicional para dar aire bajo la extrusión de la nav
              (cuelga ~20px por debajo del pill principal). El max-w del
              header (6xl) coincide con este main, así que se alinean
              verticalmente. */}
          <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 md:px-6 md:pt-10 md:pb-20">
            {children}
          </main>
        </AdminScrollArea>
      </div>
    </AdminMotionProvider>
  );
}
