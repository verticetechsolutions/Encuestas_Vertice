'use client';

// MagicLinkListItem — fila del feed de /admin/magic-links. Misma jerarquía
// tipográfica que SesionListItem para coherencia visual entre listados
// operativos del admin.
//
// Jerarquía:
//   1. Título institución (15.5px semibold)
//   2. Status pill tintado (vigente=gold, consumido=ink, expirado=amber, revocado=muted)
//   3. Meta belt con kickers (Creado, Expira, Consumo/Revoke)
//
// Left rail accent (gold al hover) + stagger animation on mount.

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface Props {
  href: string;
  /** Razón social de la institución. */
  title: string;
  /** Status label legible (ej. "Vigente"). */
  status: string;
  /** Color CSS del status. */
  statusColor: string;
  /** Creación relativa (ej. "hace 8 h"). */
  createdRelative: string;
  /** Expiración relativa (ej. "hace un momento" / "en 2 h"). */
  expiresRelative: string;
  /** Outcome relativo si aplica (ej. "consumido hace 8 h"). null si vigente. */
  outcomeRelative: string | null;
  /** Index para stagger animation. */
  index?: number;
}

export function MagicLinkListItem({
  href,
  title,
  status,
  statusColor,
  createdRelative,
  expiresRelative,
  outcomeRelative,
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
        {/* Left rail accent — gold al hover. */}
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

          {/* Row 2: meta belt con kickers — creado, expira, outcome */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetaCell kicker="Creado" value={createdRelative} />
            <MetaCell kicker="Expira" value={expiresRelative} />
            {outcomeRelative && (
              <MetaCell kicker="Outcome" value={outcomeRelative} />
            )}
          </div>
        </div>

        {/* Right column — chevron */}
        <div className="flex shrink-0 items-center pl-2">
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
// StatusPill — pill tintado mediante color-mix. Mismo pattern que SesionListItem.
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
// MetaCell — kicker microcap + valor.
// ────────────────────────────────────────────────────────────────────────────

function MetaCell({ kicker, value }: { kicker: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-foreground/40">
        {kicker}
      </span>
      <span className="text-[12px] tracking-tight text-foreground/72">
        {value}
      </span>
    </span>
  );
}
