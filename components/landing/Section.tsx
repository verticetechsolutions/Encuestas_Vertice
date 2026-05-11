// components/landing/Section.tsx
//
// Section primitive con container max + padding tokens. Surface ink
// por default (landing es dark). Para sub-pockets light dentro de
// landing usar surface="inkRaised".

import { cn } from '@/lib/utils';

type Surface = 'ink' | 'inkRaised' | 'transparent';
type PaddingY = 'none' | 'compact' | 'default' | 'hero';
type ContainerSize = 'default' | 'narrow' | 'wide' | 'full';

interface SectionProps {
  children: React.ReactNode;
  surface?: Surface;
  paddingY?: PaddingY;
  containerSize?: ContainerSize;
  className?: string;
  containerClassName?: string;
  id?: string;
  as?: 'section' | 'div' | 'article' | 'header' | 'footer' | 'main';
}

const surfaceClass: Record<Surface, string> = {
  ink:         'bg-ink text-cream-pure',
  inkRaised:   'bg-[var(--ink-raised)] text-cream-pure',
  transparent: '',
};

const paddingYStyle: Record<PaddingY, string> = {
  none:    '',
  compact: 'py-[var(--space-14)]',
  default: 'py-[var(--section-y)]',
  hero:    'pt-[clamp(96px,9vw,144px)] pb-[var(--space-20)]',
};

const containerMaxWidth: Record<ContainerSize, string | undefined> = {
  default: 'max-w-[var(--container-max)]',
  narrow:  'max-w-[960px]',
  wide:    'max-w-[1640px]',
  full:    undefined,
};

export function Section({
  children,
  surface = 'ink',
  paddingY = 'default',
  containerSize = 'default',
  className,
  containerClassName,
  id,
  as: Tag = 'section',
}: SectionProps) {
  const containerClasses = cn(
    'mx-auto px-[var(--section-padding-x)]',
    containerMaxWidth[containerSize],
    containerClassName,
  );
  return (
    <Tag
      id={id}
      className={cn(surfaceClass[surface], paddingYStyle[paddingY], className)}
    >
      <div className={containerClasses}>{children}</div>
    </Tag>
  );
}
