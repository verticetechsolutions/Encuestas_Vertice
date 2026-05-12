// Índice global de magic links cross-institución. Coherente con design
// system de /admin/sesiones. Server component sólo hace el fetch + parse
// del filter; la UI vive en MagicLinksView (client).

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { magic_tokens, instituciones } from '@/db/schema';
import { parseMagicStatusFilter } from '@/lib/admin/parse-magic-status-filter';
import { magicTokenStatus } from '@/lib/admin/magic-token-status';
import {
  MagicLinksView,
  type MagicLinkRow,
} from '@/components/admin/magic-links-view';

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
  const sliced = truncated ? allRows.slice(0, HARD_LIMIT) : allRows;

  const rows: MagicLinkRow[] = sliced
    .map((r) => ({ ...r, status: magicTokenStatus(r) }))
    .filter((r) => activeStatuses.includes(r.status));

  return (
    <MagicLinksView
      rows={rows}
      activeStatuses={activeStatuses}
      truncated={truncated}
      hardLimit={HARD_LIMIT}
      hasExplicitFilter={status !== undefined}
    />
  );
}
