// Integration tests para editarInstitucion y eliminarInstitucion.
//
// crearInstitucionConLink ya está cubierto en instituciones.integration.test.ts
// (A6). Aquí cubrimos las otras dos actions admin que tocan DB:
//
//   editarInstitucion(id, prevState, formData) — UPDATE con audit log.
//   eliminarInstitucion(id) — DELETE con pre-check FK + audit log.
//
// Patrón heredado de instituciones.integration.test.ts:
//   - vi.hoisted() para inicializar el cliente postgres-js antes de los mocks.
//   - vi.mock('@/lib/db') retorna el cliente test.
//   - vi.mock('@/lib/auth/admin') para controlar auth state per test.
//   - resetReviewTables al inicio de cada test (TRUNCATE CASCADE).
//   - skip() si DATABASE_URL_TEST no está set.

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
  getAdminUserId: async () => null, // emergency mode — audit log con admin_user_id NULL
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// headers() puede llamarse desde withAuditLog. Retornamos vacío — la función
// tiene try/catch que devuelve null en headers ausentes, así que no rompe.
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (_k: string) => null }),
}));

// withAuditLog se mockea para correr fn() sin tocar audit_admin_actions
// (tabla creada en migración 0006 que no aplica al branch test-integration).
// El audit log tiene su propio test focalizado; estos tests validan business
// logic de las actions (UPDATE/DELETE + pre-check FK + return shape) sin
// acoplarse al sub-módulo de audit.
vi.mock('@/lib/auth/audit', () => ({
  withAuditLog: async <T>(
    _action: string,
    _meta: unknown,
    fn: () => Promise<T>
  ): Promise<T> => fn(),
}));

import { eq } from 'drizzle-orm';
import { instituciones, sesiones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { crearInstitucion } from './instituciones';
import { editarInstitucion, eliminarInstitucion } from './adminInstituciones';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

function makeEditFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

afterAll(async () => {
  if (client) await client.end();
});

describe('editarInstitucion (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
    authMock.authenticated = true;
  });

  skip('happy path: actualiza razón social, tipo y email', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Original SA',
      nombre_comercial: 'Original',
      tipo: 'banco',
      email_contacto: 'edit-happy@vertice.test',
      telefono_contacto: null,
    });

    const fd = makeEditFormData({
      razon_social: 'Actualizada SAPI',
      tipo: 'sofom_er',
      email_contacto: 'edit-happy-v2@vertice.test',
    });

    const result = await editarInstitucion(inst.institucion_id, { ok: null }, fd);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({
        razon_social: instituciones.razon_social,
        tipo: instituciones.tipo,
        email_contacto: instituciones.email_contacto,
      })
      .from(instituciones)
      .where(eq(instituciones.id, inst.institucion_id))
      .limit(1);
    expect(row.razon_social).toBe('Actualizada SAPI');
    expect(row.tipo).toBe('sofom_er');
    expect(row.email_contacto).toBe('edit-happy-v2@vertice.test');
  });

  skip('actualización parcial: campos no enviados no se tocan', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Parcial SA',
      nombre_comercial: 'Parcial Original',
      tipo: 'banco',
      email_contacto: 'parcial-edit@vertice.test',
      telefono_contacto: '+525555551234',
    });

    // Solo cambio razon_social. nombre_comercial, tipo, email, telefono se preservan.
    const fd = makeEditFormData({ razon_social: 'Parcial Actualizada SA' });
    const result = await editarInstitucion(inst.institucion_id, { ok: null }, fd);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({
        razon_social: instituciones.razon_social,
        nombre_comercial: instituciones.nombre_comercial,
        tipo: instituciones.tipo,
        email_contacto: instituciones.email_contacto,
        telefono_contacto: instituciones.telefono_contacto,
      })
      .from(instituciones)
      .where(eq(instituciones.id, inst.institucion_id))
      .limit(1);
    expect(row.razon_social).toBe('Parcial Actualizada SA');
    expect(row.nombre_comercial).toBe('Parcial Original');
    expect(row.tipo).toBe('banco');
    expect(row.email_contacto).toBe('parcial-edit@vertice.test');
    expect(row.telefono_contacto).toBe('+525555551234');
  });

  skip('nombre_comercial vacío explícito limpia el campo a NULL', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Limpia SA',
      nombre_comercial: 'Tiene Nombre',
      tipo: 'sofom_enr',
      email_contacto: 'limpia-edit@vertice.test',
      telefono_contacto: null,
    });

    const fd = makeEditFormData({ nombre_comercial: '' });
    const result = await editarInstitucion(inst.institucion_id, { ok: null }, fd);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ nombre_comercial: instituciones.nombre_comercial })
      .from(instituciones)
      .where(eq(instituciones.id, inst.institucion_id))
      .limit(1);
    expect(row.nombre_comercial).toBeNull();
  });

  skip('sin auth admin: ok:false con mensaje no autorizado', async () => {
    if (!db) return;
    authMock.authenticated = false;
    const fd = makeEditFormData({ razon_social: 'No Auth Edit' });
    const result = await editarInstitucion('00000000-0000-0000-0000-000000000001', { ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/No autorizado/i);
    }
  });

  skip('id vacío: ok:false con mensaje de id inválido', async () => {
    if (!db) return;
    const fd = makeEditFormData({ razon_social: 'X SA' });
    const result = await editarInstitucion('', { ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/ID.*inválido/i);
    }
  });

  skip('id inexistente: ok:false con institución no encontrada', async () => {
    if (!db) return;
    const fakeId = '00000000-0000-0000-0000-000000000099';
    const fd = makeEditFormData({ razon_social: 'Ghost SA' });
    const result = await editarInstitucion(fakeId, { ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/no encontrada/i);
    }
  });

  skip('email duplicado: ok:false con mensaje específico (PG 23505)', async () => {
    if (!db) return;
    // Primera institución con el email que vamos a duplicar.
    await crearInstitucion({
      razon_social: 'Ocupa Email SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'ocupado-edit@vertice.test',
      telefono_contacto: null,
    });
    // Segunda institución, que va a intentar pisar el email de la primera.
    const inst2 = await crearInstitucion({
      razon_social: 'Quiere Email SA',
      nombre_comercial: null,
      tipo: 'sofom_er',
      email_contacto: 'libre-edit@vertice.test',
      telefono_contacto: null,
    });

    const fd = makeEditFormData({ email_contacto: 'ocupado-edit@vertice.test' });
    const result = await editarInstitucion(inst2.institucion_id, { ok: null }, fd);
    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error).toMatch(/existe.*otra.*email|email.*existe/i);
    }
  });

  skip('email inválido (Zod refuse): ok:false con mensaje de validación', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Validate SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'validate-edit@vertice.test',
      telefono_contacto: null,
    });

    const fd = makeEditFormData({ email_contacto: 'no-es-email' });
    const result = await editarInstitucion(inst.institucion_id, { ok: null }, fd);
    expect(result.ok).toBe(false);
    // Mensaje viene del Zod issue, formato libre — sanity check con regex flex.
    if (!result.ok && 'error' in result) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('eliminarInstitucion (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
    authMock.authenticated = true;
  });

  skip('happy path: institución sin actividad asociada se borra', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Para Borrar SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'borrar-happy@vertice.test',
      telefono_contacto: null,
    });

    const result = await eliminarInstitucion(inst.institucion_id);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ id: instituciones.id })
      .from(instituciones)
      .where(eq(instituciones.id, inst.institucion_id))
      .limit(1);
    expect(row).toBeUndefined();
  });

  skip('sin auth admin: ok:false con no autorizado', async () => {
    if (!db) return;
    authMock.authenticated = false;
    const result = await eliminarInstitucion('00000000-0000-0000-0000-000000000001');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/No autorizado/i);
  });

  skip('id vacío: ok:false con id inválido', async () => {
    if (!db) return;
    const result = await eliminarInstitucion('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ID.*inválido/i);
  });

  skip('id inexistente: ok:false con no encontrada', async () => {
    if (!db) return;
    const result = await eliminarInstitucion('00000000-0000-0000-0000-000000000099');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no encontrada/i);
  });

  skip('bloqueado por sesiones asociadas: ok:false + sesiones_count > 0', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Con Sesion SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'con-sesion@vertice.test',
      telefono_contacto: null,
    });
    // Inserto una sesión que referencia la institución.
    await db.insert(sesiones).values({
      institucion_id: inst.institucion_id,
      cajas_aplicables: 49,
      consentimiento_at: new Date(),
    });

    const result = await eliminarInstitucion(inst.institucion_id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/actividad asociada|sesiones|magic/i);
      expect(result.sesiones_count).toBeGreaterThan(0);
    }

    // Verificar que la institución sigue ahí.
    const [row] = await db
      .select({ id: instituciones.id })
      .from(instituciones)
      .where(eq(instituciones.id, inst.institucion_id))
      .limit(1);
    expect(row).toBeDefined();
  });

  skip('bloqueado por magic_tokens asociados: ok:false + magic_tokens_count > 0', async () => {
    if (!db) return;
    const inst = await crearInstitucion({
      razon_social: 'Con Token SA',
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: 'con-token@vertice.test',
      telefono_contacto: null,
    });
    // Inserto un magic_token que referencia la institución.
    await db.insert(magic_tokens).values({
      institucion_id: inst.institucion_id,
      token_hash: 'a'.repeat(64),
      expires_at: new Date(Date.now() + 3600_000),
    });

    const result = await eliminarInstitucion(inst.institucion_id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/actividad asociada|magic|tokens/i);
      expect(result.magic_tokens_count).toBeGreaterThan(0);
    }
  });
});
