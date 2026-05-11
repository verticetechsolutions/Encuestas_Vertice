// Índice global de magic links cross-institución. Filtros chips por status
// (vigente/consumido/expirado/revocado), default operativo vigente+consumido.

import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { magic_tokens, instituciones } from '@/db/schema';
import { formatRelative } from '@/lib/utils';
import {
  parseMagicStatusFilter,
} from '@/lib/admin/parse-magic-status-filter';
import {
  magicTokenStatus,
  VALID_MAGIC_STATUSES,
  type MagicStatus,
} from '@/lib/admin/magic-token-status';

export const dynamic = 'force-dynamic';

const HARD_LIMIT = 500;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminMagicLinksIndexPage({
  searchParams,
}: Props) {
  const { status } = await searchParams;
  const activeStatuses = parseMagicStatusFilter(status);

  // Pull all rows (cap silencioso 500), filtramos en memoria por status
  // derivado. No podemos filtrar en SQL porque "expirado" depende de NOW()
  // y mezcla fácilmente con "vigente" según el momento del query.
  const allRows = await db
    .select({
      id: magic_tokens.id,
      institucion_id: magic_tokens.institucion_id,
      razon_social: instituciones.razon_social,
      created_at: magic_tokens.created_at,
      expires_at: magic_tokens.expires_at,
      consumed_at: magic_tokens.consumed_at,
      revoked_at: magic_tokens.revoked_at,
    })
    .from(magic_tokens)
    .innerJoin(instituciones, eq(magic_tokens.institucion_id, instituciones.id))
    .orderBy(desc(magic_tokens.created_at))
    .limit(HARD_LIMIT + 1);

  const truncated = allRows.length > HARD_LIMIT;
  const filtered = (truncated ? allRows.slice(0, HARD_LIMIT) : allRows).filter(
    (r) =>
      activeStatuses.includes(magicTokenStatus(r))
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Operativo
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Magic links
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'visible' : 'visibles'}
          {truncated && ` (mostrando primeras ${HARD_LIMIT}, refina filtros)`}
        </p>
      </header>

      <FilterChips active={activeStatuses} />

      {filtered.length === 0 ? (
        <EmptyState isExplicitFilter={status !== undefined} />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3">Institución</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Creado</th>
                <th scope="col" className="px-5 py-3">Expira</th>
                <th scope="col" className="px-5 py-3">Consumido / Revocado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {filtered.map((m) => {
                const s = magicTokenStatus(m);
                return (
                  <tr key={m.id} className="transition hover:bg-foreground/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/instituciones/${m.institucion_id}`}
                        className="font-medium text-foreground hover:text-gold-deep hover:underline"
                      >
                        {m.razon_social}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <MagicStatusPill status={s} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(m.created_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(m.expires_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {m.consumed_at
                        ? `consumido ${formatRelative(m.consumed_at)}`
                        : m.revoked_at
                          ? `revocado ${formatRelative(m.revoked_at)}`
                          : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChips({ active }: { active: MagicStatus[] }) {
  const activeSet = new Set(active);
  const isDefault =
    activeSet.size === 2 && activeSet.has('vigente') && activeSet.has('consumido');
  return (
    <div className="flex flex-wrap gap-2">
      <ChipLink href="/admin/magic-links" active={isDefault}>
        Default (operativos)
      </ChipLink>
      {VALID_MAGIC_STATUSES.map((s) => {
        const isActive = activeSet.has(s);
        const next = isActive
          ? activeSet.size === 1
            ? null
            : Array.from(activeSet).filter((x) => x !== s)
          : [...active, s];
        const href =
          next === null
            ? '/admin/magic-links'
            : `/admin/magic-links?status=${next.join(',')}`;
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
    ? 'bg-ink text-cream-pure ring-ink'
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

function EmptyState({ isExplicitFilter }: { isExplicitFilter: boolean }) {
  return (
    <div className="rounded-3xl bg-cream p-10 text-center shadow-sm ring-1 ring-foreground/5">
      <p className="text-sm text-muted-foreground">
        {isExplicitFilter
          ? 'Sin magic links con estos filtros.'
          : 'Aún no hay magic links emitidos.'}
      </p>
      {isExplicitFilter && (
        <Link
          href="/admin/magic-links"
          className="mt-3 inline-block text-xs font-medium text-gold-deep hover:underline"
        >
          Ver todos
        </Link>
      )}
    </div>
  );
}

const MAGIC_STATUS_STYLE: Record<string, string> = {
  vigente: 'bg-gold-bright/30 text-gold-deep ring-gold-bright/50',
  consumido: 'bg-ink text-cream-pure ring-ink',
  expirado: 'bg-amber-100 text-amber-900 ring-amber-200',
  revocado: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function MagicStatusPill({ status }: { status: string }) {
  const cls =
    MAGIC_STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}
