// components/entrevista/Button.tsx
//
// Inverse de landing Button. primary = pill ink solid sobre cream bg.
// ghost = pill border ink/12 → ink/30 hover.
//
// Wave 2 (2026-05-11): consume --radius-pill + --shadow-cta-glow-cream tokens.

'use client';

import { cn } from '@/lib/utils';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'default' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
}

const sizeClass: Record<Size, string> = {
  default: 'h-12',
  large:   'h-14',
};

export function Button({
  variant = 'primary',
  size = 'default',
  icon: Icon = ArrowRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        className={cn(
          'group/cta relative inline-flex items-center gap-3 rounded-[var(--radius-pill)]',
          'bg-ink pl-6 pr-2 text-[13.5px] font-medium text-cream-pure',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[var(--shadow-cta-glow-cream)]',
          'hover:bg-[var(--ink-raised)]',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] bg-cream-pure text-ink transition-transform duration-[var(--dur-fast)] group-hover/cta:translate-x-0.5">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-[var(--radius-pill)]',
        'border border-[var(--survey-hairline-strong)] px-5 text-[13.5px] font-medium text-[var(--survey-text)]',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
        'hover:border-[rgb(10_15_28_/_0.30)]',
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
