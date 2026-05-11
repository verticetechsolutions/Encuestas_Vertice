'use client';

// DotCluster — wrapper que aplica goo filter a un grupo de dots/badges para
// que se fusionen orgánicamente al estar cerca, leyéndose como una agregación.
//
// Patrón critical-to-readability: el goo se aplica SOLO a shapes cromáticas
// (sin texto). El texto adjacente se renderiza FUERA del filter para no
// blurarse. Por eso este componente NO acepta children con texto — solo
// admite los dots/pills.
//
// Requiere que <AdminSvgDefs /> esté montado en algun ancestor (lo está en
// admin/layout.tsx) — referencia el filter por id `#admin-dot-goo`.

import type { ReactNode } from 'react';

interface Props {
  /** Dots/badges a fusionar. */
  children: ReactNode;
  /** Gap entre dots. Default '4px' (16-24px deja gap suficiente para que se
   *  fusionen visualmente con stdDeviation=3). */
  gap?: string;
  className?: string;
}

export function DotCluster({ children, gap = '4px', className = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{
        filter: 'url(#admin-dot-goo)',
        gap,
      }}
    >
      {children}
    </div>
  );
}

// Helper component — un dot básico para usar dentro de DotCluster.
interface DotProps {
  /** Color del dot. Acepta CSS var. */
  color?: string;
  /** Tamaño en px. Default 10. */
  size?: number;
  /** A11y label (read by screen readers). */
  label?: string;
}

export function Dot({
  color = 'var(--gold)',
  size = 10,
  label,
}: DotProps) {
  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
    />
  );
}
