'use client';

// SesionesView — vista cliente del listado de sesiones.
//
// Recibe rows ya filtrados por status (server-side) y maneja:
// - State local de búsqueda (filtra in-memory por razón social / tipo)
// - Hero reactivo al filtro+búsqueda (count y breakdown se actualizan)
// - Card de navegación orgánico (organic top-right) que agrupa searchbar +
//   chips de status. Espejo visual del hero (bottom-left).
// - Feed cappeado a ~8 ítems visibles via AdminScrollArea (scroll interno).
//
// Decisiones de diseño:
// - Status sigue siendo URL-driven (links Next) para shareability y SSR del
//   slice. Búsqueda es solo client state — barata, instantánea.
// - Si la búsqueda no matchea ningún registro, mostramos un empty state
//   distinto al "sin filtros".

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  VALID_STATUSES,
  type SesionStatus,
} from '@/lib/admin/parse-status-filter';
import { formatRelative } from '@/lib/utils';
import { MetricCard } from '@/components/admin/metric-card';
import { SesionListItem } from '@/components/admin/sesion-list-item';
import { AdminScrollArea } from '@/components/admin/scroll-area';

const STATUS_COLOR: Record<SesionStatus, string> = {
  abierta: 'var(--gold)',
  pausada: '#D4A862',
  sintetizando: 'var(--gold-bright)',
  completa: 'var(--ink)',
  abandonada: 'rgb(10 15 28 / 0.30)',
};

const STATUS_LABEL: Record<SesionStatus, string> = {
  abierta: 'Abiertas',
  pausada: 'Pausadas',
  sintetizando: 'Sintetizando',
  completa: 'Completas',
  abandonada: 'Abandonadas',
};

const STATUS_LABEL_SINGULAR: Record<SesionStatus, string> = {
  abierta: 'Abierta',
  pausada: 'Pausada',
  sintetizando: 'Sintetizando',
  completa: 'Completa',
  abandonada: 'Abandonada',
};

const VISIBLE_CAP = 8;
// Altura calibrada para 8 ítems del SesionListItem (~64px alto + gap-1).
// 8·64 + 7·4 = 540px. Damos 560 para que el último item respire bajo la
// curva del scrollbar fade.
const FEED_MAX_HEIGHT = 'max-h-[560px]';

interface Row {
  sesion_id: string;
  status: string;
  started_at: Date;
  ultimo_turno_at: Date;
  cajas_llenas: number;
  cajas_aplicables: number;
  institucion_id: string;
  razon_social: string;
  tipo: string;
}

interface Props {
  rows: Row[];
  activeStatuses: SesionStatus[];
  truncated: boolean;
  hardLimit: number;
  hasExplicitFilter: boolean;
}

export function SesionesView({
  rows,
  activeStatuses,
  truncated,
  hardLimit,
  hasExplicitFilter,
}: Props) {
  const [query, setQuery] = useState('');
  const activeSet = useMemo(() => new Set(activeStatuses), [activeStatuses]);
  const isDefault =
    activeSet.size === 2 &&
    activeSet.has('abierta') &&
    activeSet.has('sintetizando');

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter(
      (r) =>
        r.razon_social.toLowerCase().includes(normalizedQuery) ||
        r.tipo.toLowerCase().includes(normalizedQuery)
    );
  }, [rows, normalizedQuery]);

  // Breakdown por status dentro del slice filtrado actual.
  const breakdown = useMemo(() => {
    const map = new Map<SesionStatus, number>();
    for (const r of filtered) {
      const s = r.status as SesionStatus;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const heroLabel = normalizedQuery
    ? `coinciden con "${query.trim()}"`
    : isDefault
      ? 'sesiones vivas (abiertas y sintetizando)'
      : activeStatuses.length === 1
        ? `sesiones ${STATUS_LABEL[activeStatuses[0]].toLowerCase()}`
        : 'sesiones con los filtros actuales';

  const visibleSlice = filtered.slice(0, VISIBLE_CAP);
  const overflowCount = Math.max(0, filtered.length - VISIBLE_CAP);

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {/* ════════════════════════════════════════════════════════════════
          ZONE 1 — HERO EDITORIAL (organic bottom-left)
          ════════════════════════════════════════════════════════════════ */}
      <MetricCard
        variant="hero"
        atmosphere
        organic
        eyebrow="Operativo"
        value={filtered.length}
        label={heroLabel}
        hint={
          breakdown.length > 0 ? (
            <div className="flex flex-col gap-3">
              {breakdown.map(([s, n]) => (
                <StatusLine
                  key={s}
                  color={STATUS_COLOR[s]}
                  label={STATUS_LABEL[s]}
                  value={n}
                />
              ))}
              {truncated && (
                <span className="font-mono text-[11px] tracking-tight text-foreground/45">
                  · slice servidor limitado a {hardLimit}
                </span>
              )}
            </div>
          ) : undefined
        }
      />

      {/* ════════════════════════════════════════════════════════════════
          ZONE 2 — CARD ORGÁNICO DE NAVEGACIÓN (search + chips)
          Extrusion top-right (espejo del hero). Replica el patrón del
          MetricCard organic sin usarlo directamente porque necesita layout
          custom interno (input + chips).
          ════════════════════════════════════════════════════════════════ */}
      <OrganicNavCard>
        <div className="flex flex-col gap-5">
          {/* Searchbar */}
          <SearchInput value={query} onChange={setQuery} />

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            <ChipLink href="/admin/sesiones" active={isDefault}>
              <span className="text-[13px] tracking-tight">
                Default (vivas)
              </span>
            </ChipLink>
            {VALID_STATUSES.map((s) => {
              const isActive = activeSet.has(s);
              const next = isActive
                ? activeSet.size === 1
                  ? null
                  : Array.from(activeSet).filter((x) => x !== s)
                : [...activeStatuses, s];
              const href =
                next === null
                  ? '/admin/sesiones'
                  : `/admin/sesiones?status=${next.join(',')}`;
              return (
                <ChipLink key={s} href={href} active={isActive}>
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[s] }}
                  />
                  <span className="text-[13px] tracking-tight">
                    {STATUS_LABEL_SINGULAR[s]}
                  </span>
                </ChipLink>
              );
            })}
          </div>
        </div>
      </OrganicNavCard>

      {/* ════════════════════════════════════════════════════════════════
          ZONE 3 — FEED CAPPEADO + SCROLL INTERNO
          ════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-eyebrow text-foreground/55">Sesiones</h2>
          {overflowCount > 0 && (
            <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
              {overflowCount} más · scroll para verlas
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            isSearch={normalizedQuery.length > 0}
            isExplicitFilter={hasExplicitFilter}
          />
        ) : (
          <div className="squircle shadow-card-elevated rounded-3xl bg-cream-pure p-2 ring-1 ring-foreground/[0.04] md:p-3">
            {filtered.length <= VISIBLE_CAP ? (
              <div className="flex flex-col gap-1">
                {filtered.map((s, i) => (
                  <SesionListItem
                    key={s.sesion_id}
                    href={`/admin/sesiones/${s.sesion_id}`}
                    title={s.razon_social}
                    status={
                      STATUS_LABEL_SINGULAR[s.status as SesionStatus] ??
                      s.status
                    }
                    statusColor={STATUS_COLOR[s.status as SesionStatus]}
                    tipo={s.tipo}
                    cajas={`${s.cajas_llenas}/${s.cajas_aplicables}`}
                    startedRelative={formatRelative(s.started_at)}
                    lastTurnRelative={formatRelative(s.ultimo_turno_at)}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <AdminScrollArea
                maxHeight={FEED_MAX_HEIGHT}
                contentClassName="flex flex-col gap-1 pr-1"
              >
                {filtered.map((s, i) => (
                  <SesionListItem
                    key={s.sesion_id}
                    href={`/admin/sesiones/${s.sesion_id}`}
                    title={s.razon_social}
                    status={
                      STATUS_LABEL_SINGULAR[s.status as SesionStatus] ??
                      s.status
                    }
                    statusColor={STATUS_COLOR[s.status as SesionStatus]}
                    tipo={s.tipo}
                    cajas={`${s.cajas_llenas}/${s.cajas_aplicables}`}
                    startedRelative={formatRelative(s.started_at)}
                    lastTurnRelative={formatRelative(s.ultimo_turno_at)}
                    index={Math.min(i, VISIBLE_CAP - 1)}
                  />
                ))}
              </AdminScrollArea>
            )}
          </div>
        )}

        {visibleSlice.length === filtered.length &&
          filtered.length > 0 &&
          !truncated && (
            <span className="font-mono text-[11px] tracking-tight text-foreground/40">
              Mostrando todos los resultados ({filtered.length}).
            </span>
          )}
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OrganicNavCard — wrapper con goo extrusion top-right. Replica el patrón
// de MetricCard organic pero permite children libres (no impone layout).
// ────────────────────────────────────────────────────────────────────────────

function OrganicNavCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate px-6 pt-14 pb-6 md:px-8 md:pt-16 md:pb-8">
      {/* Capa goo — main rectangle + extrusión top-right. */}
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
          {/* Main rect — clearance top-6 para que la extrusión cuelgue
              hacia arriba. */}
          <div className="squircle absolute inset-x-0 top-6 bottom-0 rounded-[28px] bg-cream-pure" />
          {/* Extrusión top-right — h-12, w-1/2. Flush con right edge. */}
          <div className="absolute top-0 right-0 h-12 w-1/2 rounded-full bg-cream-pure" />
        </div>
      </div>

      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SearchInput — input squircle con icono y clear button. Refresca state
// del padre en cada keystroke.
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
        placeholder="Buscar institución o tipo…"
        className="flex-1 bg-transparent text-[14px] tracking-tight text-foreground placeholder:text-foreground/40 focus:outline-none"
        // search type renderiza un decorador nativo en Safari/Chrome; lo
        // suprimimos para mantener el clear button custom.
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
// ChipLink — chip squircle bg-cream con dot. Activo: ring oro suave.
// ────────────────────────────────────────────────────────────────────────────

function ChipLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const cls = active
    ? 'bg-cream-pure ring-[var(--gold-bright)]/55 text-foreground shadow-card-subtle'
    : 'bg-cream-pure/55 ring-foreground/[0.08] text-foreground/72 hover:bg-cream-pure hover:ring-foreground/[0.16]';
  return (
    <Link
      href={href}
      className={`squircle inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium ring-1 transition ${cls}`}
    >
      {children}
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EmptyState — squircle cream/40 coherente con /admin
// ────────────────────────────────────────────────────────────────────────────

function EmptyState({
  isSearch,
  isExplicitFilter,
}: {
  isSearch: boolean;
  isExplicitFilter: boolean;
}) {
  const message = isSearch
    ? 'Sin sesiones que coincidan con tu búsqueda.'
    : isExplicitFilter
      ? 'Sin sesiones con los filtros actuales.'
      : 'Aún no hay sesiones. Crea una institución para emitir un magic link.';
  return (
    <div className="squircle rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03]">
      <p className="mx-auto max-w-sm text-[13px] tracking-tight text-foreground/55">
        {message}
      </p>
      {!isSearch && isExplicitFilter && (
        <Link
          href="/admin/sesiones"
          className="mt-3 inline-block text-[12px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85"
        >
          Ver todas
        </Link>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// StatusLine — dot + label microcap + valor mono. Mirror del MetricLine del
// hero del dashboard.
// ────────────────────────────────────────────────────────────────────────────

function StatusLine({
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
