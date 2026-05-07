// Test DB helpers para integration tests contra Neon branch test-integration.
//
// **Nunca** importar este archivo desde código de producción. Los integration
// tests crean su propio cliente postgres-js (no reusan @/lib/db) para no
// arrastrar el DATABASE_URL stub que aplica al resto del suite.
//
// Patrón de uso:
//   import { createTestDb, resetReviewTables, seedSesion } from './test-db';
//   const ctx = createTestDb();
//   beforeEach(() => resetReviewTables(ctx.db));
//   afterAll(() => ctx.client.end());

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDbCtx {
  db: TestDb;
  client: postgres.Sql;
  url: string;
}

export function getTestDbUrl(): string | null {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url.trim().length === 0) return null;
  return url;
}

export function createTestDb(): TestDbCtx {
  const url = getTestDbUrl();
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST not set — integration tests require a Neon branch dedicated to tests. See .env.example.'
    );
  }
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client, { schema });
  return { db, client, url };
}

// TRUNCATE solo las tablas que tocan los tests del review handoff. CASCADE
// arrastra las FKs (cajas_declinadas → reviews_seccion → sesiones; turnos,
// extracciones, casos también dependen de sesiones). El orden no importa con
// CASCADE pero lo dejamos explícito para que sea legible.
export async function resetReviewTables(db: TestDb): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      cajas_declinadas,
      reviews_seccion,
      casos_generados,
      mapa_incertidumbre_snapshots,
      eventos_correccion_manual,
      extracciones,
      turnos_conversacion,
      perfil_decision_final,
      sesiones,
      magic_tokens,
      instituciones
    RESTART IDENTITY CASCADE
  `);
}

export interface SeedSesionResult {
  institucion_id: string;
  sesion_id: string;
}

type TipoInstitucion = (typeof schema.tipoInstitucionEnum.enumValues)[number];

// Seed mínimo: una institución + una sesión 'abierta' con consentimiento.
// Suficiente para todos los tests del review handoff. El tipo y razón social
// son fijos porque los tests sólo necesitan que la sesión exista y la FK
// resuelva — no validan contra cajas aplicables.
export async function seedSesion(
  db: TestDb,
  opts: { tipo?: TipoInstitucion } = {}
): Promise<SeedSesionResult> {
  const tipo = opts.tipo ?? 'banco';
  // Email único por seed para no chocar con runs paralelos / data residual.
  const email = `test-${Math.random().toString(36).slice(2, 10)}@vertice.test`;

  const [inst] = await db
    .insert(schema.instituciones)
    .values({
      razon_social: `Test Bank ${email}`,
      nombre_comercial: 'Test',
      tipo,
      email_contacto: email,
    })
    .returning({ id: schema.instituciones.id });

  const [sesion] = await db
    .insert(schema.sesiones)
    .values({
      institucion_id: inst.id,
      cajas_aplicables: 49, // 5 + 44 — extension count irrelevant to review tests
      consentimiento_at: new Date(),
    })
    .returning({ id: schema.sesiones.id });

  return { institucion_id: inst.id, sesion_id: sesion.id };
}
