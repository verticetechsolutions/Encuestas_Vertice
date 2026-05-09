// GET /admin/api/search?q=<term>
// Devuelve { instituciones, sesiones } limitando 8 resultados por categoría.
// Auth via cookie admin (adminGuardOrThrow). Sesiones solo se consultan si q
// parece UUID parcial (isUuidish).

import { NextResponse } from 'next/server';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { adminGuardOrThrow } from '@/lib/auth/admin';
import {
  sanitizeQuery,
  isUuidish,
  SEARCH_MIN_LEN,
} from '@/lib/admin/search-query';

export const dynamic = 'force-dynamic';

const RESULT_LIMIT = 8;

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
      { instituciones: [], sesiones: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const pattern = `%${q}%`;
    const sesionPattern = `${q}%`;

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
      .limit(RESULT_LIMIT);

    const ses$ = isUuidish(q)
      ? db
          .select({
            id: sesiones.id,
            status: sesiones.status,
            started_at: sesiones.started_at,
            razon_social: instituciones.razon_social,
          })
          .from(sesiones)
          .innerJoin(
            instituciones,
            eq(sesiones.institucion_id, instituciones.id)
          )
          .where(sql`${sesiones.id}::text ILIKE ${sesionPattern}`)
          .limit(RESULT_LIMIT)
      : Promise.resolve([] as Array<{
          id: string;
          status: string;
          started_at: Date;
          razon_social: string;
        }>);

    const [inst, ses] = await Promise.all([inst$, ses$]);

    return NextResponse.json(
      { instituciones: inst, sesiones: ses },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('search route error:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
