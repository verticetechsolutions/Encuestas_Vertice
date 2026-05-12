// Integration test del helper `cargarRehidratacion` contra Postgres real
// (Neon test branch). Fix bug O1.
//
// Cobertura:
//   - Happy path: ultimo_batch fresco + último turno agente coincide → payload.
//   - Stale: ultimo_batch presente pero un turno agente posterior sin batch → null.
//   - Sin metadata: sesión sin ultimo_batch → null.
//   - Metadata corrupta: ultimo_batch que falla validación Zod → null.
//   - Sin turnos: no hay turno agente en DB → null.

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
import { sesiones, turnos_conversacion } from '@/db/schema';
import { resetReviewTables, seedSesion } from './test-db';
import { cargarRehidratacion } from './rehidratacion';
import type { UltimoBatch } from '@/lib/schemas/pregunta-batch';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

function buildValidUltimoBatch(numero_turno_emitido: number): UltimoBatch {
  return {
    batch: {
      id: `batch-test-${numero_turno_emitido}`,
      preguntas: [
        {
          id: `batch-test-${numero_turno_emitido}-q0`,
          texto_pregunta: '¿Cuál es tu razón social?',
          cajas_objetivo: ['id_razon_social'],
          tipo: 'directa',
        },
        {
          id: `batch-test-${numero_turno_emitido}-q1`,
          texto_pregunta: '¿Bajo qué regulador operan?',
          cajas_objetivo: ['id_regulacion'],
          tipo: 'directa',
        },
      ],
    },
    numero_turno_emitido,
  };
}

async function insertTurnoAgente(
  sesion_id: string,
  numero_turno: number
): Promise<void> {
  if (!db) return;
  await db.insert(turnos_conversacion).values({
    sesion_id,
    numero_turno,
    rol: 'agente',
    contenido_texto: 'mock agente',
    fuente: 'sonnet_genera',
    modelo_llm: 'mock',
  });
}

async function insertTurnoUsuario(
  sesion_id: string,
  numero_turno: number
): Promise<void> {
  if (!db) return;
  await db.insert(turnos_conversacion).values({
    sesion_id,
    numero_turno,
    rol: 'usuario',
    contenido_texto: 'respuesta mock',
    fuente: 'usuario_tipea',
  });
}

async function setUltimoBatchEnMetadata(
  sesion_id: string,
  ultimoBatch: UltimoBatch | unknown
): Promise<void> {
  if (!db) return;
  const payload = JSON.stringify(ultimoBatch);
  await db
    .update(sesiones)
    .set({
      metadata: sql`COALESCE(${sesiones.metadata}, '{}'::jsonb)
        || jsonb_build_object('ultimo_batch', ${payload}::jsonb)`,
    })
    .where(eq(sesiones.id, sesion_id));
}

async function setBorradorEnMetadata(
  sesion_id: string,
  borrador: Record<string, string>
): Promise<void> {
  if (!db) return;
  const payload = JSON.stringify(borrador);
  await db
    .update(sesiones)
    .set({
      metadata: sql`COALESCE(${sesiones.metadata}, '{}'::jsonb)
        || jsonb_build_object('borrador_respuestas', ${payload}::jsonb)`,
    })
    .where(eq(sesiones.id, sesion_id));
}

describe('cargarRehidratacion (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  skip('happy path — ultimo_batch fresco + último agente matchea → payload', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    // Simulamos turn 1 ya completado: turno usuario (1) + turno agente (2).
    await insertTurnoUsuario(sesion_id, 1);
    await insertTurnoAgente(sesion_id, 2);
    // Sonnet emitió batch en turno 2.
    await setUltimoBatchEnMetadata(sesion_id, buildValidUltimoBatch(2));

    // Draft del usuario para una pregunta del batch.
    await setBorradorEnMetadata(sesion_id, {
      'batch-test-2-q0': 'Banco Demo Vertice SA',
    });

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });

    expect(out).not.toBeNull();
    expect(out!.batch.id).toBe('batch-test-2');
    expect(out!.batch.preguntas).toHaveLength(2);
    expect(out!.drafts['batch-test-2-q0']).toBe('Banco Demo Vertice SA');
    // Sin extracciones todavía → contador en 0 por cada grupo.
    expect(out!.llenas_por_grupo.identificacion).toBe(0);
  });

  skip('stale — turno agente posterior sin batch → null fallback', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    // Turn 1: usuario (1) → agente (2) emite batch.
    await insertTurnoUsuario(sesion_id, 1);
    await insertTurnoAgente(sesion_id, 2);
    await setUltimoBatchEnMetadata(sesion_id, buildValidUltimoBatch(2));

    // Turn 2: usuario (3) → agente (4) NO emite batch.
    // metadata.ultimo_batch sigue apuntando a numero_turno_emitido=2.
    await insertTurnoUsuario(sesion_id, 3);
    await insertTurnoAgente(sesion_id, 4);

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });
    expect(out).toBeNull();
  });

  skip('sin metadata.ultimo_batch → null', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });
    expect(out).toBeNull();
  });

  skip('metadata corrupta — shape inválido → null silencioso', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    await insertTurnoUsuario(sesion_id, 1);
    await insertTurnoAgente(sesion_id, 2);

    // Payload inválido: falta `numero_turno_emitido`.
    await setUltimoBatchEnMetadata(sesion_id, {
      batch: { id: 'b', preguntas: [] }, // también preguntas vacío → invalid
    });

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });
    expect(out).toBeNull();
  });

  skip('sin turnos agente en DB → null', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    // metadata presente pero no hay turno agente para validar freshness.
    await setUltimoBatchEnMetadata(sesion_id, buildValidUltimoBatch(2));

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });
    expect(out).toBeNull();
  });

  skip('drafts huérfanos (pregunta no en batch actual) son filtrados', async () => {
    if (!db) return;
    const { sesion_id } = await seedSesion(db, { tipo: 'banco' });
    await insertTurnoUsuario(sesion_id, 1);
    await insertTurnoAgente(sesion_id, 2);
    await setUltimoBatchEnMetadata(sesion_id, buildValidUltimoBatch(2));

    // Draft de batch antiguo + draft del batch actual.
    await setBorradorEnMetadata(sesion_id, {
      'batch-test-2-q0': 'respuesta actual',
      'batch-vieja-q5': 'respuesta huérfana',
    });

    const out = await cargarRehidratacion({ sesion_id, tipo: 'banco' });
    expect(out).not.toBeNull();
    // El helper devuelve TODOS los drafts; el filtrado por pregunta_id
    // del batch ocurre en el store (init.rehidratar). Verificamos que el
    // helper devuelve ambos (el store los limpia).
    expect(out!.drafts['batch-test-2-q0']).toBe('respuesta actual');
    expect(out!.drafts['batch-vieja-q5']).toBe('respuesta huérfana');
  });
});
