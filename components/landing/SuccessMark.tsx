'use client';

// Sello de éxito animado. Capas:
//  1) Ring dorado que se dibuja (stroke-dashoffset 1 → 0)
//  2) Fill navy que aparece con scale-in al cerrar el ring
//  3) Checkmark blanco que se traza dentro del fill
//  4) Ripple dorado pulsante perpetuo (sutil, ambient)
// Todas las capas son CSS-driven (keyframes en globals.css). Sin GSAP runtime.

import { cn } from '@/lib/utils';

export function SuccessMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('sx-mark', className)}
    >
      <defs>
        <linearGradient id="sx-ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E0BE7C" />
          <stop offset="60%" stopColor="#C8A864" />
          <stop offset="100%" stopColor="#9C824A" />
        </linearGradient>
        <radialGradient id="sx-fill-grad" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#1a2236" />
          <stop offset="100%" stopColor="#0A0F1C" />
        </radialGradient>
      </defs>

      {/* Ripple ambient — escala y se desvanece infinito */}
      <circle
        className="sx-ripple"
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="#C8A864"
        strokeOpacity="0.5"
        strokeWidth="1"
      />

      {/* Ring que se dibuja en el primer beat */}
      <circle
        className="sx-ring"
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="url(#sx-ring-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        transform="rotate(-90 40 40)"
      />

      {/* Fill navy que crece tras el ring */}
      <circle className="sx-fill" cx="40" cy="40" r="28" fill="url(#sx-fill-grad)" />

      {/* Checkmark dorado que se traza al final */}
      <path
        className="sx-check"
        d="M 26 41 L 36 51 L 55 32"
        fill="none"
        stroke="#E0BE7C"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
      />
    </svg>
  );
}
