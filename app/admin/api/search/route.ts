// GET /admin/api/search?q=<term>
// Devuelve { instituciones, sesiones, links } con cap por categoría. Auth via
// cookie admin (adminGuardOrThrow).
//
// Estrategia de matching:
//   - instituciones: ILIKE sobre razon_social/nombre_comercial/email_contacto.
//   - sesiones + magic_links: si q parece UUID parcial → match por id::text;
//     si es texto → JOIN a instituciones y match por razon_social/nombre
//     comercial. Esto cubre el caso "buscar 'Banco X'" trayendo sus sesiones
//     y links sin que el usuario tenga que copiar UUIDs.
//   - Cap: 8 instituciones, 5 sesiones, 5 links — sesiones/links son
//     "relacionadas", la cuenta es el resultado principal.

import { NextResponse } from 'next/server';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones, magic_tokens } from '@/db/schema';
import { adminGuardOrThrow } from '@/lib/auth/admin';
import {
  sanitizeQuery,
  isUuidish,
  SEARCH_MIN_LEN,
} from '@/lib/admin/search-query';

export const dynamic = 'force-dynamic';

const INST_LIMIT = 8;
const RELATED_LIMIT = 5;

export async function GET(req: Request) {
  try {
    await adminGuardOrThrow();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get('q') ?? '';
  const q = sanitizeQuery(raw);

  if (q.length < SEARCH_MIN_LEN) {
    return NextResponse.json(
      { instituciones: [], sesiones: [], links: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const pattern = `%${q}%`;
    const prefixPattern = `${q}%`;
    const isUuid = isUuidish(q);

    const nameMatch = or(
      ilike(instituciones.razon_social, pattern),
      ilike(instituciones.nombre_comercial, pattern)
    );

    const inst$ = db
      .select({
        id: instituciones.id,
        razon_social: instituciones.razon_social,
        tipo: instituciones.tipo,
      })
      .from(instituciones)
      .where(
        or(
          ilike(instituciones.razon_social, pattern),
          ilike(instituciones.nombre_comercial, pattern),
          ilike(instituciones.email_contacto, pattern)
        )
      )
      .orderBy(desc(instituciones.created_at))
      .limit(INST_LIMIT);

    const ses$ = db
      .select({
        id: sesiones.id,
        status: sesiones.status,
        started_at: sesiones.started_at,
        razon_social: instituciones.razon_social,
      })
      .from(sesiones)
      .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
      .where(
        isUuid
          ? sql`${sesiones.id}::text ILIKE ${prefixPattern}`
          : nameMatch
      )
      .orderBy(desc(sesiones.ultimo_turno_at))
      .limit(RELATED_LIMIT);

    const link$ = db
      .select({
        id: magic_tokens.id,
        institucion_id: magic_tokens.institucion_id,
        razon_social: instituciones.razon_social,
        expires_at: magic_tokens.expires_at,
        consumed_at: magic_tokens.consumed_at,
        revoked_at: magic_tokens.revoked_at,
      })
      .from(magic_tokens)
      .innerJoin(
        instituciones,
        eq(magic_tokens.institucion_id, instituciones.id)
      )
      .where(
        isUuid
          ? sql`${magic_tokens.id}::text ILIKE ${prefixPattern}`
          : nameMatch
      )
      .orderBy(desc(magic_tokens.created_at))
      .limit(RELATED_LIMIT);

    const [inst, ses, links] = await Promise.all([inst$, ses$, link$]);

    return NextResponse.json(
      { instituciones: inst, sesiones: ses, links },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('search route error:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
