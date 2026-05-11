'use client';

// FunnelStage — card de stage del funnel de sesiones admin. Visual: dot
// status + eyebrow microcaps arriba, número grande (ticker animado), label
// debajo. Hover micro-lift, stagger on mount via index prop.
//
// 4 stages canónicos (matchean al schema enum sesiones.status):
// - abierta:      sesiones en progreso (en flujo de cajas)
// - sintetizando: Opus está procesando (transitional state)
// - completa:     terminadas con éxito (perfiles generados)
// - abandonada:   no completadas, status final

import { motion } from 'motion/react';
import { useTicker } from './use-ticker';

interface Props {
  /** Eyebrow microcaps superior (ej. "Abiertas"). */
  eyebrow: string;
  /** Conteo del stage. Se anima con ticker ease-out-expo. */
  count: number;
  /** Label descriptiva debajo del número. */
  label: string;
  /** Color del dot status (acepta CSS var o hex). */
  statusColor: string;
  /** Index para stagger animation on mount (0-3). */
  index?: number;
  /** Onclick opcional → para hacer la card interactiva (drill-down futuro). */
  onClick?: () => void;
}

export function FunnelStage({
  eyebrow,
  count,
  label,
  statusColor,
  index = 0,
  onClick,
}: Props) {
  const ticker = useTicker(count);
  const interactive = typeof onClick === 'function';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        mass: 0.6,
        delay: index * 0.06,
      }}
      whileHover={interactive ? { y: -2 } : undefined}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`squircle shadow-card-elevated relative overflow-hidden rounded-3xl bg-cream-pure p-5 ring-1 ring-foreground/[0.08] md:p-6 ${
        interactive
          ? 'cursor-pointer transition-shadow hover:ring-foreground/[0.14]'
          : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-eyebrow text-foreground/55">{eyebrow}</span>
      </div>
      <motion.span className="mt-4 block text-[clamp(40px,4.5vw,56px)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {ticker}
      </motion.span>
      <p className="mt-2 text-[13px] tracking-tight text-foreground/55">
        {label}
      </p>
    </motion.div>
  );
}
