'use client';

// MagicLinkInstitucionItem — variante de MagicLinkListItem para el detalle
// de institución. Diferencias:
// - No es Link (no navega a ningún sitio — vive en su propia página)
// - Incluye RevocarButton inline cuando el token está vigente
// - Misma jerarquía tipográfica y left rail accent

import { motion } from 'motion/react';
import { RevocarButton } from './magic-link-actions';

interface Props {
  id: string;
  status: 'vigente' | 'consumido' | 'expirado' | 'revocado';
  statusLabel: string;
  statusColor: string;
  createdRelative: string;
  expiresRelative: string;
  outcomeRelative: string | null;
  index?: number;
}

export function MagicLinkInstitucionItem({
  id,
  status,
  statusLabel,
  statusColor,
  createdRelative,
  expiresRelative,
  outcomeRelative,
  index = 0,
}: Props) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        delay: index * 0.035,
      }}
      className="squircle flex items-stretch gap-3 rounded-2xl bg-cream-pure/40 p-3.5 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:gap-4 md:p-4"
    >
      {/* Left rail accent — color del status */}
      <span
        aria-hidden
        className="w-[2px] shrink-0 self-stretch rounded-full"
        style={{
          backgroundColor: `color-mix(in srgb, ${statusColor} 55%, transparent)`,
        }}
      />

      {/* Cuerpo principal */}
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusPill label={statusLabel} color={statusColor} />
          <span className="font-mono text-[10.5px] text-foreground/40">
            {id.slice(0, 8)}…
          </span>
        </header>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <MetaCell kicker="Creado" value={createdRelative} />
          <MetaCell kicker="Expira" value={expiresRelative} />
          {outcomeRelative && (
            <MetaCell kicker="Outcome" value={outcomeRelative} />
          )}
        </div>
      </div>

      {/* Right column — Revocar action solo si vigente */}
      <div className="flex shrink-0 items-center pl-2">
        {status === 'vigente' && <RevocarButton token_id={id} />}
      </div>
    </motion.article>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StatusPill — tintado con color-mix (mismo pattern)
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
