// Integration tests para server actions de sesiones contra Postgres real.
// Cubre A2/A3 del plan de testing:
//   - crearOReanudarSesion: crea nueva, reanuda existente abierta, falla
//     cuando institución no existe.
//   - registrarConsentimiento: setea timestamp, idempotente, no crash
//     cuando sesión no existe (UPDATE silencioso).

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
// `afterAll` se usa una vez a nivel de módulo (debajo); los describe blocks
// solo usan beforeEach para resetear estado.

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

import { eq } from 'drizzle-orm';
import { instituciones, sesiones } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { crearOReanudarSesion, registrarConsentimiento } from './sesiones';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

async function seedInst(suffix: string): Promise<string> {
  if (!db) throw new Error('no test db');
  const [inst] = await db
    .insert(instituciones)
    .values({
      razon_social: `Sesiones Test ${suffix}`,
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: `sesiones-${suffix}@test.example`,
    })
    .returning({ id: instituciones.id });
  return inst.id;
}

// Un solo afterAll a nivel del módulo para cerrar el cliente compartido —
// múltiples afterAll's anidados cerraban la conexión antes del segundo describe.
afterAll(async () => {
  if (client) await client.end();
});

describe('crearOReanudarSesion (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  skip('crea nueva sesión si no hay abierta', async () => {
    if (!db) return;
    const inst_id = await seedInst('crea');

    const out = await crearOReanudarSesion(inst_id);
    expect(out.reanudada).toBe(false);
    expect(out.sesion_id).toMatch(/^[0-9a-f-]{36}$/);

    // Verificar que la sesión existe con status=abierta + cajas_aplicables>0.
    const [row] = await db
      .select({
        status: sesiones.status,
        cajas_aplicables: sesiones.cajas_aplicables,
      })
      .from(sesiones)
      .where(eq(sesiones.id, out.sesion_id))
      .limit(1);
    expect(row.status).toBe('abierta');
    expect(row.cajas_aplicables).toBeGreaterThan(0);
  });

  skip('reanuda sesión abierta existente en lugar de crear otra', async () => {
    if (!db) return;
    const inst_id = await seedInst('reanuda');

    const first = await crearOReanudarSesion(inst_id);
    const second = await crearOReanudarSesion(inst_id);

    expect(second.sesion_id).toBe(first.sesion_id);
    expect(second.reanudada).toBe(true);
  });

  skip('crea nueva si la existente está completa (no abierta)', async () => {
    if (!db) return;
    const inst_id = await seedInst('completa');

    const first = await crearOReanudarSesion(inst_id);
    // Cerrar la sesión.
    await db
      .update(sesiones)
      .set({ status: 'completa' })
      .where(eq(sesiones.id, first.sesion_id));

    const second = await crearOReanudarSesion(inst_id);
    expect(second.sesion_id).not.toBe(first.sesion_id);
    expect(second.reanudada).toBe(false);
  });

  skip('arroja si institución no existe', async () => {
    if (!db) return;
    const fakeId = '00000000-0000-4000-8000-000000000000';
    await expect(crearOReanudarSesion(fakeId)).rejects.toThrow(/no encontrada/);
  });
});

describe('registrarConsentimiento (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  skip('setea consentimiento_at en la sesión', async () => {
    if (!db) return;
    const inst_id = await seedInst('consent');
    const { sesion_id } = await crearOReanudarSesion(inst_id);

    await registrarConsentimiento(sesion_id);

    const [row] = await db
      .select({ consentimiento_at: sesiones.consentimiento_at })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    expect(row.consentimiento_at).not.toBeNull();
    expect(row.consentimiento_at!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(row.consentimiento_at!.getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  skip('idempotente — re-llamar actualiza timestamp sin crash', async () => {
    if (!db) return;
    const inst_id = await seedInst('idem');
    const { sesion_id } = await crearOReanudarSesion(inst_id);

    await registrarConsentimiento(sesion_id);
    const [first] = await db
      .select({ consentimiento_at: sesiones.consentimiento_at })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);

    await new Promise((r) => setTimeout(r, 10));
    await registrarConsentimiento(sesion_id);
    const [second] = await db
      .select({ consentimiento_at: sesiones.consentimiento_at })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);

    expect(second.consentimiento_at!.getTime()).toBeGreaterThan(
      first.consentimiento_at!.getTime()
    );
  });

  skip('sesion inexistente — no crash (UPDATE silencioso de 0 filas)', async () => {
    if (!db) return;
    const fakeId = '00000000-0000-4000-8000-000000000001';
    // El action no valida que la sesión exista; UPDATE con WHERE inexistente
    // afecta 0 filas y retorna sin throw. Documentamos el comportamiento
    // actual — la gate de "sesión existe" vive en la ruta /bienvenida.
    await expect(registrarConsentimiento(fakeId)).resolves.toBeUndefined();
  });
});
