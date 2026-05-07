// Integration tests del review handoff motor contra Postgres real (Neon branch
// `test-integration`). Complementa la suite mock E2E (`review.e2e.test.ts`,
// 16 tests) cubriendo los puntos donde el mock NO da señal:
//
//   1. Race conditions sobre `sesiones.secciones_cerradas` con el operador
//      jsonb `||` — el mock no simula concurrencia real.
//   2. Guards atómicos de `transicionarSesionASintetizando` (`UPDATE ... WHERE
//      status='abierta'`) — solo Postgres real reproduce la ventana de race.
//   3. Idempotencia de `declinarCaja` vía `ON CONFLICT DO NOTHING` — depende
//      del unique index real.
//   4. FK constraints (`cajas_declinadas.review_id_origen` → reviews_seccion).
//   5. Unique index (`reviews_seccion(sesion_id, grupo_ui_codigo, round)`).
//
// Skip-if-missing: si DATABASE_URL_TEST no está set, el suite entero se skipea
// con `describe.skipIf(...)`. No rompe el suite default.
//
// **Patrón de wiring**: review.ts usa el singleton `db` exportado por
// @/lib/db. Ese singleton se construye al primer import con DATABASE_URL del
// proceso (= stub local en vitest.config.ts). vi.hoisted nos deja construir un
// drizzle client con DATABASE_URL_TEST ANTES de que cualquier otro import lo
// resuelva, y vi.mock redirige `@/lib/db` a ese cliente. Así review.ts queda
// pegado al test branch para todo el suite.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql, eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Hoisted setup: construir cliente Postgres real apuntando a DATABASE_URL_TEST
// y exponerlo vía vi.mock('@/lib/db'). Ambos imports `import` posteriores y
// los imports transitivos de review.ts verán ese cliente.
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url.trim().length === 0) {
    return { db: null, client: null, url: null };
  }
  // Imports síncronos vía require() — vi.hoisted no soporta async.
  // No pasamos `schema` al drizzle() del cliente del test: el schema typed sólo
  // habilita la query builder estilo `db.query.tabla.findFirst()`. Nuestros
  // tests usan `db.select().from(tabla).where(...)` que sólo requiere los
  // table objects (importados después del vi.mock). Esto evita el bind a
  // db/schema.ts via require — TS no se carga en CJS sin loader.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/postgres-js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require('postgres');
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client);
  return { db, client, url };
});

vi.mock('@/lib/db', () => ({ db: hoisted.db }));

// Imports DESPUÉS del vi.mock — review.ts y test-db.ts importan @/lib/db de
// forma transitiva, y el mock ya está activo.
import { reviews_seccion, cajas_declinadas, sesiones } from '@/db/schema';
import {
  mergeSeccionCerrada,
  transicionarSesionASintetizando,
  declinarCaja,
} from './review';
import { resetReviewTables, seedSesion } from './test-db';

// `db` y `client` apuntan al test branch. Si `url` es null, el describe se
// skipea entero — no se llega a usar ninguno de los dos.
const { db, client, url } = hoisted;

describe.skipIf(!url)('review.ts integration (Postgres real)', () => {
  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await resetReviewTables(db!);
  });

  // ===========================================================================
  // mergeSeccionCerrada — atomic merge SQL ||
  // ===========================================================================

  it('mergeSeccionCerrada inserta key nueva y persiste el shape completo', async () => {
    const { sesion_id } = await seedSesion(db!);
    const review_id = '11111111-1111-1111-1111-111111111111';
    const cerrada_at = '2026-05-07T10:00:00.000Z';

    await mergeSeccionCerrada(sesion_id, 'identificacion', {
      cerrada_at,
      review_id,
      declino_cajas: ['id_anios_operacion'],
    });

    const [row] = await db!
      .select({ secciones_cerradas: sesiones.secciones_cerradas })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));

    expect(row.secciones_cerradas).toEqual({
      identificacion: {
        cerrada_at,
        review_id,
        declino_cajas: ['id_anios_operacion'],
      },
    });
  });

  it('mergeSeccionCerrada NO clobberea grupos previos al agregar uno nuevo', async () => {
    const { sesion_id } = await seedSesion(db!);

    await mergeSeccionCerrada(sesion_id, 'identificacion', {
      cerrada_at: '2026-05-07T10:00:00.000Z',
      review_id: '11111111-1111-1111-1111-111111111111',
      declino_cajas: [],
    });
    await mergeSeccionCerrada(sesion_id, 'productos_y_mercado', {
      cerrada_at: '2026-05-07T10:05:00.000Z',
      review_id: '22222222-2222-2222-2222-222222222222',
      declino_cajas: ['nm_sectores_excluidos'],
    });

    const [row] = await db!
      .select({ secciones_cerradas: sesiones.secciones_cerradas })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));

    const sc = row.secciones_cerradas as Record<string, unknown>;
    expect(Object.keys(sc).sort()).toEqual([
      'identificacion',
      'productos_y_mercado',
    ]);
  });

  it('mergeSeccionCerrada race: dos merges concurrentes a grupos distintos coexisten', async () => {
    // El operador jsonb `||` con `UPDATE ... SET col = COALESCE(col, '{}'::jsonb) || '{...}'::jsonb`
    // es atómico por statement: Postgres toma row-lock, evalúa la expresión y
    // hace commit. Dos UPDATEs concurrentes a la misma fila pero a keys
    // distintas se serializan; el segundo lee el resultado del primero.
    // Reproduce escenarios donde dos eventos de cierre llegan simultáneamente
    // (ej. solicitar_review_seccion + side-effect previo no resuelto).
    const { sesion_id } = await seedSesion(db!);

    await Promise.all([
      mergeSeccionCerrada(sesion_id, 'identificacion', {
        cerrada_at: '2026-05-07T10:00:00.000Z',
        review_id: '11111111-1111-1111-1111-111111111111',
        declino_cajas: [],
      }),
      mergeSeccionCerrada(sesion_id, 'operacion', {
        cerrada_at: '2026-05-07T10:00:00.000Z',
        review_id: '22222222-2222-2222-2222-222222222222',
        declino_cajas: ['op_eeff_auditados'],
      }),
    ]);

    const [row] = await db!
      .select({ secciones_cerradas: sesiones.secciones_cerradas })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));

    const sc = row.secciones_cerradas as Record<string, { review_id: string }>;
    expect(Object.keys(sc).sort()).toEqual(['identificacion', 'operacion']);
    expect(sc.identificacion.review_id).toBe(
      '11111111-1111-1111-1111-111111111111'
    );
    expect(sc.operacion.review_id).toBe(
      '22222222-2222-2222-2222-222222222222'
    );
  });

  it('mergeSeccionCerrada idempotente: re-mergear mismo grupo reemplaza payload', async () => {
    const { sesion_id } = await seedSesion(db!);

    await mergeSeccionCerrada(sesion_id, 'identificacion', {
      cerrada_at: '2026-05-07T10:00:00.000Z',
      review_id: '11111111-1111-1111-1111-111111111111',
      declino_cajas: ['id_anios_operacion'],
    });
    await mergeSeccionCerrada(sesion_id, 'identificacion', {
      cerrada_at: '2026-05-07T10:10:00.000Z',
      review_id: '99999999-9999-9999-9999-999999999999',
      declino_cajas: [],
    });

    const [row] = await db!
      .select({ secciones_cerradas: sesiones.secciones_cerradas })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));

    const sc = row.secciones_cerradas as Record<
      string,
      { review_id: string; declino_cajas: string[] }
    >;
    // operator `||` favorece al lado derecho — el segundo merge gana.
    expect(sc.identificacion.review_id).toBe(
      '99999999-9999-9999-9999-999999999999'
    );
    expect(sc.identificacion.declino_cajas).toEqual([]);
  });

  // ===========================================================================
  // transicionarSesionASintetizando — guard atómico
  // ===========================================================================

  it('transicionarSesionASintetizando: primer call retorna true y cambia status', async () => {
    const { sesion_id } = await seedSesion(db!);

    const ok = await transicionarSesionASintetizando(sesion_id);
    expect(ok).toBe(true);

    const [row] = await db!
      .select({ status: sesiones.status })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));
    expect(row.status).toBe('sintetizando');
  });

  it('transicionarSesionASintetizando: segundo call retorna false (guard)', async () => {
    const { sesion_id } = await seedSesion(db!);

    const first = await transicionarSesionASintetizando(sesion_id);
    const second = await transicionarSesionASintetizando(sesion_id);

    expect(first).toBe(true);
    expect(second).toBe(false);

    // Status debe quedar 'sintetizando' tras ambos calls — no regresa.
    const [row] = await db!
      .select({ status: sesiones.status })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));
    expect(row.status).toBe('sintetizando');
  });

  it('transicionarSesionASintetizando race: dos calls concurrentes, solo uno gana', async () => {
    // El guard `WHERE status = 'abierta'` se evalúa con row-lock; el segundo
    // UPDATE ve status='sintetizando' y matchea 0 filas → returning [].
    const { sesion_id } = await seedSesion(db!);

    const [a, b] = await Promise.all([
      transicionarSesionASintetizando(sesion_id),
      transicionarSesionASintetizando(sesion_id),
    ]);

    // Exactamente uno debe haber retornado true.
    expect([a, b].filter((x) => x).length).toBe(1);

    const [row] = await db!
      .select({ status: sesiones.status })
      .from(sesiones)
      .where(eq(sesiones.id, sesion_id));
    expect(row.status).toBe('sintetizando');
  });

  // ===========================================================================
  // declinarCaja — ON CONFLICT idempotencia + FK
  // ===========================================================================

  it('declinarCaja idempotente: segunda llamada no duplica fila', async () => {
    const { sesion_id } = await seedSesion(db!);

    // Insert review primero (FK source). Round 1, decision avanzar.
    const [r] = await db!
      .insert(reviews_seccion)
      .values({
        sesion_id,
        grupo_ui_codigo: 'identificacion',
        turno_disparador: 1,
        round: 1,
        hipotesis_sonnet: 'hip stub',
        extracciones_snapshot: [],
        cajas_no_clausuradas: [],
      })
      .returning({ id: reviews_seccion.id });

    await declinarCaja({
      sesion_id,
      caja_codigo: 'id_anios_operacion',
      razon: 'aceptada_round_1',
      review_id_origen: r.id,
      detalle: 'usuario evade',
    });
    // Misma caja, otra razón → ON CONFLICT DO NOTHING preserva la primera.
    await declinarCaja({
      sesion_id,
      caja_codigo: 'id_anios_operacion',
      razon: 'estancada_post_profundizar',
      review_id_origen: r.id,
    });

    const rows = await db!
      .select({
        razon: cajas_declinadas.razon,
        detalle: cajas_declinadas.detalle,
      })
      .from(cajas_declinadas)
      .where(
        and(
          eq(cajas_declinadas.sesion_id, sesion_id),
          eq(cajas_declinadas.caja_codigo, 'id_anios_operacion')
        )
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].razon).toBe('aceptada_round_1');
    expect(rows[0].detalle).toBe('usuario evade');
  });

  it('cajas_declinadas FK rechaza review_id_origen inexistente', async () => {
    const { sesion_id } = await seedSesion(db!);
    const fakeReviewId = '00000000-0000-0000-0000-000000000000';

    // Drizzle wrappea el error en "Failed query: ...". El postgres error real
    // queda en `error.cause` con `.code` SQLSTATE. 23503 = foreign_key_violation.
    let thrown: unknown;
    try {
      await declinarCaja({
        sesion_id,
        caja_codigo: 'id_anios_operacion',
        razon: 'aceptada_round_1',
        review_id_origen: fakeReviewId,
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const cause = (thrown as Error & { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe('23503');
  });

  // ===========================================================================
  // reviews_seccion — unique index (sesion, grupo, round)
  // ===========================================================================

  it('reviews_seccion unique index rechaza duplicados (sesion, grupo, round)', async () => {
    const { sesion_id } = await seedSesion(db!);

    await db!.insert(reviews_seccion).values({
      sesion_id,
      grupo_ui_codigo: 'identificacion',
      turno_disparador: 1,
      round: 1,
      hipotesis_sonnet: 'hip 1',
      extracciones_snapshot: [],
      cajas_no_clausuradas: [],
    });

    // 23505 = unique_violation. Mismo patrón que el FK test arriba.
    let thrown: unknown;
    try {
      await db!.insert(reviews_seccion).values({
        sesion_id,
        grupo_ui_codigo: 'identificacion',
        turno_disparador: 5,
        round: 1, // mismo round → conflict
        hipotesis_sonnet: 'hip 2',
        extracciones_snapshot: [],
        cajas_no_clausuradas: [],
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const cause = (thrown as Error & { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe('23505');
  });

  it('reviews_seccion permite round 2 para el mismo grupo', async () => {
    const { sesion_id } = await seedSesion(db!);

    await db!.insert(reviews_seccion).values({
      sesion_id,
      grupo_ui_codigo: 'identificacion',
      turno_disparador: 1,
      round: 1,
      hipotesis_sonnet: 'round 1',
      extracciones_snapshot: [],
      cajas_no_clausuradas: [],
    });
    await db!.insert(reviews_seccion).values({
      sesion_id,
      grupo_ui_codigo: 'identificacion',
      turno_disparador: 6,
      round: 2,
      hipotesis_sonnet: 'round 2 post-profundizar',
      extracciones_snapshot: [],
      cajas_no_clausuradas: [],
    });

    const rows = (await db!
      .select({ round: reviews_seccion.round })
      .from(reviews_seccion)
      .where(eq(reviews_seccion.sesion_id, sesion_id))) as Array<{
      round: number;
    }>;
    expect(rows.map((r) => r.round).sort()).toEqual([1, 2]);
  });

  // ===========================================================================
  // Cleanup sanity check — el reset entre tests funciona
  // ===========================================================================

  it('resetReviewTables limpia entre tests', async () => {
    const result = await db!.execute(sql`SELECT count(*)::int AS n FROM sesiones`);
    // postgres-js execute returns Result wrapper — Drizzle types it as
    // unknown[]. Cast minimal para leer el field.
    const rows = result as unknown as Array<{ n: number }>;
    expect(rows[0].n).toBe(0);
  });
});
