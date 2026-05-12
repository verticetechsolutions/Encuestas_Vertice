// Integration test para `guardarRespuestaPendiente` contra Postgres real.
// Cubre A4 del plan de testing:
//   - Merge atómico jsonb (no pisa otras keys en metadata).
//   - Multiple preguntas en paralelo no chocan.
//   - Sesión status != 'abierta' → falla con sesion_no_disponible.
//   - Input inválido (Zod) → falla con input_invalido.
//   - Texto vacío permitido (clearing).

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

import { eq, sql } from 'drizzle-orm';
import { sesiones } from '@/db/schema';
import { resetReviewTables, seedSesion } from '@/lib/motor/test-db';
import { guardarRespuestaPendiente } from './respuestas';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

afterAll(async () => {
  if (client) await client.end();
});

describe('guardarRespuestaPendiente (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  skip('persiste draft en metadata.borrador_respuestas', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    const out = await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'batch-x-q0',
      texto: 'Banco Demo Vertice SA',
    });
    expect(out.ok).toBe(true);

    const [row] = await db
      .select({ metadata: sesiones.metadata })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    const meta = row.metadata as { borrador_respuestas?: Record<string, string> };
    expect(meta?.borrador_respuestas?.['batch-x-q0']).toBe('Banco Demo Vertice SA');
  });

  skip('drafts de múltiples preguntas coexisten (merge atómico)', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'q1',
      texto: 'respuesta uno',
    });
    await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'q2',
      texto: 'respuesta dos',
    });

    const [row] = await db
      .select({ metadata: sesiones.metadata })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    const meta = row.metadata as { borrador_respuestas: Record<string, string> };
    expect(meta.borrador_respuestas.q1).toBe('respuesta uno');
    expect(meta.borrador_respuestas.q2).toBe('respuesta dos');
  });

  skip('preserva otras keys de metadata (no pisa con jsonb_build_object)', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    // Inyectar manualmente metadata.ultimo_batch como simula /api/turn.
    const ub = {
      batch: { id: 'b1', preguntas: [{ id: 'b1-q0', texto_pregunta: '?', cajas_objetivo: [], tipo: 'directa' }] },
      numero_turno_emitido: 2,
    };
    await db
      .update(sesiones)
      .set({
        metadata: sql`COALESCE(${sesiones.metadata}, '{}'::jsonb)
          || jsonb_build_object('ultimo_batch', ${JSON.stringify(ub)}::jsonb)`,
      })
      .where(eq(sesiones.id, sesion_id));

    // Ahora guardar un draft — debe coexistir con ultimo_batch.
    await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'b1-q0',
      texto: 'mi respuesta',
    });

    const [row] = await db
      .select({ metadata: sesiones.metadata })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id))
      .limit(1);
    const meta = row.metadata as {
      ultimo_batch?: typeof ub;
      borrador_respuestas?: Record<string, string>;
    };
    expect(meta.ultimo_batch?.numero_turno_emitido).toBe(2);
    expect(meta.borrador_respuestas?.['b1-q0']).toBe('mi respuesta');
  });

  skip('texto vacío permitido (limpia draft)', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    const out = await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'qx',
      texto: '',
    });
    expect(out.ok).toBe(true);
  });

  skip('sesión status=completa → sesion_no_disponible', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    await db
      .update(sesiones)
      .set({ status: 'completa' })
      .where(eq(sesiones.id, sesion_id));

    const out = await guardarRespuestaPendiente({
      sesion_id,
      pregunta_id: 'qx',
      texto: 'algo',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('sesion_no_disponible');
  });

  skip('sesión inexistente → sesion_no_disponible', async () => {
    if (!db) return;
    const out = await guardarRespuestaPendiente({
      sesion_id: VALID_UUID,
      pregunta_id: 'qx',
      texto: 'algo',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('sesion_no_disponible');
  });

  skip('input inválido (sesion_id no UUID) → input_invalido', async () => {
    if (!db) return;
    const out = await guardarRespuestaPendiente({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sesion_id: 'not-a-uuid' as any,
      pregunta_id: 'qx',
      texto: 'algo',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('input_invalido');
  });
});
