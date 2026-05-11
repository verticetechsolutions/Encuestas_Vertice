// components/entrevista/Eyebrow.tsx
//
// Versión cream-surface del Eyebrow. tone semánticos invertidos
// (muted = ink/45, gold = gold-deep para AA on white, ink = ink/72).

import { cn } from '@/lib/utils';

type Tone = 'muted' | 'gold' | 'ink';

interface EyebrowProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

const toneClass: Record<Tone, string> = {
  muted: 'text-[var(--survey-text-45)]',
  gold:  'text-gold-deep',
  ink:   'text-[var(--survey-text-72)]',
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
