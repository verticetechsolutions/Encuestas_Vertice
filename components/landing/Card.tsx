// components/landing/Card.tsx
//
// Card primitive para landing. Variant default = manifest pattern
// (ink-raised bg + gold seam top + radius-section). Atmosphere
// overlays opcionales via prop atmosphere=true.
//
// Wave 2 (2026-05-11): consume --radius-card/section + --shadow-card-ink
// tokens (era literales inline en Wave 1).

import { cn } from '@/lib/utils';
import { Atmosphere } from './Atmosphere';

type Variant = 'default' | 'manifest' | 'compact';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  atmosphere?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

const variantClass: Record<Variant, string> = {
  default:
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-card-ink)] ' +
    'p-[var(--card-padding)]',
  manifest:
    'relative overflow-hidden rounded-[var(--radius-section)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-card-ink)] ' +
    'px-6 py-14 sm:px-10 sm:py-20 lg:px-14',
  compact:
    'relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--ink-raised)] ' +
    'shadow-[var(--shadow-hairline-ink)] ' +
    'p-6',
};

export function Card({
  children,
  variant = 'default',
  atmosphere = false,
  className,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag className={cn(variantClass[variant], className)}>
      {atmosphere && <Atmosphere variant="both" />}
      <div className="relative">{children}</div>
    </Tag>
  );
}
