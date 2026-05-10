'use client';

// BatchNav minimal — Paleta A (2026-05-09 refactor + spring physics 2026-05-10).
//   - Sin pills, sin rings, sin background. Vive como text-link inline.
//   - 3 elementos: "← Anterior" (link), "X / N" counter, "Siguiente →" (link).
//   - Motion + spring physics (alineado con HeaderCTA del landing):
//     hover lift + chevron shift (direccional), tap squeeze opacity.
//   - cursor-pointer cuando enabled, cursor-not-allowed cuando disabled.

import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  SPRING_BUTTON,
  SPRING_ICON,
  iconShiftLeftVariants,
  iconShiftRightVariants,
  linkButtonVariants,
} from '@/lib/motion-presets';
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
      {/* ← Anterior */}
      <motion.button
        type="button"
        onClick={() => canPrev && onChange(activeIndex - 1)}
        disabled={!canPrev}
        aria-label="Pregunta anterior"
        initial="rest"
        animate="rest"
        whileHover={canPrev ? 'hover' : 'rest'}
        whileFocus={canPrev ? 'hover' : 'rest'}
        whileTap={canPrev ? 'tap' : 'rest'}
        variants={linkButtonVariants}
        transition={SPRING_BUTTON}
        className={cn(
          'inline-flex items-center gap-1.5 rounded font-medium tracking-tight transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/30',
          canPrev
            ? 'cursor-pointer text-foreground/65 hover:text-foreground'
            : 'cursor-not-allowed text-foreground/25'
        )}
      >
        <motion.span
          variants={iconShiftLeftVariants}
          transition={SPRING_ICON}
          className="inline-flex"
          aria-hidden
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </motion.span>
        Anterior
      </motion.button>

      {/* Counter central — "X / N" + chip "respondidas" como ghost slot.
          min-w-[140px] reserva el ancho máximo (con "X marcadas" presente)
          para que el chevron ← Anterior y Siguiente → no se desplacen
          horizontalmente cuando el chip aparece o desaparece. */}
      <div className="flex min-w-[180px] items-center justify-center gap-2.5 text-foreground/55">
        <span className="numeric font-medium text-foreground/85">
          {activeIndex + 1}
        </span>
        <span aria-hidden className="text-foreground/30">
          /
        </span>
        <span className="numeric text-foreground/55">{total}</span>
        <span
          className="ml-2 text-eyebrow text-gold-deep transition-opacity duration-200"
          style={{
            opacity: respondidas > 0 ? 1 : 0,
            visibility: respondidas > 0 ? 'visible' : 'hidden',
          }}
          aria-hidden={respondidas === 0}
        >
          {respondidas > 0
            ? `${respondidas} marcada${respondidas === 1 ? '' : 's'}`
            : ' '}
        </span>
      </div>

      {/* Siguiente → */}
      <motion.button
        type="button"
        onClick={() => canNext && onChange(activeIndex + 1)}
        disabled={!canNext}
        aria-label="Siguiente pregunta"
        initial="rest"
        animate="rest"
        whileHover={canNext ? 'hover' : 'rest'}
        whileFocus={canNext ? 'hover' : 'rest'}
        whileTap={canNext ? 'tap' : 'rest'}
        variants={linkButtonVariants}
        transition={SPRING_BUTTON}
        className={cn(
          'inline-flex items-center gap-1.5 rounded font-medium tracking-tight transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/30',
          canNext
            ? 'cursor-pointer text-foreground/65 hover:text-foreground'
            : 'cursor-not-allowed text-foreground/25'
        )}
      >
        Siguiente
        <motion.span
          variants={iconShiftRightVariants}
          transition={SPRING_ICON}
          className="inline-flex"
          aria-hidden
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </motion.span>
      </motion.button>
    </nav>
  );
}
