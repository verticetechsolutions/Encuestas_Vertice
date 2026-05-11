// SVG filter defs centralizados para el admin scope. Se inyecta una vez en
// app/admin/layout.tsx así cualquier componente referencia los filters por id
// sin duplicar defs.
//
// Filters disponibles:
// - #admin-dot-goo  — goo filter para clusters de status dots (stdDeviation 3,
//                     threshold colorMatrix sharp). Aplicar a un parent div con
//                     `filter: url(#admin-dot-goo)` envolviendo los dots.

export function AdminSvgDefs() {
  return (
    <svg
      aria-hidden
      focusable="false"
      className="absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        {/* Goo para status dot clusters. stdDeviation pequeño (3px) porque los
            dots son pequeños y se fusionan al estar cerca; threshold cMatrix
            sharp para no producir halo difuso. */}
        <filter
          id="admin-dot-goo"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>

        {/* Goo para shapes grandes (hero card, organic cards). stdDeviation
            mayor (8) porque las shapes son más grandes y el "neck" entre
            main + extrusión necesita más blur para fusionar suave. Threshold
            matrix con mismo sharpening (18, -7). Filter region más amplia
            en vertical porque la extrusión cuelga bajo el main. */}
        <filter
          id="admin-hero-organic"
          x="-3%"
          y="-15%"
          width="106%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
