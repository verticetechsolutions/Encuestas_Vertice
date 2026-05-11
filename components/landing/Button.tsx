// components/landing/Button.tsx
//
// 3 variants:
//   primary - pill cream sobre ink + inner icon-pill ink/gold (CTA hero)
//   ghost   - pill border cream/20 → cream/45 hover
//
// Wave 2 (2026-05-11): consume --radius-pill + --shadow-cta-glow tokens.
// Inner icon-pill usa --radius-pill también (era rounded-full literal).

'use client';

import { cn } from '@/lib/utils';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
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
  icon: Icon = ArrowUpRight,
  className,
  children,
  ...rest
}: ButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        className={cn(
          'group/cta relative inline-flex items-center gap-3 rounded-[var(--radius-pill)]',
          'bg-cream-pure pl-6 pr-2 text-[13.5px] font-medium text-ink',
          'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
          'shadow-[var(--shadow-cta-glow)]',
          'hover:bg-white',
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        <span>{children}</span>
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-pill)] bg-ink text-gold transition-transform duration-[var(--dur-fast)] group-hover/cta:rotate-45">
          <Icon className="size-4" strokeWidth={2} />
        </span>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group/ghost inline-flex items-center gap-2.5 rounded-[var(--radius-pill)]',
        'border border-cream-pure/20 px-5 text-[13.5px] font-medium text-cream-pure',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-expo)]',
        'hover:border-cream-pure/45',
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
