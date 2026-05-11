'use client';

// Floating organic-blob header — admin panel.
//
// Técnica: SVG goo filter (Lucas Bebber, 2014). Un layer "blob" contiene dos
// rectángulos rounded (pill principal + extrusión de nav abajo-derecha) con
// fill ink. El filtro feGaussianBlur + feColorMatrix (threshold alpha) los
// fusiona orgánicamente en los bordes donde sus blurs se solapan, produciendo
// una silueta única tipo "metaball" sin discontinuidad visual.
//
// Layer separado de contenido (sin filtro): brand, page title, acciones, nav
// links + active pill gold animado con motion layoutId. Los dos layers viven
// dentro del mismo wrapper relative y comparten coordenadas.
//
// Mobile: extrusión oculta; la nav baja como pill row independiente bajo el
// principal (la metáfora orgánica funciona en desktop, en móvil prioriza
// alcanzabilidad pulgar).

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { motion } from 'motion/react';

import { logoutAdmin } from '@/app/actions/adminAuth';
import { CommandPaletteTrigger } from './command-palette-trigger';
import { AdminTooltip } from './tooltip';

interface NavItem {
  href: string;
  label: string;
  /** Descripción para tooltip — micro-contexto que complementa al label, no
   * lo repite. Mantener breve (2-4 palabras) para no romper la lectura. */
  description: string;
  isActive: (pathname: string) => boolean;
}

const NAV: readonly NavItem[] = [
  {
    href: '/admin',
    label: 'Resumen',
    description: 'Métricas y actividad',
    isActive: (p) => p === '/admin',
  },
  {
    href: '/admin/sesiones',
    label: 'Sesiones',
    description: 'Historial de entrevistas',
    isActive: (p) => p.startsWith('/admin/sesiones'),
  },
  {
    href: '/admin/magic-links',
    label: 'Magic links',
    description: 'Links de acceso',
    isActive: (p) => p.startsWith('/admin/magic-links'),
  },
  {
    href: '/admin/instituciones',
    label: 'Instituciones',
    description: 'Aliados financieros',
    isActive: (p) => p.startsWith('/admin/instituciones'),
  },
] as const;

// Title resolver bottom-up: rutas profundas (e.g. /admin/instituciones/[id])
// ganan sobre las raíz porque su test corre antes en el array.
const TITLE_RULES: ReadonlyArray<readonly [(p: string) => boolean, string]> = [
  [(p) => p === '/admin/instituciones/nueva', 'Nueva institución'],
  [(p) => /^\/admin\/instituciones\/[^/]+$/.test(p), 'Detalle de institución'],
  [(p) => p === '/admin/instituciones', 'Instituciones'],
  [(p) => /^\/admin\/sesiones\/[^/]+$/.test(p), 'Detalle de sesión'],
  [(p) => p === '/admin/sesiones', 'Sesiones'],
  [(p) => p === '/admin/magic-links', 'Magic links'],
  [(p) => p === '/admin', 'Vista general'],
];

function resolveTitle(pathname: string): string {
  for (const [match, title] of TITLE_RULES) {
    if (match(pathname)) return title;
  }
  return 'Panel administrativo';
}

// Goo filter params:
// - stdDeviation 7: blur radius. Más alto = más "merge" pero edges menos
//   precisos. 7 da suficiente fusión a ~25px de distancia entre shapes y
//   mantiene la silueta del pill.
// - colorMatrix row alpha (0 0 0 18 -7): threshold alpha post-blur. Output =
//   18 * input - 7, clamped a [0,1]. Crossover en input=0.389 → solid edge.
//   Sin esto el blur leería como halo difuso.
const GOO_STD_DEVIATION = 7;
const GOO_MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7';

const ACTIVE_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 28,
  mass: 0.5,
};

export function AdminHeader() {
  const pathname = usePathname() ?? '/admin';
  const title = resolveTitle(pathname);

  return (
    <div className="sticky top-3 z-50 mx-auto w-full max-w-6xl px-4 pt-3 md:top-4 md:px-6 md:pt-4">
      {/* SVG filter defs — invisible. Single instance for all blobs in the page. */}
      <svg
        aria-hidden
        className="absolute h-0 w-0 overflow-hidden"
        focusable="false"
      >
        <defs>
          <filter
            id="admin-organic-blob"
            x="-5%"
            y="-50%"
            width="110%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={GOO_STD_DEVIATION}
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values={GOO_MATRIX}
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Wrapper relative: pb-12 desktop (48px) — sweet spot entre respiración
          y fusión orgánica. Con main pill md:h-16 (64px) y nav h-14 (56px)
          anclada bottom-0, el nav top queda en y=56 → 8px de OVERLAP con
          el main pill bottom (y=64). El overlap garantiza que el goo
          produzca un neck ancho y continuo (no un puentecito frágil).
          Es +8px de espacio vs el pb-10 original, suficiente para que la
          nav cuelgue claramente sin perder la silueta unificada. Mobile pb-0. */}
      <div className="relative md:pb-12">
        {/* ═══ BLOB LAYER ═══════════════════════════════════════════════════
            Goo filter aplicado directo a las dos shapes (main pill + extrusión).
            Sin drop-shadow: header flota plano sobre survey-bg, con la silueta
            ink como peso visual. La depth viene de la atmósfera interna (radial
            gold + noise dentro del content layer), no de una sombra externa —
            mismo patrón que la card-1 del entrevista-shell.
            ═══════════════════════════════════════════════════════════════════ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ filter: 'url(#admin-organic-blob)' }}
        >
          {/* Pill principal — full width del wrapper. md:h-16 (64px) > nav
              h-14 (56px) para jerarquía: main pill domina, nav extrusión es
              appendage. */}
          <div className="absolute left-0 right-0 top-0 h-14 rounded-full bg-ink md:h-16" />

          {/* Extrusión — desktop only. Sized por el ghost-nav interno (mirror
              exacto de la nav real, incluyendo p-2.5) para responder a cambios
              de labels sin medir con JS. Posición bottom-0 left-[72px]:
              extrusión bottom alineada con parent bottom (= main_pill_bottom +
              48px del pb-12). left-[72px] hace que la primera item (Resumen,
              con active gold pill) arranque a 82px del borde main pill (72 +
              p-2.5 = 10) — alineada con el texto del page title "Vista
              general" que empieza a ~81px (pl-4 + pl-1 + icon ~45px + gap-4).
              Con h-14 (56px) y main pill md:h-16 (64px), hay 8px de overlap
              vertical en y=[56,64] donde el goo filter fusiona shapes con neck
              ancho. Overhang inferior: ~48px. El p-2.5 interno deja 10px de
              respiración entre la curva del blob rounded-full y la active gold
              pill. */}
          <div className="absolute bottom-0 left-[72px] hidden rounded-full bg-ink md:block">
            <div className="invisible flex h-14 items-center gap-1.5 p-2.5">
              {NAV.map((item) => (
                <span
                  key={item.href}
                  className="inline-flex items-center rounded-full px-4 py-2 text-[12px] font-medium tracking-tight"
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ CONTENT LAYER ════════════════════════════════════════════════
            Brand + page title + acciones. relative para definir alto del
            wrapper y para que el nav absolute se ancle correctamente.

            Atmósfera (radial gold top-right + noise) clipeada al rounded-full
            del main pill via overflow-hidden absolute. Sin goo filter aplicado
            — esta capa vive afuera del blob layer, así que el radial-gold no
            se difumina ni se threshold-clipea por el goo. Mismo patrón que la
            card-1 del entrevista-shell (ink surface + atmosphere interno en
            lugar de drop-shadow externo).
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative flex h-14 items-center justify-between gap-3 pl-3 pr-2 md:h-16 md:pl-4 md:pr-3">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <div className="atmosphere-radial-gold absolute inset-0" />
            <div className="atmosphere-noise absolute inset-0" />
          </div>

          <AdminTooltip content="Inicio del panel" side="bottom">
            <Link
              href="/admin"
              aria-label="Vértice — admin home"
              // relative para ganar el painting order contra el atmosphere
              // absolute sibling (sin relative quedaría como static y el
              // atmosphere positioned pintaría encima en el mismo stacking
              // context). z-index implícito 0, suficiente.
              className="group/brand relative flex items-center gap-4 rounded-full pl-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <Image
                src="/Icon_white.svg"
                alt=""
                width={1380}
                height={1093}
                priority
                className="h-7 w-auto select-none transition-transform duration-300 ease-out group-hover/brand:scale-[1.05] md:h-9"
              />
              <motion.span
                key={title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                // text-xl (20px) mobile, md:text-[22px] desktop — balance
                // visual con el icon h-7/md:h-9 (28/36px). El ratio icon-text
                // queda ~1.6, en la franja del survey-card-1 header de la
                // encuesta (~2.4) pero un poco más dominante para que el
                // title respire al lado del icon en un pill rounded-full.
                className="hidden text-xl font-semibold leading-none tracking-tight text-primary-foreground sm:inline md:text-[22px]"
              >
                {title}
              </motion.span>
            </Link>
          </AdminTooltip>

          <div className="relative flex items-center gap-1.5">
            <CommandPaletteTrigger />
            <form action={logoutAdmin}>
              <AdminTooltip content="Cerrar sesión" side="bottom">
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-cream-pure/[0.08] text-primary-foreground/70 outline-none transition hover:bg-cream-pure/15 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  <LogOut className="size-3.5" />
                </button>
              </AdminTooltip>
            </form>
          </div>
        </div>

        {/* ═══ NAV EXTRUSIÓN (desktop) ══════════════════════════════════════
            Posición y dimensiones espejo del blob extrusión, sobre éste.
            Sin bg propio (el blob bajo provee la fill); solo links + active
            gold pill animado con layoutId.
            ═══════════════════════════════════════════════════════════════════ */}
        <nav
          aria-label="Navegación admin"
          className="absolute bottom-0 left-[72px] z-10 hidden h-14 items-center gap-1.5 p-2.5 md:flex"
        >
          {NAV.map((item) => {
            const active = item.isActive(pathname);
            return (
              <AdminTooltip
                key={item.href}
                content={item.description}
                side="bottom"
              >
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center rounded-full px-4 py-2 text-[12px] font-medium tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 ${
                    active
                      ? 'text-ink'
                      : 'text-primary-foreground/55 hover:text-primary-foreground'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-nav-active"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-gold"
                      style={{ boxShadow: '0 0 0 1px rgb(200 168 100 / 0.4)' }}
                      transition={ACTIVE_SPRING}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              </AdminTooltip>
            );
          })}
        </nav>

        {/* ═══ NAV MOBILE ═══════════════════════════════════════════════════
            Pill row independiente bajo el principal. Sin goo (no hay segundo
            shape para fusionar). bg propio porque está fuera del blob layer.
            Sin drop-shadow externa para mantener el patrón flat con atmósfera
            interna que adoptó el desktop pill (Wave 6, encuestas-style).
            Sólo el inset gold-seam hairline en el top edge — espejo visual
            del survey-card-1 hairline.
            ═══════════════════════════════════════════════════════════════════ */}
        <nav
          aria-label="Navegación admin"
          className="mt-4 flex items-center gap-1.5 overflow-x-auto rounded-full bg-ink p-2.5 md:hidden"
          style={{
            scrollbarWidth: 'none',
            boxShadow: 'inset 0 1px 0 rgb(200 168 100 / 0.18)',
          }}
        >
          {NAV.map((item) => {
            const active = item.isActive(pathname);
            return (
              <AdminTooltip
                key={item.href}
                content={item.description}
                side="bottom"
              >
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex shrink-0 items-center rounded-full px-4 py-2 text-[12px] font-medium tracking-tight transition-colors ${
                    active
                      ? 'bg-gold text-ink'
                      : 'text-primary-foreground/55 hover:text-primary-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </AdminTooltip>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
