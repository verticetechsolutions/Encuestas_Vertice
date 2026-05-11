// components/entrevista/Section.tsx
//
// Section surface light (cream/survey-bg). 3 surfaces: bg (off-white
// page), surface (white pure, ej. textarea container), ink (dark
// pocket = survey-card-1, brand surface dentro de entrevista).

import { cn } from '@/lib/utils';

type Surface = 'bg' | 'surface' | 'ink' | 'transparent';
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
  bg:          'bg-[var(--survey-bg)] text-[var(--survey-text)]',
  surface:     'bg-[var(--survey-surface)] text-[var(--survey-text)]',
  ink:         'bg-[var(--survey-card-1)] text-[var(--survey-card-1-fg)]',
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
  surface = 'bg',
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
