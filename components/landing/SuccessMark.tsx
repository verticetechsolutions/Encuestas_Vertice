'use client';

// Sello de éxito — pasada editorial.
//  1) Onda dorada one-shot que se expande y desvanece (no es perpetua).
//  2) Disco navy con scale-in y leve overshoot (sello que cae en posición).
//  3) Hairline dorada interna que se materializa con el disco.
//  4) Check cream que se traza dentro — alto contraste sobre navy.
// Sin glow perpetuo, sin ripple infinito. Una sola declaración, luego quietud.

import { cn } from '@/lib/utils';

export function SuccessMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      overflow="visible"
      className={cn('sx-mark', className)}
    >
      {/* Onda dorada one-shot — flourish ambient, no infinita */}
      <circle
        className="sx-pulse"
        cx="50"
        cy="50"
        r="32"
        fill="none"
        stroke="#C8A864"
        strokeWidth="1"
      />

      {/* Disco navy — sello que cae con leve overshoot */}
      <circle className="sx-disk" cx="50" cy="50" r="32" fill="#0A0F1C" />

      {/* Hairline dorada interna — detalle editorial sutil */}
      <circle
        className="sx-disk-stroke"
        cx="50"
        cy="50"
        r="29.5"
        fill="none"
        stroke="#C8A864"
        strokeOpacity="0.28"
        strokeWidth="0.75"
      />

      {/* Check cream — contraste real sobre el navy */}
      <path
        className="sx-check"
        d="M 35 51 L 45 61 L 65 40"
        fill="none"
        stroke="#F4F1EA"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
      />
    </svg>
  );
}
