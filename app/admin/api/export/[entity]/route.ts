// Export CSV/JSON de entidades para auditoría/handoff. Sólo lecturas.
//
// GET /admin/api/export/<entity>?format=csv|json
// entity ∈ instituciones | sesiones | extracciones | perfiles
//
// Gate: ADMIN_COOKIE válida (validado en middleware via presencia + en este
// handler via isAdminAuthenticated). Sin la cookie, middleware redirige a
// /admin/login antes de llegar acá.

import { NextResponse, type NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  instituciones,
  sesiones,
  extracciones,
  perfil_decision_final,
} from '@/db/schema';
import { isAdminAuthenticated } from '@/lib/auth/admin';

const VALID_ENTITIES = [
  'instituciones',
  'sesiones',
  'extracciones',
  'perfiles',
] as const;
type Entity = (typeof VALID_ENTITIES)[number];

function isEntity(s: string): s is Entity {
  return (VALID_ENTITIES as readonly string[]).includes(s);
}

interface Params {
  params: Promise<{ entity: string }>;
}

export async function GET(req: NextRequest, ctx: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { entity } = await ctx.params;
  if (!isEntity(entity)) {
    return NextResponse.json(
      { error: 'unknown_entity', valid: VALID_ENTITIES },
      { status: 400 }
    );
  }

  const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'invalid_format', valid: ['csv', 'json'] },
      { status: 400 }
    );
  }

  const rows = await fetchEntity(entity);

  if (format === 'json') {
    return NextResponse.json(rows, {
      headers: {
        'Content-Disposition': `attachment; filename="${entity}.json"`,
      },
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entity}.csv"`,
    },
  });
}

async function fetchEntity(entity: Entity): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case 'instituciones':
      return (await db
        .select()
        .from(instituciones)
        .orderBy(desc(instituciones.created_at))) as Record<string, unknown>[];
    case 'sesiones':
      return (await db
        .select()
        .from(sesiones)
        .orderBy(desc(sesiones.started_at))) as Record<string, unknown>[];
    case 'extracciones':
      return (await db
        .select()
        .from(extracciones)
        .orderBy(desc(extracciones.created_at))) as Record<string, unknown>[];
    case 'perfiles':
      return (await db
        .select()
        .from(perfil_decision_final)
        .orderBy(desc(perfil_decision_final.generado_at))) as Record<
        string,
        unknown
      >[];
  }
}

// CSV mínimo, RFC-4180. Escapa quotes (doble), wrappa en quotes si tiene
// comma/quote/newline. Objetos/arrays jsonb se serializan a JSON inline (los
// dumps de Postgres ya vienen como objetos plain via Drizzle).
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)))
  );
  const lines: string[] = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(
      headers.map((h) => escapeCsv(formatCsvCell(row[h]))).join(',')
    );
  }
  return lines.join('\n');
}

function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
