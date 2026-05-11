// components/entrevista/Stack.tsx
//
// Idéntico al landing Stack — surface-agnostic. Lo duplicamos para
// mantener el principio de "dos sets paralelos". Si en el futuro
// alguien quiere consolidar, lo hace explícito.

import { cn } from '@/lib/utils';

type Gap = 'tight' | 'default' | 'loose' | 'section';
type Align = 'start' | 'center' | 'end';

interface StackProps {
  children: React.ReactNode;
  gap?: Gap;
  align?: Align;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
}

const gapStyle: Record<Gap, string> = {
  tight:   'gap-[var(--stack-tight)]',
  default: 'gap-[var(--stack-default)]',
  loose:   'gap-[var(--stack-loose)]',
  section: 'gap-[var(--stack-section)]',
};

const alignClass: Record<Align, string> = {
  start:  'items-start',
  center: 'items-center',
  end:    'items-end',
};

export function Stack({
  children,
  gap = 'default',
  align = 'start',
  className,
  as: Tag = 'div',
}: StackProps) {
  return (
    <Tag className={cn('flex flex-col', gapStyle[gap], alignClass[align], className)}>
      {children}
    </Tag>
  );
}
