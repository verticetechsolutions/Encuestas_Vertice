// components/landing/Eyebrow.tsx
//
// Microcap label estilo manifiesto. Consume .text-eyebrow utility.
// 3 tones para distintos contextos: muted (default, cream/45),
// gold (acento), cream (más prominente cream/72).

import { cn } from '@/lib/utils';

type Tone = 'muted' | 'gold' | 'cream';

interface EyebrowProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

const toneClass: Record<Tone, string> = {
  muted:  'text-cream-pure/45',
  gold:   'text-gold',
  cream:  'text-cream-pure/72',
};

export function Eyebrow({
  children,
  tone = 'muted',
  className,
  as: Tag = 'span',
}: EyebrowProps) {
  return (
    <Tag className={cn('text-eyebrow', toneClass[tone], className)}>
      {children}
    </Tag>
  );
}
