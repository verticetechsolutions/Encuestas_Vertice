// components/entrevista/Card.tsx
//
// 2 variants principales matcheando los survey surface tokens:
//   surface-1 (default) - navy ink dark pocket. Branding moment dentro
//                         de la encuesta. Espejo del landing dark.
//   surface-2          - white pure. Workspace card (textarea container).
//
// + variant compact para chips/pills internos.
//
// Wave 2 (2026-05-11): consume --radius-card/md tokens.

import { cn } from '@/lib/utils';

type Variant = 'surface-1' | 'surface-2' | 'compact';

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

const variantClass: Record<Variant, string> = {
  'surface-1':
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--survey-card-1)] text-[var(--survey-card-1-fg)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-card-1-hairline)] ' +
    'p-[var(--card-padding)]',
  'surface-2':
    'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-hairline)] ' +
    'p-[var(--card-padding)]',
  'compact':
    'relative overflow-hidden rounded-[var(--radius-md)] bg-[var(--survey-card-2)] text-[var(--survey-text)] ' +
    'shadow-[inset_0_0_0_1px_var(--survey-hairline)] ' +
    'p-4',
};

export function Card({
  children,
  variant = 'surface-1',
  className,
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag className={cn(variantClass[variant], className)}>
      <div className="relative">{children}</div>
    </Tag>
  );
}
