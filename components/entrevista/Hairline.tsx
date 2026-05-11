// components/entrevista/Hairline.tsx
//
// Hairline divider surface light. Tones invertidos: ink (ink/6 default),
// ink-strong (ink/12), gold (gold/22).

import { cn } from '@/lib/utils';

type Tone = 'ink' | 'ink-strong' | 'gold';
type Orientation = 'horizontal' | 'vertical';

interface HairlineProps {
  tone?: Tone;
  orientation?: Orientation;
  className?: string;
}

const toneBg: Record<Tone, string> = {
  'ink':        'bg-[var(--survey-hairline)]',
  'ink-strong': 'bg-[var(--survey-hairline-strong)]',
  'gold':       'bg-gold/22',
};

export function Hairline({
  tone = 'ink',
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
