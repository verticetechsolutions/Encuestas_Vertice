'use client';

// Tooltip moderno para el admin panel. Wrapper minimal sobre @base-ui/react/tooltip
// con styling alineado al ink/gold del design system.
//
// Decisiones:
// - delay 400ms (no instant, no perezoso). Linear, Vercel, GitHub usan 400-500ms.
// - side="bottom" por default (header está en top de viewport; tooltip bajando
//   no compite con contenido encima).
// - Fade + scale + slide subtle en entry/exit via data-[starting-style] /
//   data-[ending-style] (selectors propios de Base UI).
// - Shortcut opcional renderizado como kbd-style chip al lado del texto.
// - Arrow opcional (default activado) — Base UI lo posiciona automáticamente.

import { Tooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

interface Props {
  /** Trigger element. Debe ser un single React element (button, a, etc.). */
  children: ReactElement;
  /** Texto principal del tooltip. */
  content: ReactNode;
  /** Lado del trigger donde abrir el tooltip. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Atajo de teclado opcional. Se renderiza como chip mono al lado del texto. */
  shortcut?: string;
  /** Delay en ms antes de abrir. Default 400. */
  delay?: number;
}

export function AdminTooltip({
  children,
  content,
  side = 'bottom',
  shortcut,
  delay = 400,
}: Props) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={delay} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={10}>
          <Tooltip.Popup
            className={[
              'relative z-[60] inline-flex items-center gap-2',
              'rounded-lg bg-ink px-2.5 py-1.5',
              'text-[11.5px] font-medium leading-none tracking-tight text-primary-foreground',
              'shadow-[0_12px_28px_-12px_rgb(10_15_28_/_0.55),0_4px_12px_-6px_rgb(10_15_28_/_0.3)]',
              'ring-1 ring-primary-foreground/10',
              'origin-top transition duration-150 ease-out',
              'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
              'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
            ].join(' ')}
          >
            <Tooltip.Arrow
              className={[
                'absolute size-2 rotate-45 bg-ink ring-1 ring-primary-foreground/10',
                'data-[side=bottom]:-top-1 data-[side=bottom]:left-1/2 data-[side=bottom]:-translate-x-1/2',
                'data-[side=top]:-bottom-1 data-[side=top]:left-1/2 data-[side=top]:-translate-x-1/2',
                'data-[side=left]:-right-1 data-[side=left]:top-1/2 data-[side=left]:-translate-y-1/2',
                'data-[side=right]:-left-1 data-[side=right]:top-1/2 data-[side=right]:-translate-y-1/2',
              ].join(' ')}
            />
            <span className="relative">{content}</span>
            {shortcut && (
              <span className="relative rounded bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[9.5px] tracking-tight text-primary-foreground/75">
                {shortcut}
              </span>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
