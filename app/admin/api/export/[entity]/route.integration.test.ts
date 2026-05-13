// Integration test del endpoint GET /admin/api/export/[entity]. A7 del plan.
//
// Verifica:
//   - 401 sin cookie admin.
//   - 400 con entity desconocida.
//   - 400 con format inválido.
//   - JSON: ContentType + Content-Disposition + body parseable.
//   - CSV: header row + escape de comma/quotes/newlines en cells.
//   - Las 4 entidades soportadas (instituciones, sesiones, extracciones, perfiles)
//     responden sin error (sobre DB vacía → array vacío / csv vacío).

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url.trim().length === 0) {
    return { db: null, client: null, url: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/postgres-js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require('postgres');
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client);
  return { db, client, url };
});

vi.mock('@/lib/db', () => ({ db: hoisted.db }));

const authMock = vi.hoisted(() => ({ authenticated: true }));
vi.mock('@/lib/auth/admin', () => ({
  isAdminAuthenticated: async () => authMock.authenticated,
  getAdminUserId: async () => null, // tests run sin Google session activa
  ADMIN_COOKIE: 'vertice_admin',
}));

import { NextRequest } from 'next/server';
import { resetReviewTables } from '@/lib/motor/test-db';
import { instituciones } from '@/db/schema';
import { GET } from './route';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

afterAll(async () => {
  if (client) await client.end();
});

function makeReq(entity: string, format?: string): {
  req: NextRequest;
  ctx: { params: Promise<{ entity: string }> };
} {
  const u = format
    ? `http://localhost/admin/api/export/${entity}?format=${format}`
    : `http://localhost/admin/api/export/${entity}`;
  return {
    req: new NextRequest(u),
    ctx: { params: Promise.resolve({ entity }) },
  };
}

describe('GET /admin/api/export/[entity] — A7', () => {
  beforeEach(async () => {
    authMock.authenticated = true;
    if (db) await resetReviewTables(db);
  });

  skip('401 cuando no está autenticado', async () => {
    if (!db) return;
    authMock.authenticated = false;
    const { req, ctx } = makeReq('instituciones');
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  skip('400 cuando entity es desconocida', async () => {
    if (!db) return;
    const { req, ctx } = makeReq('zorgblat');
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; valid: string[] };
    expect(body.error).toBe('unknown_entity');
    expect(body.valid).toContain('instituciones');
  });

  skip('400 cuando format es inválido', async () => {
    if (!db) return;
    const { req, ctx } = makeReq('instituciones', 'pdf');
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_format');
  });

  skip('JSON default — Content-Disposition correcto + array parseable', async () => {
    if (!db) return;
    await db.insert(instituciones).values({
      razon_social: 'Export Test SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'export-a7@test.example',
    });

    const { req, ctx } = makeReq('instituciones');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('instituciones.json');
    const rows = (await res.json()) as Array<{ razon_social: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].razon_social).toBe('Export Test SA');
  });

  skip('CSV — header row + escape de comma/quotes', async () => {
    if (!db) return;
    await db.insert(instituciones).values({
      razon_social: 'Test, "with" commas SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'csv-a7@test.example',
    });

    const { req, ctx } = makeReq('instituciones', 'csv');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('instituciones.csv');
    const csv = await res.text();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('razon_social');
    // El valor con comma + quotes debe estar wrapped y escaped.
    const dataRow = lines[1];
    expect(dataRow).toContain('"Test, ""with"" commas SA"');
  });

  skip('todas las entidades soportadas responden 200 sobre DB vacía', async () => {
    if (!db) return;
    for (const entity of ['instituciones', 'sesiones', 'extracciones', 'perfiles']) {
      const { req, ctx } = makeReq(entity, 'json');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await GET(req as any, ctx);
      expect(res.status, `entity=${entity}`).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body), `entity=${entity}`).toBe(true);
    }
  });
});
