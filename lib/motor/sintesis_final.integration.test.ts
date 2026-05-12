// Integration test del pipeline procesarSintesisFinal contra Postgres real.
// A9 del plan de testing: complementa los 21 unit tests de
// `sintesis_final.test.ts` (con mocks) verificando el ciclo completo:
//   buildSintesisInput (real) → generarSintesis (con mock Opus) →
//   persistirPerfil (DB real) → marcarSesionCompleta (DB real).

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

import { eq } from 'drizzle-orm';
import { sesiones, perfil_decision_final } from '@/db/schema';
import { resetReviewTables, seedSesion } from './test-db';
import { procesarSintesisFinal } from './sintesis_final';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';
import type { SintesisInput } from './sintesis_final';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

afterAll(async () => {
  if (client) await client.end();
});

function perfilDe(input: SintesisInput): PerfilDecisionFinal {
  return {
    schema_version: '1.0',
    institucion: input.sesion.institucion,
    sesion_id: input.sesion.id,
    generado_at: new Date().toISOString(),
    metricas: {
      cajas_llenas: 0,
      cajas_aplicables: input.sesion.cajas_aplicables,
      completitud: 0,
      confianza_global: 0,
      cajas_criticas_pct: 0,
      cajas_blandas_pct: 0,
      casos_sinteticos_aplicados: 0,
      fatiga_detectada: false,
    },
    cajas: {},
    resumen_ejecutivo: 'Test perfil para integration A9.',
  };
}

describe('procesarSintesisFinal (integration) — A9', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  skip('happy path — sesión en sintetizando → perfil persistido + status=completa', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    // El pipeline exige status=sintetizando antes de marcar completa.
    await db
      .update(sesiones)
      .set({ status: 'sintetizando' })
      .where(eq(sesiones.id, sesion_id));

    const opusCall = vi.fn(async (input: SintesisInput) => perfilDe(input));

    const result = await procesarSintesisFinal(sesion_id, { opusCall });

    expect(result.perfil_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.version).toBe(1);
    expect(result.status_transition).toBe('completa');

    // Verificar fila persistida.
    const [perfilRow] = await db
      .select({
        version: perfil_decision_final.version,
        sesion_id: perfil_decision_final.sesion_id,
      })
      .from(perfil_decision_final)
      .where(eq(perfil_decision_final.id, result.perfil_id))
      .limit(1);
    expect(perfilRow.version).toBe(1);
    expect(perfilRow.sesion_id).toBe(sesion_id);

    // Verificar transición de status.
    const [sesionRow] = await db
      .select({ status: sesiones.status })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    expect(sesionRow.status).toBe('completa');

    expect(opusCall).toHaveBeenCalledOnce();
  });

  skip('versioning — segunda llamada incrementa version (no falla por dup)', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    await db
      .update(sesiones)
      .set({ status: 'sintetizando' })
      .where(eq(sesiones.id, sesion_id));

    const opusCall = vi.fn(async (input: SintesisInput) => perfilDe(input));

    const r1 = await procesarSintesisFinal(sesion_id, { opusCall });
    // Revertir sesión a sintetizando para poder re-ejecutar el pipeline
    // (en producción esto no se haría sin razón — pero versioning soporta
    // re-síntesis si motor decide). Acá solo validamos que version sube.
    await db
      .update(sesiones)
      .set({ status: 'sintetizando' })
      .where(eq(sesiones.id, sesion_id));

    const r2 = await procesarSintesisFinal(sesion_id, { opusCall });
    expect(r2.version).toBe(2);
    expect(r2.perfil_id).not.toBe(r1.perfil_id);
  });

  skip('sesión NO está en sintetizando → status_transition=false (guard)', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    // status='abierta' (default desde seedSesion) — el guard de
    // marcarSesionCompleta rechaza la transición.

    const opusCall = vi.fn(async (input: SintesisInput) => perfilDe(input));

    const result = await procesarSintesisFinal(sesion_id, { opusCall });
    // El perfil SÍ se persiste (orden actual: persist primero, marcar después).
    expect(result.perfil_id).toBeDefined();
    expect(result.status_transition).toBe('noop_already_processed');

    // Status sigue 'abierta'.
    const [row] = await db
      .select({ status: sesiones.status })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    expect(row.status).toBe('abierta');
  });
});
