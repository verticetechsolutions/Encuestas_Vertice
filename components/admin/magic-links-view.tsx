'use client';

// MagicLinksView — vista cliente del listado de magic links.
//
// Sin hero KPI (por decisión de diseño — la página es operativa, no de
// reporting). Solo card de navegación orgánico (filtros + searchbar) + feed
// cappeado con scroll interno. Mismo lenguaje visual que SesionesView.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  VALID_MAGIC_STATUSES,
  type MagicStatus,
} from '@/lib/admin/magic-token-status';
import { formatRelative } from '@/lib/utils';
import { MagicLinkListItem } from '@/components/admin/magic-link-list-item';
import { AdminScrollArea } from '@/components/admin/scroll-area';

const STATUS_COLOR: Record<MagicStatus, string> = {
  vigente: 'var(--gold)',
  consumido: 'var(--ink)',
  expirado: '#D4A862',
  revocado: 'rgb(10 15 28 / 0.30)',
};

const STATUS_LABEL_SINGULAR: Record<MagicStatus, string> = {
  vigente: 'Vigente',
  consumido: 'Consumido',
  expirado: 'Expirado',
  revocado: 'Revocado',
};

const VISIBLE_CAP = 8;
const FEED_MAX_HEIGHT = 'max-h-[560px]';

export interface MagicLinkRow {
  id: string;
  institucion_id: string;
  razon_social: string;
  status: MagicStatus;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
}

interface Props {
  rows: MagicLinkRow[];
  activeStatuses: MagicStatus[];
  truncated: boolean;
  hardLimit: number;
  hasExplicitFilter: boolean;
}

export function MagicLinksView({
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
    activeSet.has('vigente') &&
    activeSet.has('consumido');

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((r) =>
      r.razon_social.toLowerCase().includes(normalizedQuery)
    );
  }, [rows, normalizedQuery]);

  const overflowCount = Math.max(0, filtered.length - VISIBLE_CAP);

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {/* ════════════════════════════════════════════════════════════════
          ZONE 1 — CARD ORGÁNICO DE NAVEGACIÓN
          Extrusion top-right como en SesionesView. Sin hero arriba: esta
          es página operativa, no de KPIs.
          ════════════════════════════════════════════════════════════════ */}
      <OrganicNavCard>
        <div className="flex flex-col gap-5">
          <SearchInput value={query} onChange={setQuery} />
          <div className="flex flex-wrap gap-2">
            <ChipLink href="/admin/magic-links" active={isDefault}>
              <span className="text-[13px] tracking-tight">
                Default (operativos)
              </span>
            </ChipLink>
            {VALID_MAGIC_STATUSES.map((s) => {
              const isActive = activeSet.has(s);
              const next = isActive
                ? activeSet.size === 1
                  ? null
                  : Array.from(activeSet).filter((x) => x !== s)
                : [...activeStatuses, s];
              const href =
                next === null
                  ? '/admin/magic-links'
                  : `/admin/magic-links?status=${next.join(',')}`;
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
          ZONE 2 — FEED CAPPEADO
          ════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-eyebrow text-foreground/55">Magic links</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
              {filtered.length}{' '}
              {filtered.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {overflowCount > 0 && (
              <>
                <span className="text-foreground/25">·</span>
                <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
                  {overflowCount} más · scroll para verlos
                </span>
              </>
            )}
          </div>
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
                {filtered.map((m, i) => (
                  <MagicLinkListItem
                    key={m.id}
                    href={`/admin/instituciones/${m.institucion_id}`}
                    title={m.razon_social}
                    status={STATUS_LABEL_SINGULAR[m.status]}
                    statusColor={STATUS_COLOR[m.status]}
                    createdRelative={formatRelative(m.created_at)}
                    expiresRelative={formatRelative(m.expires_at)}
                    outcomeRelative={outcomeLabel(m)}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <AdminScrollArea
                maxHeight={FEED_MAX_HEIGHT}
                contentClassName="flex flex-col gap-1 pr-1"
              >
                {filtered.map((m, i) => (
                  <MagicLinkListItem
                    key={m.id}
                    href={`/admin/instituciones/${m.institucion_id}`}
                    title={m.razon_social}
                    status={STATUS_LABEL_SINGULAR[m.status]}
                    statusColor={STATUS_COLOR[m.status]}
                    createdRelative={formatRelative(m.created_at)}
                    expiresRelative={formatRelative(m.expires_at)}
                    outcomeRelative={outcomeLabel(m)}
                    index={Math.min(i, VISIBLE_CAP - 1)}
                  />
                ))}
              </AdminScrollArea>
            )}
          </div>
        )}

        {truncated && (
          <span className="font-mono text-[11px] tracking-tight text-foreground/40">
            · slice servidor limitado a {hardLimit}, refina los filtros
          </span>
        )}
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// outcomeLabel — texto del meta cell "Outcome" según el estado del token.
// ────────────────────────────────────────────────────────────────────────────

function outcomeLabel(m: MagicLinkRow): string | null {
  if (m.consumed_at) return `consumido ${formatRelative(m.consumed_at)}`;
  if (m.revoked_at) return `revocado ${formatRelative(m.revoked_at)}`;
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// OrganicNavCard — mismo patrón que SesionesView (extrusion top-right).
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
        placeholder="Buscar institución…"
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
// ChipLink
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
// EmptyState
// ────────────────────────────────────────────────────────────────────────────

function EmptyState({
  isSearch,
  isExplicitFilter,
}: {
  isSearch: boolean;
  isExplicitFilter: boolean;
}) {
  const message = isSearch
    ? 'Sin magic links que coincidan con tu búsqueda.'
    : isExplicitFilter
      ? 'Sin magic links con los filtros actuales.'
      : 'Aún no hay magic links emitidos.';
  return (
    <div className="squircle rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03]">
      <p className="mx-auto max-w-sm text-[13px] tracking-tight text-foreground/55">
        {message}
      </p>
      {!isSearch && isExplicitFilter && (
        <Link
          href="/admin/magic-links"
          className="mt-3 inline-block text-[12px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85"
        >
          Ver todos
        </Link>
      )}
    </div>
  );
}
