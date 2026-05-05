'use client';

// BatchNav — navegación entre las N preguntas del turno actual.
//   - Dots horizontales con estado: active (lime), respondida (forest+check),
//     pendiente (outline).
//   - Botones Anterior / Siguiente a los lados (rounded-full pill).
//   - Click en un dot navega a esa pregunta.
//   - En mobile: dots compactos sin labels, en desktop: dots + label "P01"
//     en el activo.

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
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

  return (
    <nav
      aria-label="Navegación entre preguntas del turno"
      className="flex items-center gap-3"
    >
      <button
        type="button"
        onClick={() => canPrev && onChange(activeIndex - 1)}
        disabled={!canPrev}
        aria-label="Pregunta anterior"
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full ring-1 transition-all',
          canPrev
            ? 'bg-cream text-foreground ring-foreground/15 hover:bg-foreground/5 active:scale-95'
            : 'bg-cream/50 text-muted-foreground/40 ring-foreground/8 cursor-not-allowed'
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      <ol
        className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-2 ring-1 ring-foreground/10"
      >
        {preguntas.map((p, i) => {
          const esActivo = i === activeIndex;
          const respondida = p.marcada;

          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(i)}
                aria-current={esActivo ? 'step' : undefined}
                aria-label={`Ir a pregunta ${i + 1}${respondida ? ' (respondida)' : ''}`}
                className={cn(
                  'group/dot inline-flex items-center gap-1.5 rounded-full transition-all duration-200 ease-out',
                  esActivo ? 'px-3 py-1' : 'px-1 py-1'
                )}
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition-all',
                    esActivo
                      ? 'size-6 bg-lime text-lime-foreground'
                      : respondida
                      ? 'size-6 bg-forest text-primary-foreground'
                      : 'size-6 bg-muted text-muted-foreground/70 ring-1 ring-foreground/10 group-hover/dot:bg-foreground/8'
                  )}
                >
                  {respondida && !esActivo ? (
                    <Check className="size-3" strokeWidth={2.8} />
                  ) : (
                    i + 1
                  )}
                </span>
                {esActivo && (
                  <span className="font-mono text-[11px] font-semibold tracking-tight text-foreground">
                    P{(i + 1).toString().padStart(2, '0')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => canNext && onChange(activeIndex + 1)}
        disabled={!canNext}
        aria-label="Siguiente pregunta"
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full ring-1 transition-all',
          canNext
            ? 'bg-cream text-foreground ring-foreground/15 hover:bg-foreground/5 active:scale-95'
            : 'bg-cream/50 text-muted-foreground/40 ring-foreground/8 cursor-not-allowed'
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
