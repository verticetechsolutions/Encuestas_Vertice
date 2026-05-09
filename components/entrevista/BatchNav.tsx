'use client';

// BatchNav minimal — Paleta A (2026-05-09 refactor F3.4).
//   - Sin pills, sin rings, sin background. Vive como text-link inline en el
//     footer de card-2 (workspace).
//   - 3 elementos: "← Anterior" (link/disabled), "X / N" counter (eyebrow numeric),
//     "Siguiente →" (link/disabled).
//   - Estado disabled = foreground/30 + cursor-not-allowed (sin chrome extra).
//   - Hover en links = foreground/100 con underline subtle.
//   - Mantiene API previa: preguntas[], activeIndex, onChange — la marca de
//     respondida ya vive en el chip "Respondida" del HeroPregunta + en stepper
//     superior, no necesitamos re-comunicarla acá.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DotMeta {
  id: string;
  marcada: boolean;
}

interface Props {
  preguntas: DotMeta[];
  activeIndex: number;
  onChange: (i: number) => void;
}

export function BatchNav({ preguntas, activeIndex, onChange }: Props) {
  const total = preguntas.length;
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < total - 1;

  const respondidas = preguntas.filter((p) => p.marcada).length;

  return (
    <nav
      aria-label="Navegación entre preguntas del turno"
      className="flex items-center justify-between gap-4 text-[13px]"
    >
      {/* ← Anterior — link minimal, disabled cuando no hay prev */}
      <button
        type="button"
        onClick={() => canPrev && onChange(activeIndex - 1)}
        disabled={!canPrev}
        aria-label="Pregunta anterior"
        className={cn(
          'inline-flex items-center gap-1.5 font-medium tracking-tight transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/30 rounded',
          canPrev
            ? 'text-foreground/65 hover:text-foreground'
            : 'text-foreground/25 cursor-not-allowed'
        )}
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
        Anterior
      </button>

      {/* Counter central — "X / N" + chip "respondidas" sutil */}
      <div className="flex items-center gap-2.5 text-foreground/55">
        <span className="numeric font-medium text-foreground/85">
          {activeIndex + 1}
        </span>
        <span aria-hidden className="text-foreground/30">
          /
        </span>
        <span className="numeric text-foreground/55">{total}</span>
        {respondidas > 0 && (
          <span className="ml-2 text-eyebrow text-gold-deep">
            {respondidas} marcada{respondidas === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Siguiente → — link minimal, disabled cuando no hay next */}
      <button
        type="button"
        onClick={() => canNext && onChange(activeIndex + 1)}
        disabled={!canNext}
        aria-label="Siguiente pregunta"
        className={cn(
          'inline-flex items-center gap-1.5 font-medium tracking-tight transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/30 rounded',
          canNext
            ? 'text-foreground/65 hover:text-foreground'
            : 'text-foreground/25 cursor-not-allowed'
        )}
      >
        Siguiente
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </nav>
  );
}
