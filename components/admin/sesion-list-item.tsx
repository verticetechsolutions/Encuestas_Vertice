'use client';

// SesionListItem — fila del feed de /admin/sesiones. Variante de
// ActivityBlock con jerarquía tipográfica más fuerte para mejorar
// escanabilidad cuando hay >5 ítems en lista densa.
//
// Jerarquía (de mayor a menor peso):
//   1. Título institución (15.5px semibold, foreground pleno)
//   2. Status pill tintado del color de status (más leído que el dot del feed)
//   3. Relative time mono (12px tabular, foreground/72)
//   4. Meta belt con kickers (mono uppercase tracking) — separa "tipo" y "cajas"
//
// Mantiene left rail accent y stagger animation. Hover: rail→gold, chevron
// translate, ring sutil.

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface Props {
  href: string;
  /** Razón social / nombre institución. */
  title: string;
  /** Status label legible (ej. "Abierta"). */
  status: string;
  /** Color CSS del status (acepta var o hex). */
  statusColor: string;
  /** Tipo institución (ej. "sofom_enr"). */
  tipo: string;
  /** Cajas llenas / aplicables (ej. "12/54"). */
  cajas: string;
  /** Inicio relativo (ej. "hace 11 h"). */
  startedRelative: string;
  /** Último turno relativo (mostrado a la derecha). */
  lastTurnRelative: string;
  /** Index para stagger animation. */
  index?: number;
}

export function SesionListItem({
  href,
  title,
  status,
  statusColor,
  tipo,
  cajas,
  startedRelative,
  lastTurnRelative,
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
        delay: index * 0.035,
      }}
    >
      <Link
        href={href}
        className="group/row squircle flex items-stretch gap-3 rounded-2xl p-3.5 transition hover:bg-foreground/[0.025] md:gap-4 md:p-4"
      >
        {/* Left rail accent — gold al hover. self-stretch para igualar altura. */}
        <span
          aria-hidden
          className="w-[2px] shrink-0 self-stretch rounded-full bg-foreground/[0.08] transition-colors group-hover/row:bg-[var(--gold)]"
        />

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          {/* Row 1: título + status pill */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate text-[15.5px] font-semibold tracking-tight text-foreground">
              {title}
            </span>
            <StatusPill label={status} color={statusColor} />
          </div>

          {/* Row 2: meta belt con kickers — tipo, cajas, iniciada */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetaCell kicker="Tipo" value={tipo} mono />
            <MetaCell kicker="Cajas" value={cajas} mono />
            <MetaCell kicker="Iniciada" value={startedRelative} />
          </div>
        </div>

        {/* Right column — último turno + chevron */}
        <div className="flex shrink-0 flex-col items-end justify-between gap-2 pl-2">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-eyebrow text-foreground/45">
              Último turno
            </span>
            <span className="whitespace-nowrap font-mono text-[12.5px] font-medium tabular-nums text-foreground/85">
              {lastTurnRelative}
            </span>
          </div>
          <ArrowRight
            className="size-4 text-foreground/30 transition group-hover/row:translate-x-0.5 group-hover/row:text-gold-deep"
            strokeWidth={1.5}
          />
        </div>
      </Link>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StatusPill — pill tintado del color del status con ring tono coherente.
// Más prominente que el dot simple del ActivityBlock.
// ────────────────────────────────────────────────────────────────────────────

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="squircle inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color: `color-mix(in srgb, ${color} 70%, var(--ink))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MetaCell — kicker microcap + valor. Refuerza jerarquía de meta belt.
// ────────────────────────────────────────────────────────────────────────────

function MetaCell({
  kicker,
  value,
  mono = false,
}: {
  kicker: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-foreground/40">
        {kicker}
      </span>
      <span
        className={`text-[12px] tracking-tight text-foreground/72 ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </span>
  );
}
