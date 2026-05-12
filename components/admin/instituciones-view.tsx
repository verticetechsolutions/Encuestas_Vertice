'use client';

// InstitucionesView — vista cliente del catálogo de instituciones.
//
// Composición:
// - Hero KPI editorial (organic bottom-left): total instituciones + breakdown
//   (sesiones totales, perfiles generados, activas con sesiones)
// - Card de navegación orgánico (organic top-right): searchbar + CTA
//   "Nueva institución"
// - Feed cappeado a 8 items + scroll interno
//
// Búsqueda client-side instantánea sobre razón social, nombre comercial,
// tipo y email.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, X, Plus } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { MetricCard } from '@/components/admin/metric-card';
import { InstitucionListItem } from '@/components/admin/institucion-list-item';
import { AdminScrollArea } from '@/components/admin/scroll-area';
import { NuevaInstitucionModal } from '@/components/admin/nueva-institucion-modal';

const VISIBLE_CAP = 8;
const FEED_MAX_HEIGHT = 'max-h-[600px]';

export interface InstitucionRow {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  tipo: string;
  email_contacto: string;
  created_at: Date;
  total_sesiones: number;
  ultimo_turno_at: Date | null;
  total_perfiles: number;
}

interface Props {
  rows: InstitucionRow[];
}

export function InstitucionesView({ rows }: Props) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter(
      (r) =>
        r.razon_social.toLowerCase().includes(normalizedQuery) ||
        (r.nombre_comercial?.toLowerCase().includes(normalizedQuery) ?? false) ||
        r.tipo.toLowerCase().includes(normalizedQuery) ||
        r.email_contacto.toLowerCase().includes(normalizedQuery)
    );
  }, [rows, normalizedQuery]);

  // KPIs derivados del slice filtrado actual — reactivo a búsqueda.
  const totalSesiones = useMemo(
    () => filtered.reduce((acc, r) => acc + r.total_sesiones, 0),
    [filtered]
  );
  const totalPerfiles = useMemo(
    () => filtered.reduce((acc, r) => acc + r.total_perfiles, 0),
    [filtered]
  );
  const activasCount = useMemo(
    () => filtered.filter((r) => r.total_sesiones > 0).length,
    [filtered]
  );

  const overflowCount = Math.max(0, filtered.length - VISIBLE_CAP);

  const heroLabel = normalizedQuery
    ? `coinciden con "${query.trim()}"`
    : 'instituciones registradas';

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {/* ════════════════════════════════════════════════════════════════
          ZONE 1 — HERO KPI EDITORIAL
          ════════════════════════════════════════════════════════════════ */}
      <MetricCard
        variant="hero"
        atmosphere
        organic
        eyebrow="Catálogo"
        value={filtered.length}
        label={heroLabel}
        hint={
          filtered.length > 0 ? (
            <div className="flex flex-col gap-3">
              <KpiLine
                color="var(--gold)"
                label="Sesiones totales"
                value={totalSesiones}
              />
              <KpiLine
                color="var(--gold-bright)"
                label="Perfiles generados"
                value={totalPerfiles}
              />
              <KpiLine
                color="var(--ink)"
                label="Activas"
                value={activasCount}
              />
            </div>
          ) : undefined
        }
      />

      {/* ════════════════════════════════════════════════════════════════
          ZONE 2 — CARD ORGÁNICO DE NAVEGACIÓN
          Searchbar a la izquierda + CTA "Nueva institución" a la derecha.
          ════════════════════════════════════════════════════════════════ */}
      <OrganicNavCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <motion.button
            type="button"
            onClick={() => setModalOpen(true)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="squircle group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold tracking-tight text-cream-pure shadow-card-subtle ring-1 ring-ink transition-shadow hover:bg-[var(--ink-raised)] hover:shadow-card-elevated"
          >
            <Plus
              className="size-4 transition-transform group-hover:rotate-90"
              strokeWidth={2}
            />
            Nueva institución
          </motion.button>
        </div>
      </OrganicNavCard>

      {/* ════════════════════════════════════════════════════════════════
          ZONE 3 — FEED CAPPEADO
          ════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-eyebrow text-foreground/55">Instituciones</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
              {filtered.length}{' '}
              {filtered.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {overflowCount > 0 && (
              <>
                <span className="text-foreground/25">·</span>
                <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
                  {overflowCount} más · scroll para verlas
                </span>
              </>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            isSearch={normalizedQuery.length > 0}
            onCreate={() => setModalOpen(true)}
          />
        ) : (
          <div className="squircle shadow-card-elevated rounded-3xl bg-cream-pure p-2 ring-1 ring-foreground/[0.04] md:p-3">
            {filtered.length <= VISIBLE_CAP ? (
              <div className="flex flex-col gap-1">
                {filtered.map((r, i) => (
                  <InstitucionListItem
                    key={r.id}
                    href={`/admin/instituciones/${r.id}`}
                    razonSocial={r.razon_social}
                    nombreComercial={r.nombre_comercial}
                    tipo={r.tipo}
                    email={r.email_contacto}
                    totalSesiones={r.total_sesiones}
                    totalPerfiles={r.total_perfiles}
                    lastTurnRelative={
                      r.ultimo_turno_at
                        ? formatRelative(r.ultimo_turno_at)
                        : 'Sin actividad'
                    }
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <AdminScrollArea
                maxHeight={FEED_MAX_HEIGHT}
                contentClassName="flex flex-col gap-1 pr-1"
              >
                {filtered.map((r, i) => (
                  <InstitucionListItem
                    key={r.id}
                    href={`/admin/instituciones/${r.id}`}
                    razonSocial={r.razon_social}
                    nombreComercial={r.nombre_comercial}
                    tipo={r.tipo}
                    email={r.email_contacto}
                    totalSesiones={r.total_sesiones}
                    totalPerfiles={r.total_perfiles}
                    lastTurnRelative={
                      r.ultimo_turno_at
                        ? formatRelative(r.ultimo_turno_at)
                        : 'Sin actividad'
                    }
                    index={Math.min(i, VISIBLE_CAP - 1)}
                  />
                ))}
              </AdminScrollArea>
            )}
          </div>
        )}
      </section>

      {/* Modal montado al final del view — z-50 floating sobre todo */}
      <NuevaInstitucionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// KpiLine — fila del hint del hero: dot + label microcap + valor mono
// (mirror de StatusLine en SesionesView).
// ────────────────────────────────────────────────────────────────────────────

function KpiLine({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-foreground/55">
        {label}
      </span>
      <span className="font-mono text-[13.5px] font-medium tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OrganicNavCard — mismo patrón que SesionesView/MagicLinksView.
// ────────────────────────────────────────────────────────────────────────────

function OrganicNavCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate px-6 pt-14 pb-6 md:px-8 md:pt-16 md:pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          filter:
            'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ filter: 'url(#admin-hero-organic)' }}
        >
          <div className="squircle absolute inset-x-0 top-6 bottom-0 rounded-[28px] bg-cream-pure" />
          <div className="absolute top-0 right-0 h-12 w-1/2 rounded-full bg-cream-pure" />
        </div>
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SearchInput
// ────────────────────────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="squircle group relative flex items-center gap-3 rounded-full bg-cream-pure/65 px-4 py-2.5 ring-1 ring-foreground/[0.08] transition-colors focus-within:ring-foreground/20 hover:ring-foreground/[0.14]">
      <Search
        className="size-4 shrink-0 text-foreground/45"
        strokeWidth={1.75}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por razón social, tipo o email…"
        className="flex-1 bg-transparent text-[14px] tracking-tight text-foreground placeholder:text-foreground/40 focus:outline-none"
        style={{ WebkitAppearance: 'none' }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="squircle inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground/80"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EmptyState
// ────────────────────────────────────────────────────────────────────────────

function EmptyState({
  isSearch,
  onCreate,
}: {
  isSearch: boolean;
  onCreate?: () => void;
}) {
  return (
    <div className="squircle rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03]">
      <p className="mx-auto max-w-sm text-[13px] tracking-tight text-foreground/55">
        {isSearch
          ? 'Sin instituciones que coincidan con tu búsqueda.'
          : 'Aún no hay instituciones. Crea la primera para emitir un magic link.'}
      </p>
      {!isSearch && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 inline-block cursor-pointer text-[12px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85"
        >
          Crear primera institución
        </button>
      )}
    </div>
  );
}
