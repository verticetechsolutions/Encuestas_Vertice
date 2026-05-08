// Índice global de sesiones con filtros por status. Default operativo:
// 'abierta' + 'sintetizando' (sesiones vivas). Filtros chips en URL → links
// que cambian ?status=...

import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { ArrowRight, Sparkles } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import {
  parseStatusFilter,
  VALID_STATUSES,
  type SesionStatus,
} from '@/lib/admin/parse-status-filter';

export const dynamic = 'force-dynamic';

const HARD_LIMIT = 500;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminSesionesIndexPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeStatuses = parseStatusFilter(status);

  const rows = await db
    .select({
      sesion_id: sesiones.id,
      status: sesiones.status,
      started_at: sesiones.started_at,
      ultimo_turno_at: sesiones.ultimo_turno_at,
      cajas_llenas: sesiones.cajas_llenas_count,
      cajas_aplicables: sesiones.cajas_aplicables,
      institucion_id: instituciones.id,
      razon_social: instituciones.razon_social,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(inArray(sesiones.status, activeStatuses))
    .orderBy(desc(sesiones.ultimo_turno_at))
    .limit(HARD_LIMIT + 1);

  const truncated = rows.length > HARD_LIMIT;
  const visible = truncated ? rows.slice(0, HARD_LIMIT) : rows;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Operativo
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Sesiones
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {visible.length} {visible.length === 1 ? 'visible' : 'visibles'}
          {truncated && ` (mostrando primeras ${HARD_LIMIT}, refina filtros)`}
        </p>
      </header>

      <FilterChips active={activeStatuses} />

      {visible.length === 0 ? (
        <EmptyState filtered={activeStatuses.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <Th>Institución</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Cajas</Th>
                <Th>Iniciada</Th>
                <Th>Último turno</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {visible.map((s) => (
                <tr
                  key={s.sesion_id}
                  className="transition hover:bg-foreground/[0.02]"
                >
                  <Td>
                    <Link
                      href={`/admin/instituciones/${s.institucion_id}`}
                      className="font-medium text-foreground hover:text-forest hover:underline"
                    >
                      {s.razon_social}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs text-muted-foreground">
                    {s.tipo}
                  </Td>
                  <Td>
                    <StatusPill status={s.status} />
                  </Td>
                  <Td className="font-mono text-xs tabular-nums">
                    {s.cajas_llenas}
                    <span className="text-muted-foreground">
                      /{s.cajas_aplicables}
                    </span>
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {formatRelative(s.started_at)}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {formatRelative(s.ultimo_turno_at)}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/sesiones/${s.sesion_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline"
                    >
                      Ver <ArrowRight className="size-3" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChips({ active }: { active: SesionStatus[] }) {
  const activeSet = new Set(active);
  return (
    <div className="flex flex-wrap gap-2">
      <ChipLink
        href="/admin/sesiones"
        active={active.length === 0 /* nunca true por default; reservado */}
      >
        Default (vivas)
      </ChipLink>
      {VALID_STATUSES.map((s) => {
        const isActive = activeSet.has(s);
        const next = isActive
          ? activeSet.size === 1
            ? null // si era el único, limpia
            : Array.from(activeSet).filter((x) => x !== s)
          : [...active, s];
        const href =
          next === null
            ? '/admin/sesiones'
            : `/admin/sesiones?status=${next.join(',')}`;
        return (
          <ChipLink key={s} href={href} active={isActive}>
            {s}
          </ChipLink>
        );
      })}
    </div>
  );
}

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
    ? 'bg-forest text-primary-foreground ring-forest'
    : 'bg-cream text-foreground ring-foreground/10 hover:bg-foreground/5';
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${cls}`}
    >
      {children}
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-3xl bg-cream p-10 text-center shadow-sm ring-1 ring-foreground/5">
      <p className="text-sm text-muted-foreground">
        {filtered
          ? 'Sin sesiones con estos filtros.'
          : 'Aún no hay sesiones. Crea una institución para emitir un magic link.'}
      </p>
      {filtered && (
        <Link
          href="/admin/sesiones"
          className="mt-3 inline-block text-xs font-medium text-forest hover:underline"
        >
          Ver todas
        </Link>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-5 py-3">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 ${className ?? ''}`}>{children}</td>;
}

const STATUS_STYLE: Record<string, string> = {
  abierta: 'bg-lime/30 text-lime-foreground ring-lime/40',
  pausada: 'bg-amber-100 text-amber-900 ring-amber-200',
  sintetizando: 'bg-forest/15 text-forest ring-forest/30',
  completa: 'bg-forest text-primary-foreground ring-forest',
  abandonada: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function StatusPill({ status }: { status: string }) {
  const cls =
    STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      <Sparkles className="size-2.5" />
      {status}
    </span>
  );
}
