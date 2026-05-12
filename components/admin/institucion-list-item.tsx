'use client';

// InstitucionListItem — fila del feed de /admin/instituciones. Misma
// jerarquía tipográfica que SesionListItem y MagicLinkListItem.
//
// Jerarquía:
//   1. Razón social (15.5px semibold)
//   2. Nombre comercial (sutil, debajo del título si existe)
//   3. Tipo pill (mono, neutral ink)
//   4. Meta belt con kickers (Email, Sesiones, Perfiles)
//   5. Right column: Último turno (prominente) + chevron
//
// Left rail accent (gold al hover) + stagger animation on mount.

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface Props {
  href: string;
  /** Razón social — título principal. */
  razonSocial: string;
  /** Nombre comercial opcional — subtitle. */
  nombreComercial: string | null;
  /** Tipo institución (ej. "sofom_enr"). */
  tipo: string;
  /** Email de contacto. */
  email: string;
  /** Teléfono de contacto (opcional). */
  telefono: string | null;
  /** Total sesiones registradas. */
  totalSesiones: number;
  /** Total perfiles generados. */
  totalPerfiles: number;
  /** Último turno relativo. "Sin actividad" si null. */
  lastTurnRelative: string;
  /** Index para stagger animation. */
  index?: number;
}

export function InstitucionListItem({
  href,
  razonSocial,
  nombreComercial,
  tipo,
  email,
  telefono,
  totalSesiones,
  totalPerfiles,
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
        {/* Left rail accent */}
        <span
          aria-hidden
          className="w-[2px] shrink-0 self-stretch rounded-full bg-foreground/[0.08] transition-colors group-hover/row:bg-[var(--gold)]"
        />

        {/* Contenido principal */}
        <div className="min-w-0 flex-1">
          {/* Row 1: razón social + tipo pill */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate text-[15.5px] font-semibold tracking-tight text-foreground">
              {razonSocial}
            </span>
            <TipoPill label={tipo} />
          </div>
          {/* Subtitle: nombre comercial si existe */}
          {nombreComercial && (
            <p className="mt-0.5 truncate text-[12.5px] tracking-tight text-foreground/55">
              {nombreComercial}
            </p>
          )}
          {/* Row 2: meta belt — email, tel (si hay), sesiones, perfiles */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetaCell kicker="Email" value={email} />
            {telefono && <MetaCell kicker="Tel" value={telefono} mono />}
            <MetaCell kicker="Sesiones" value={String(totalSesiones)} mono />
            <MetaCell kicker="Perfiles" value={String(totalPerfiles)} mono />
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
// TipoPill — pill neutral mono. Sin tinte por color (hay 9 tipos posibles,
// usar color para cada uno saturaría visualmente). Mantiene el lenguaje
// del StatusPill (squircle, tracking, uppercase) pero en tono ink/foreground.
// ────────────────────────────────────────────────────────────────────────────

function TipoPill({ label }: { label: string }) {
  return (
    <span className="squircle inline-flex shrink-0 items-center rounded-full bg-foreground/[0.06] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-[0.18em] text-foreground/65 ring-1 ring-foreground/[0.08]">
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MetaCell — kicker microcap + valor.
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
