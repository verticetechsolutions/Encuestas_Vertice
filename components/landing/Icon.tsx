// components/landing/Icon.tsx
//
// Lucide icon wrapper. Enforces size + stroke tokens for consistency.
// Surface ink. Default size=md, stroke=default. For navigation arrows
// que necesitan más weight, pasar stroke='bold'.

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Stroke = 'thin' | 'default' | 'bold';

interface IconProps {
  icon: LucideIcon;
  size?: Size;
  stroke?: Stroke;
  className?: string;
  'aria-hidden'?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: 'size-[var(--icon-sm)]',
  md: 'size-[var(--icon-md)]',
  lg: 'size-[var(--icon-lg)]',
  xl: 'size-[var(--icon-xl)]',
};

const strokeValue: Record<Stroke, number> = {
  thin:    1.5,
  default: 2,
  bold:    2.5,
};

export function Icon({
  icon: LucideIconComponent,
  size = 'md',
  stroke = 'default',
  className,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  return (
    <LucideIconComponent
      className={cn(sizeClass[size], className)}
      strokeWidth={strokeValue[stroke]}
      aria-hidden={ariaHidden}
    />
  );
}
