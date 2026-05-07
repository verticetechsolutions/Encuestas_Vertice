'use client';

// Sello de éxito inspirado en el shot "Transaction Complete" de Szymon
// Wiśniewski (Dribbble #25498823). Secuencia spark → arc → ring → check, todo
// con drop-shadow gold glow para esa estética fintech moderna.
//
// Sequence (≈2.0s total):
//   0.18s  disco navy scale-in con overshoot
//   0.40s  spark dorado glow en centro (la "chispa" que arranca)
//   0.95s  arco dorado se dibuja clockwise (1/4 → 4/4 del círculo)
//   1.55s  checkmark cream se traza dentro del ring
//   2.10s  glow pulse hold — sello queda asentado
//
// El gold drop-shadow (filter) crea el halo ambient. Reduced-motion: salta
// directamente al estado final (ring completo + check).

import { cn } from '@/lib/utils';

export function BrandSuccessGlyph({
  size = 64,
  className,
}: {
  /** CSS px size for both width and height. Default 64. Pasamos via attribute
   *  en vez de utility class para evitar inconsistencias del JIT de Tailwind
   *  cuando se cambia el tamaño en HMR — un SVG sin width/height explícitos
   *  cae a fill-container y rompe el layout. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      overflow="visible"
      className={cn('bsg-mark block', className)}
    >
      {/* Disco navy — zona oscura que da contraste para el glow dorado */}
      <circle className="bsg-disk" cx="50" cy="50" r="32" fill="#0A0F1C" />

      {/* Spark dorada inicial — chispa que arranca antes del arco */}
      <circle className="bsg-spark" cx="50" cy="50" r="2.5" fill="#E0BE7C" />

      {/* Arco dorado que se dibuja desde las 12 (rotate -90 lo arranca arriba) */}
      <circle
        className="bsg-arc"
        cx="50"
        cy="50"
        r="22"
        fill="none"
        stroke="#E0BE7C"
        strokeWidth="2.25"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        transform="rotate(-90 50 50)"
      />

      {/* Checkmark cream — alto contraste sobre el navy, contenido dentro del ring */}
      <path
        className="bsg-check"
        d="M 39 51 L 47 59 L 62 41"
        fill="none"
        stroke="#F4F1EA"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
      />
    </svg>
  );
}
