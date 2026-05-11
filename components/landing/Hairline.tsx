// components/landing/Hairline.tsx
//
// Hairline divider — 1px line + variantes de tono. Orientation horizontal
// (default) o vertical (uso en headers, sidebars).

import { cn } from '@/lib/utils';

type Tone = 'gold' | 'cream' | 'cream-strong';
type Orientation = 'horizontal' | 'vertical';

interface HairlineProps {
  tone?: Tone;
  orientation?: Orientation;
  className?: string;
}

const toneBg: Record<Tone, string> = {
  'gold':         'bg-gold/55',
  'cream':        'bg-cream-pure/8',
  'cream-strong': 'bg-cream-pure/20',
};

export function Hairline({
  tone = 'cream',
  orientation = 'horizontal',
  className,
}: HairlineProps) {
  const baseClass = orientation === 'horizontal'
    ? 'h-px w-full'
    : 'w-px h-full';
  return (
    <span
      aria-hidden
      className={cn('block', baseClass, toneBg[tone], className)}
    />
  );
}
