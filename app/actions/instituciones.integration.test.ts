// Integration tests para server actions de instituciones (públicas y admin).
// Cubre A5 + A6 del plan de testing:
//   A5 crearInstitucion: happy, dup email, tipo inválido.
//   A6 crearInstitucionConLink: requiere auth admin, crea + emite link en
//      una sola action, FormData parsing, retorna magic_url.

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
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { eq } from 'drizzle-orm';
import { instituciones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { crearInstitucion } from './instituciones';
import { crearInstitucionConLink } from './adminInstituciones';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

afterAll(async () => {
  if (client) await client.end();
});

describe('crearInstitucion (integration) — A5', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  skip('crea institución y retorna id + cajas_aplicables>0', async () => {
    if (!db) return;
    const out = await crearInstitucion({
      razon_social: 'Banco Test SA',
      nombre_comercial: 'Banco Test',
      tipo: 'banco',
      email_contacto: 'banco-test-a5@vertice.test',
      telefono_contacto: null,
    });
    expect(out.institucion_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.cajas_aplicables).toBeGreaterThan(0);

    const [row] = await db
      .select({
        razon_social: instituciones.razon_social,
        tipo: instituciones.tipo,
      })
      .from(instituciones)
      .where(eq(instituciones.id, out.institucion_id))
      .limit(1);
    expect(row.razon_social).toBe('Banco Test SA');
    expect(row.tipo).toBe('banco');
  });

  skip('arroja en email duplicado (unique constraint)', async () => {
    if (!db) return;
    await crearInstitucion({
      razon_social: 'Primera SA',
      nombre_comercial: null,
      tipo: 'sofom_er',
      email_contacto: 'dup-a5@vertice.test',
      telefono_contacto: null,
    });
    await expect(
      crearInstitucion({
        razon_social: 'Segunda SA',
        nombre_comercial: null,
        tipo: 'sofom_er',
        email_contacto: 'dup-a5@vertice.test',
        telefono_contacto: null,
      })
    ).rejects.toThrow();
  });

  skip('arroja Zod en tipo inválido', async () => {
    if (!db) return;
    await expect(
      crearInstitucion({
        razon_social: 'X SA',
        nombre_comercial: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tipo: 'ifpe' as any, // 'ifpe' excluido por ley Fintech art. 22
        email_contacto: 'ifpe-a5@vertice.test',
        telefono_contacto: null,
      })
    ).rejects.toThrow();
  });
});

describe('crearInstitucionConLink (integration) — A6', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
    authMock.authenticated = true;
  });

  skip('happy path — crea institución + emite magic link', async () => {
    if (!db) return;
    const fd = makeFormData({
      razon_social: 'Banco A6 SA',
      nombre_comercial: 'Banco A6',
      tipo: 'banco',
      email_contacto: 'a6@vertice.test',
    });
    const result = await crearInstitucionConLink({ ok: null }, fd);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.magic_url).toMatch(/\/acceso\//);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());

    // Verificar que existe la institución + un magic_token vigente.
    const [tok] = await db
      .select({ id: magic_tokens.id })
      .from(magic_tokens)
      .where(eq(magic_tokens.institucion_id, result.institucion_id))
      .limit(1);
    expect(tok).toBeDefined();
  });

  skip('sin auth admin → ok:false con error de no autorizado', async () => {
    if (!db) return;
    authMock.authenticated = false;
    const fd = makeFormData({
      razon_social: 'No Auth SA',
      nombre_comercial: '',
      tipo: 'banco',
      email_contacto: 'noauth-a6@vertice.test',
    });
    const result = await crearInstitucionConLink({ ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/No autorizado/i);
    }
  });

  skip('email duplicado → ok:false con mensaje accionable', async () => {
    if (!db) return;
    await crearInstitucion({
      razon_social: 'Pre-existente SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'dup-a6@vertice.test',
      telefono_contacto: null,
    });

    const fd = makeFormData({
      razon_social: 'Intenta crear duplicado SA',
      nombre_comercial: '',
      tipo: 'banco',
      email_contacto: 'dup-a6@vertice.test',
    });
    const result = await crearInstitucionConLink({ ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/email|duplicad|existe/i);
    }
  });

  skip('FormData con nombre_comercial vacío → se guarda como null', async () => {
    if (!db) return;
    const fd = makeFormData({
      razon_social: 'Solo razón social SA',
      nombre_comercial: '   ', // whitespace solo → debe normalizar a null
      tipo: 'banco',
      email_contacto: 'nullnom-a6@vertice.test',
    });
    const result = await crearInstitucionConLink({ ok: null }, fd);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [row] = await db
      .select({ nombre_comercial: instituciones.nombre_comercial })
      .from(instituciones)
      .where(eq(instituciones.id, result.institucion_id))
      .limit(1);
    expect(row.nombre_comercial).toBeNull();
  });
});
