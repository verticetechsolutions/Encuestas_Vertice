'use client';

// ActivityBlock — Warp-style block model para activity feed del admin.
// Cada bloque tiene:
// - Left rail accent: foreground/8 default → gold al hover (signal de "active")
// - Top: título + status dot + status label
// - Middle: metadata belt mono (id, cajas X/Y, duración)
// - Right: relative time mono + chevron arrow
//
// Click → navega al detalle de sesión (futuro: side-drawer en lugar de page nav).

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  /** Destino del link. */
  href: string;
  /** Título principal (ej. razón social de institución). */
  title: string;
  /** Status label (ej. "Cerrada", "Sintetizando"). */
  status: string;
  /** Status color para el dot indicator. */
  statusColor?: string;
  /** Metadata belt (ej. "8/15 cajas · 11.4 min · sesion-abc..."). */
  meta?: ReactNode;
  /** Tiempo relativo (ej. "hace 5 min"). */
  relativeTime: string;
  /** Index para stagger animation on mount. */
  index?: number;
}

export function ActivityBlock({
  href,
  title,
  status,
  statusColor = 'var(--gold)',
  meta,
  relativeTime,
  index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        delay: index * 0.04,
      }}
    >
      <Link
        href={href}
        className="group/block squircle flex items-stretch gap-3 rounded-2xl p-3 transition hover:bg-foreground/[0.025] md:gap-4 md:p-4"
      >
        {/* Left rail accent — gold al hover. self-stretch para igualar la
            altura del contenido. */}
        <span
          aria-hidden
          className="w-[2px] shrink-0 self-stretch rounded-full bg-foreground/8 transition-colors group-hover/block:bg-[var(--gold)]"
        />

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-medium tracking-tight text-foreground">
              {title}
            </span>
            <span
              aria-hidden
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-foreground/55">
              {status}
            </span>
          </div>
          {meta && (
            <div className="mt-1 truncate font-mono text-[11.5px] tracking-tight text-foreground/55">
              {meta}
            </div>
          )}
        </div>

        {/* Right — relative time + arrow chevron */}
        <div className="flex shrink-0 flex-col items-end justify-between gap-1.5">
          <span className="whitespace-nowrap font-mono text-[11.5px] text-foreground/55">
            {relativeTime}
          </span>
          <ArrowRight
            className="size-3.5 text-foreground/30 transition group-hover/block:translate-x-0.5 group-hover/block:text-gold-deep"
            strokeWidth={1.5}
          />
        </div>
      </Link>
    </motion.div>
  );
}
