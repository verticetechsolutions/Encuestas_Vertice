// components/landing/Card.tsx
//
// Card primitive para landing. Variant default = manifest pattern
// (ink-raised bg + gold seam top + radius-section). Atmosphere
// overlays opcionales via prop atmosphere=true.

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
    'relative overflow-hidden rounded-[18px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)] ' +
    'p-[var(--card-padding)]',
  manifest:
    'relative overflow-hidden rounded-[28px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055),inset_0_1px_0_rgba(200,168,100,0.18)] ' +
    'px-6 py-14 sm:px-10 sm:py-20 lg:px-14',
  compact:
    'relative overflow-hidden rounded-[14px] bg-[var(--ink-raised)] ' +
    'shadow-[inset_0_0_0_1px_rgba(244,241,234,0.055)] ' +
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
