// Admin loading skeletons — fallbacks para Suspense boundaries y loading.tsx.
//
// Filosofía: cada page del admin lleva su propio skeleton específico montado
// como `<Suspense fallback={…}>` dentro del page tree. Esto permite que el
// shell (layout + header + chrome) pinte INSTANTÁNEAMENTE en cada navegación,
// y los datos llenen los slots a medida que el server los stremea.
//
// Patrón canónico de Vercel/Linear/Resend dashboards: shell instant, data
// streams. Mejor que loading.tsx solo porque evita flash de la página entera.
//
// Visual: bloques `bg-foreground/[0.06]` con `.animate-shimmer` (utility en
// design-system/motion.css). Mantiene squircle/rounded del design system real
// para que la transición skeleton → real no produzca "salto" perceptible.

// ════════════════════════════════════════════════════════════════════════════
// Skeletons compuestos (por página)
// ════════════════════════════════════════════════════════════════════════════

/** Esqueleto del `/admin` (Resumen) — hero + 3 stats + funnel + 2-col list. */
export function ResumenSkeleton() {
  return (
    <div
      className="flex flex-col gap-10 md:gap-16"
      role="status"
      aria-label="Cargando resumen"
    >
      <SkeletonHero />
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <SkeletonCompactCard />
        <SkeletonCompactCard />
        <SkeletonCompactCard />
      </section>
      <section>
        <div className="mb-5 flex items-baseline justify-between md:mb-6">
          <Skel className="h-3 w-16" />
          <Skel className="h-3 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <SkeletonCompactCard />
          <SkeletonCompactCard />
          <SkeletonCompactCard />
          <SkeletonCompactCard />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-3">
          <Skel className="h-3 w-24" />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
        <div className="flex flex-col gap-3">
          <Skel className="h-3 w-20" />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      </section>
    </div>
  );
}

/** Esqueleto para /admin/sesiones, /admin/instituciones, /admin/magic-links —
 *  todas comparten: hero KPI + nav card (search + CTA) + feed list. */
export function ListPageSkeleton() {
  return (
    <div
      className="flex flex-col gap-10 md:gap-12"
      role="status"
      aria-label="Cargando catálogo"
    >
      <SkeletonHero />
      <SkeletonNavCard />
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <Skel className="h-3 w-24" />
          <Skel className="h-3 w-20" />
        </div>
        <div className="squircle shadow-card-subtle flex flex-col gap-1 rounded-3xl bg-cream-pure p-2 ring-1 ring-foreground/[0.04] md:p-3">
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      </section>
    </div>
  );
}

/** Esqueleto genérico fallback (loading.tsx universal). */
export function AdminLoadingSkeleton() {
  return <ResumenSkeleton />;
}

// ════════════════════════════════════════════════════════════════════════════
// Atoms
// ════════════════════════════════════════════════════════════════════════════

/** Bloque shimmer base. Default rounded-full; override con className. */
function Skel({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-full bg-foreground/[0.06] animate-shimmer ${className}`}
    />
  );
}

/** Hero con silueta orgánica bottom-left (mirror del MetricCard hero). */
function SkeletonHero() {
  return (
    <div className="relative isolate pt-8 pb-20 px-8 md:pt-12 md:pb-24 md:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          filter:
            'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ filter: 'url(#admin-hero-organic)' }}
        >
          <div className="squircle absolute inset-x-0 top-0 bottom-12 rounded-[28px] bg-cream-pure" />
          <div className="absolute bottom-0 left-0 h-20 w-1/3 rounded-full bg-cream-pure" />
        </div>
      </div>
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="flex flex-col gap-4">
          <Skel className="h-2.5 w-24" />
          <Skel className="h-20 w-44 rounded-2xl md:h-28 md:w-56" />
          <Skel className="h-3 w-56" />
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          <SkeletonHintRow />
          <SkeletonHintRow />
          <SkeletonHintRow />
        </div>
      </div>
    </div>
  );
}

function SkeletonHintRow() {
  return (
    <div className="flex items-center gap-3">
      <Skel className="size-3.5" />
      <Skel className="h-2.5 w-32" />
      <Skel className="h-2.5 w-8" />
    </div>
  );
}

/** Compact card — mirror del MetricCard compact organic top-right. */
function SkeletonCompactCard() {
  return (
    <div className="relative isolate pt-12 pb-4 px-5 md:pt-14 md:pb-5 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          filter:
            'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ filter: 'url(#admin-hero-organic)' }}
        >
          <div className="squircle absolute inset-x-0 top-6 bottom-0 rounded-[28px] bg-cream-pure" />
          <div className="absolute top-0 right-0 h-12 w-1/2 rounded-full bg-cream-pure" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skel className="h-2.5 w-16" />
        <Skel className="h-9 w-20 rounded-lg" />
        <Skel className="h-3 w-32" />
      </div>
    </div>
  );
}

/** Nav card orgánico (searchbar + CTA) — usado en list pages. */
function SkeletonNavCard() {
  return (
    <div className="relative isolate px-6 pt-14 pb-6 md:px-8 md:pt-16 md:pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          filter:
            'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ filter: 'url(#admin-hero-organic)' }}
        >
          <div className="squircle absolute inset-x-0 top-6 bottom-0 rounded-[28px] bg-cream-pure" />
          <div className="absolute top-0 right-0 h-12 w-1/2 rounded-full bg-cream-pure" />
        </div>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Skel className="h-10 flex-1 rounded-full" />
        <Skel className="h-10 w-48 rounded-full" />
      </div>
    </div>
  );
}

/** Fila estilo ListItem — rail accent + title + meta + chevron. */
function SkeletonListRow() {
  return (
    <div className="squircle flex items-stretch gap-3 rounded-2xl p-3.5 md:gap-4 md:p-4">
      <span className="w-[2px] shrink-0 self-stretch rounded-full bg-foreground/[0.06]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skel className="h-3.5 w-48" />
        <Skel className="h-2.5 w-64" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pl-2">
        <Skel className="h-2 w-12" />
        <Skel className="h-2.5 w-16" />
      </div>
    </div>
  );
}
