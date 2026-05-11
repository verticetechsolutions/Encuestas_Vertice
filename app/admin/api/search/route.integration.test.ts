// Integration tests del route handler /admin/api/search contra Postgres real.
// Patrón clonado de lib/motor/review.integration.test.ts: vi.hoisted construye
// un cliente postgres-js apuntando a DATABASE_URL_TEST y vi.mock redirige
// @/lib/db al cliente del test. Adicionalmente mockeamos @/lib/auth/admin para
// no depender de cookies reales.

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

// Mock auth: por default autenticado. Tests que necesiten 401 lo overridean.
const authMock = vi.hoisted(() => ({
  authenticated: true,
}));
vi.mock('@/lib/auth/admin', () => ({
  adminGuardOrThrow: async () => {
    if (!authMock.authenticated) throw new Error('unauthorized');
  },
}));

import { instituciones, sesiones } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { GET } from './route';

const { db, client, url } = hoisted;

describe.skipIf(!url)('GET /admin/api/search (integration)', () => {
  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await resetReviewTables(db!);
    authMock.authenticated = true;
  });

  async function callSearch(q: string): Promise<Response> {
    const req = new Request(`http://test.local/admin/api/search?q=${encodeURIComponent(q)}`);
    return GET(req);
  }

  it('devuelve 401 cuando no está autenticado', async () => {
    authMock.authenticated = false;
    const res = await callSearch('banco');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('devuelve arrays vacíos cuando q es muy corta', async () => {
    const res = await callSearch('a');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ instituciones: [], sesiones: [], links: [] });
  });

  it('encuentra instituciones por razón social (ILIKE)', async () => {
    await db!
      .insert(instituciones)
      .values([
        {
          razon_social: 'Banco Ejemplo',
          tipo: 'banco',
          email_contacto: 'a@ejemplo.test',
        },
        {
          razon_social: 'Sofom Otra',
          tipo: 'sofom_er',
          email_contacto: 'b@otra.test',
        },
      ]);

    const res = await callSearch('banco');
    const body = await res.json();
    expect(body.instituciones.length).toBe(1);
    expect(body.instituciones[0].razon_social).toBe('Banco Ejemplo');
    expect(body.sesiones).toEqual([]);
  });

  it('encuentra instituciones por email', async () => {
    await db!.insert(instituciones).values({
      razon_social: 'Test Inc',
      tipo: 'sofipo',
      email_contacto: 'unicorn@test.local',
    });

    const res = await callSearch('unicorn');
    const body = await res.json();
    expect(body.instituciones.length).toBe(1);
    expect(body.instituciones[0].razon_social).toBe('Test Inc');
  });

  it('escapa wildcards en q (% no actúa como wildcard)', async () => {
    await db!
      .insert(instituciones)
      .values([
        {
          razon_social: 'Banco Real',
          tipo: 'banco',
          email_contacto: 'real@test.test',
        },
        {
          razon_social: 'Otra Cosa',
          tipo: 'banco',
          email_contacto: 'otra@test.test',
        },
      ]);

    // q='%real%' después de escape se vuelve '\%real\%' que no debería matchear
    // como wildcard, sino como literal '%real%' que no existe en ninguna razón
    // social → 0 resultados.
    const res = await callSearch('%real%');
    const body = await res.json();
    expect(body.instituciones.length).toBe(0);
  });

  it('encuentra sesiones por UUID parcial (isUuidish)', async () => {
    const [inst] = await db!
      .insert(instituciones)
      .values({
        razon_social: 'Banco Para Sesion',
        tipo: 'banco',
        email_contacto: 'sesion@test.test',
      })
      .returning({ id: instituciones.id });

    const [ses] = await db!
      .insert(sesiones)
      .values({
        institucion_id: inst.id,
        cajas_aplicables: 49,
      })
      .returning({ id: sesiones.id });

    const prefix = ses.id.slice(0, 8); // 8 chars hex con dashes posibles
    const res = await callSearch(prefix);
    const body = await res.json();
    // El prefix matchea la sesión recién creada
    const found = body.sesiones.find((s: { id: string }) => s.id === ses.id);
    expect(found).toBeTruthy();
    expect(found.razon_social).toBe('Banco Para Sesion');
  });

  it('encuentra sesiones por nombre de institución cuando q no es UUID-ish', async () => {
    const [inst] = await db!
      .insert(instituciones)
      .values({
        razon_social: 'Banco XYZ',
        tipo: 'banco',
        email_contacto: 'xyz@test.test',
      })
      .returning({ id: instituciones.id });

    await db!.insert(sesiones).values({
      institucion_id: inst.id,
      cajas_aplicables: 49,
    });

    const res = await callSearch('banco');
    const body = await res.json();
    // 'banco' → JOIN a instituciones, match por razón social. La sesión recién
    // creada tiene que aparecer asociada a "Banco XYZ".
    expect(body.sesiones.length).toBeGreaterThan(0);
    expect(body.sesiones[0].razon_social).toBe('Banco XYZ');
  });

  it('incluye magic_links en la respuesta con shape estable', async () => {
    const res = await callSearch('a');
    const body = await res.json();
    expect(Array.isArray(body.links)).toBe(true);
  });
});
