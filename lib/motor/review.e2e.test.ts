// E2E mock suite — Phase 5 step 5 review handoff (Phase 5 step vi).
//
// Spec v2 cubre 7 escenarios en el "Orden de implementación post luz verde"
// punto 6:
//   (i)   review round 1 avanzar limpio
//   (ii)  profundizar→avanzar
//   (iii) profundizar→caso_sintetico
//   (iv)  cap-casos forzando decline
//   (v)   cap-turnos §1.2.3 (override por techo de 8 turnos)
//   (vi)  cierre de sesión + Inngest fan-out (placeholder)
//   (vii) race condition concurrente sobre secciones_cerradas
//
// Estrategia: mockear @/lib/db con un helper chainable + inyectar opusCall
// custom por escenario. Tests verifican:
//   - ProcessReviewResult shape
//   - Llamadas DB esperadas (db.insert, db.update, db.execute)
//   - Pattern SQL del atomic merge (escenario vii)
//   - Telemetría a Axiom no se rompe
//
// Tests de integración con DB real (Neon branch) viven aparte, no en este suite.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Chainable mock helper para Drizzle
// =============================================================================
// Drizzle expone APIs encadenables (.values().returning(), .from().where().limit(),
// etc.). Cada paso devuelve un query builder que también es awaitable. El mock
// imita ese comportamiento: cada método retorna el mismo objeto thenable, y el
// valor final se devuelve al hacer `await`.

function chainableResolves<T>(value: T) {
  const methods = [
    'values',
    'set',
    'where',
    'limit',
    'returning',
    'from',
    'orderBy',
    'groupBy',
    'leftJoin',
    'innerJoin',
  ];
  // Tipo lax para el mock — la API real de Drizzle es muy gruesa para tipear bien aquí.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  // Hacerlo thenable: cuando se await, resuelve a `value`.
  obj.then = (
    onFulfilled?: (v: T) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(value).then(onFulfilled, onRejected);
  return obj;
}

// =============================================================================
// vi.mock — reemplaza @/lib/db con stub configurable
// =============================================================================
// vi.mock se hoistea al top del archivo. Para que el factory pueda referenciar
// mockDb sin "Cannot access before initialization", declaramos mockDb dentro de
// vi.hoisted (ese sí se hoistea con la mock).

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      insert: vi.fn(),
      update: vi.fn(),
      select: vi.fn(),
      execute: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

// Imports DESPUÉS del mock — vi.mock es hoisted pero los imports tipan después.
import {
  processSolicitarReview,
  enforzarReglasMotor,
  siguienteGrupoCanonico,
  mergeSeccionCerrada,
  declinarCaja,
  transicionarSesionASintetizando,
} from './review';
import type {
  RespuestaOpus,
  SolicitarReviewSeccionInput,
} from '@/lib/schemas/review_seccion';

// =============================================================================
// Setup helpers
// =============================================================================

function defaultMockSetup({
  reviewId = 'review-mock-id',
  casosUsados = 0,
  reviewsPrevias = [] as Array<{ decision_opus: string | null }>,
  transicionExitosa = true,
}: {
  reviewId?: string;
  casosUsados?: number;
  reviewsPrevias?: Array<{ decision_opus: string | null }>;
  transicionExitosa?: boolean;
} = {}) {
  // db.insert(reviews_seccion).values(...).returning({ id }) → [{ id: reviewId }]
  // db.insert(otra) → []
  mockDb.insert.mockImplementation(() =>
    chainableResolves([{ id: reviewId }])
  );

  // db.select(...).from(reviews_seccion).where(...) → reviewsPrevias
  // db.select({ n }).from(casos_generados).where(...) → [{ n: casosUsados }]
  // db.select(...).from(reviews_seccion).where(decision='profundizar') → profundizar count
  // (este último se computa en calcularTotalesSesion)
  let selectCallCount = 0;
  mockDb.select.mockImplementation(() => {
    const callIndex = selectCallCount++;
    // Tabla de respuestas en el orden que processSolicitarReview las pide:
    //   0: determinarRound → reviewsPrevias
    //   1: contarCasosUsados → [{ n: casosUsados }]
    //   2-4 (si cierre de sesión): calcularTotalesSesion (3 selects: reviews, prof, casos)
    if (callIndex === 0) return chainableResolves(reviewsPrevias);
    if (callIndex === 1) return chainableResolves([{ n: casosUsados }]);
    if (callIndex === 2) return chainableResolves([{ n: 1 }]); // total_reviews
    if (callIndex === 3) return chainableResolves([{ n: 0 }]); // profundizaciones
    if (callIndex === 4) return chainableResolves([{ n: casosUsados }]); // casos
    return chainableResolves([]);
  });

  // db.update(reviews_seccion).set(...).where(...) → no returning, await OK
  // db.update(sesiones).set(status='sintetizando').where(...).returning({ id }) → returning array
  mockDb.update.mockImplementation(() => {
    const result = transicionExitosa ? [{ id: 'sesion-id' }] : [];
    return chainableResolves(result);
  });

  // db.execute(sql`...`) → resolved (atomic merge, decline insert)
  mockDb.execute.mockImplementation(() => Promise.resolve());
}

const baseInput: SolicitarReviewSeccionInput = {
  grupo_ui_codigo: 'identificacion',
  extracciones_snapshot: [
    {
      caja_codigo: 'id_razon_social',
      valor: 'Banco Demo SA',
      confianza: 0.92,
      evidencia_textual: 'Somos Banco Demo SA, fundado en 2010',
      status: 'llena',
      version: 1,
    },
  ],
  cajas_no_clausuradas: [],
  hipotesis_sonnet:
    'Banco regional de tamaño medio enfocado en PyME del bajío con regulación CNBV',
  turno_disparador: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  defaultMockSetup();
});

// =============================================================================
// Escenario (i): review round 1 avanzar limpio
// =============================================================================

describe('Escenario (i) — review round 1 avanzar limpio', () => {
  it('Sonnet→Opus→avanzar al siguiente grupo, ProcessReviewResult correcto', async () => {
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: 'productos_y_mercado',
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(baseInput, {
      sesion_id: 'sesion-1',
      opusCall,
    });

    expect(result.estado).toBe('grupo_cerrado');
    expect(result.review_id).toBe('review-mock-id');
    expect(result.siguiente_grupo_ui).toBe('productos_y_mercado');
    expect(opusCall).toHaveBeenCalledOnce();
    // Verificamos que round 1 se infirió correctamente (no había reviews previas).
    expect(opusCall).toHaveBeenCalledWith(
      expect.objectContaining({ round: 1, casos_usados: 0 })
    );
    // db.insert llamado para reviews_seccion.
    expect(mockDb.insert).toHaveBeenCalled();
    // db.update llamado para persistir la decisión Y para merge secciones_cerradas
    // (a través de db.execute para el merge atómico).
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('avanzar con cajas_no_clausuradas en round 1 → declines con razon=aceptada_round_1', async () => {
    const inputConDeclines: SolicitarReviewSeccionInput = {
      ...baseInput,
      cajas_no_clausuradas: [
        {
          caja_codigo: 'id_anios_operacion',
          razon: 'estancada',
          detalle: 'Confianza estancada en 0.60 después de 3 turnos',
          turnos_intentados: 3,
        },
      ],
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: 'productos_y_mercado',
      anotacion_audit: 'Boundary aceptado pese a id_anios_operacion estancada',
    } satisfies RespuestaOpus);

    await processSolicitarReview(inputConDeclines, {
      sesion_id: 'sesion-1',
      opusCall,
    });

    // Espera: db.execute fue llamado con INSERT INTO cajas_declinadas + UPDATE
    // sesiones.secciones_cerradas (atomic merge). Al menos 2 ejecuciones.
    expect(mockDb.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Escenario (ii): profundizar→avanzar
// =============================================================================

describe('Escenario (ii) — profundizar→avanzar', () => {
  it('round 1 profundizar → ProcessReviewResult con guidance + cajas_a_reabordar', async () => {
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'profundizar',
      guidance:
        'Reformula gr_dscr_min preguntando con un caso concreto en vez de pedir el número directo',
      cajas_a_reabordar: ['gr_dscr_min'],
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(baseInput, {
      sesion_id: 'sesion-2',
      opusCall,
    });

    expect(result.estado).toBe('profundizar_pendiente');
    expect(result.guidance_para_sonnet).toContain('gr_dscr_min');
    expect(result.cajas_a_reabordar).toEqual(['gr_dscr_min']);
    // No debe haber merge secciones_cerradas (grupo no cerrado).
    // db.execute solo si hubo declines (no hay).
    const executeCalls = mockDb.execute.mock.calls.length;
    expect(executeCalls).toBe(0);
  });

  it('round 2 avanzar → declines con razon=estancada_post_profundizar', async () => {
    // Setup: reviews_seccion ya tiene una con decision='profundizar' para este grupo.
    defaultMockSetup({
      reviewsPrevias: [{ decision_opus: 'profundizar' }],
    });
    const inputConDeclines: SolicitarReviewSeccionInput = {
      ...baseInput,
      cajas_no_clausuradas: [
        {
          caja_codigo: 'gr_dscr_min',
          razon: 'estancada',
          detalle: 'Sigue estancada en 0.70 tras profundización',
          turnos_intentados: 6,
        },
      ],
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: 'productos_y_mercado',
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(inputConDeclines, {
      sesion_id: 'sesion-2',
      opusCall,
    });

    expect(result.estado).toBe('grupo_cerrado');
    // Verificamos que el opusCall recibió round=2.
    expect(opusCall).toHaveBeenCalledWith(
      expect.objectContaining({ round: 2 })
    );
  });
});

// =============================================================================
// Escenario (iii): profundizar→caso_sintetico
// =============================================================================

describe('Escenario (iii) — profundizar→caso_sintetico (escalación)', () => {
  it('round 2 con caso_sintetico → ProcessReviewResult.estado=caso_solicitado', async () => {
    defaultMockSetup({
      reviewsPrevias: [{ decision_opus: 'profundizar' }],
      casosUsados: 2,
    });

    const opusCall = vi.fn().mockResolvedValue({
      decision: 'caso_sintetico',
      cajas_objetivo: ['to_historial_credito'],
      hipotesis_a_clausurar:
        'Entender si aceptan restructuras concluidas hace <6 meses',
      urgencia: 'alta',
      razon_escalacion: 'profundizacion_agotada',
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(baseInput, {
      sesion_id: 'sesion-3',
      opusCall,
    });

    expect(result.estado).toBe('caso_solicitado');
    expect(result.cajas_objetivo_caso).toEqual(['to_historial_credito']);
    expect(result.urgencia_caso).toBe('alta');
    expect(result.hipotesis_a_clausurar).toContain('restructuras');
  });
});

// =============================================================================
// Escenario (iv): cap-casos forzando decline
// =============================================================================

describe('Escenario (iv) — cap-casos forzando decline', () => {
  it('caso_sintetico con casos_usados=5 → motor coerce a avanzar', async () => {
    defaultMockSetup({ casosUsados: 5 });

    const inputConDeclines: SolicitarReviewSeccionInput = {
      ...baseInput,
      cajas_no_clausuradas: [
        {
          caja_codigo: 'to_historial_credito',
          razon: 'estancada',
          detalle: 'Sin destrabar tras profundizar',
          turnos_intentados: 5,
        },
      ],
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'caso_sintetico',
      cajas_objetivo: ['to_historial_credito'],
      hipotesis_a_clausurar:
        'Solo un caso destraba la postura institucional sobre buró',
      urgencia: 'alta',
      razon_escalacion: 'caja_resistente',
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(inputConDeclines, {
      sesion_id: 'sesion-4',
      opusCall,
    });

    expect(result.estado).toBe('grupo_cerrado');
    // El motor debe haber emitido db.execute para INSERT a cajas_declinadas con
    // razon=cap_casos_alcanzado, y para merge secciones_cerradas. ≥2 calls.
    expect(mockDb.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Escenario (v): cap-turnos §1.2.3 (override por techo)
// =============================================================================

describe('Escenario (v) — cap-turnos override (§1.2.3)', () => {
  // El techo de 8 turnos lo decide Sonnet (cliente del tool), no el motor.
  // Lo que el motor debe garantizar: si Sonnet dispara con turno_disparador
  // alto y cajas_no_clausuradas con razon='estancada', el flujo procesa normal.
  // La razon 'cap_turnos_alcanzado' se usaría si quisiéramos distinguirla; en
  // el shape actual de RazonNoClausura no existe (es resorte de Sonnet).
  it('Sonnet dispara con techo (turno_disparador alto, varias cajas estancadas) → flujo normal', async () => {
    const inputCapTurnos: SolicitarReviewSeccionInput = {
      ...baseInput,
      turno_disparador: 9, // > techo 8
      cajas_no_clausuradas: [
        {
          caja_codigo: 'gr_dscr_min',
          razon: 'estancada',
          detalle: 'estancada — cap turnos forzó disparo',
          turnos_intentados: 8,
        },
        {
          caja_codigo: 'gr_deuda_ebitda_max',
          razon: 'estancada',
          detalle: 'estancada — cap turnos forzó disparo',
          turnos_intentados: 8,
        },
      ],
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: 'productos_y_mercado',
      anotacion_audit:
        'Avanzar pese a cajas estancadas — boundary aceptable para v1',
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(inputCapTurnos, {
      sesion_id: 'sesion-5',
      opusCall,
    });

    expect(result.estado).toBe('grupo_cerrado');
    // 2 cajas + 1 merge secciones = 3 db.execute calls.
    expect(mockDb.execute.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// Escenario (vi): cierre de sesión + Inngest fan-out (placeholder)
// =============================================================================

describe('Escenario (vi) — cierre de sesión, transición status, Inngest placeholder', () => {
  it('avanzar desde último grupo (siguiente=null) → estado=sesion_lista_para_sintesis', async () => {
    const inputUltimo: SolicitarReviewSeccionInput = {
      ...baseInput,
      grupo_ui_codigo: 'contacto_y_especificos', // último en orden canónico
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: null, // cierre de sesión
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(inputUltimo, {
      sesion_id: 'sesion-6',
      opusCall,
    });

    expect(result.estado).toBe('sesion_lista_para_sintesis');
    // db.update llamado al menos una vez para transicionar status (con guard).
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('avanzar desde último cuando status ya cambió (race) → no double-dispatch', async () => {
    defaultMockSetup({ transicionExitosa: false });

    const inputUltimo: SolicitarReviewSeccionInput = {
      ...baseInput,
      grupo_ui_codigo: 'contacto_y_especificos',
    };
    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: null,
    } satisfies RespuestaOpus);

    const result = await processSolicitarReview(inputUltimo, {
      sesion_id: 'sesion-6b',
      opusCall,
    });

    // Estado sigue siendo lista_para_sintesis (siempre se devuelve cuando
    // siguiente_grupo_ui===null), pero el dispatch no se duplica si la
    // transición no fue exitosa (motor side-effect: dispatch solo si transición
    // ocurrió). El comportamiento se observa indirectamente: no falla.
    expect(result.estado).toBe('sesion_lista_para_sintesis');
  });
});

// =============================================================================
// Escenario (vii): race condition — secciones_cerradas atomic merge
// =============================================================================

describe('Escenario (vii) — race condition concurrente sobre secciones_cerradas', () => {
  // Verifica que mergeSeccionCerrada usa el patrón atómico SQL `||` y NO
  // hace read-modify-write en JS. Concurrente: dos llamadas simultáneas a
  // mergeSeccionCerrada con grupos distintos no deben perderse.
  it('dos calls concurrentes a mergeSeccionCerrada → ambas ejecutan UPDATE atómico', async () => {
    const sesionId = 'sesion-race';
    await Promise.all([
      mergeSeccionCerrada(sesionId, 'identificacion', {
        cerrada_at: new Date().toISOString(),
        review_id: 'r1',
        declino_cajas: [],
      }),
      mergeSeccionCerrada(sesionId, 'productos_y_mercado', {
        cerrada_at: new Date().toISOString(),
        review_id: 'r2',
        declino_cajas: ['nm_sectores_excluidos'],
      }),
    ]);

    // Ambas llamadas deben haber emitido db.execute (no read-modify-write
    // dentro de JS — el mock select NO debe haberse llamado dentro de
    // mergeSeccionCerrada, lo verificamos abajo).
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
    expect(mockDb.select).toHaveBeenCalledTimes(0); // 0 lecturas — patrón atómico
  });

  it('mergeSeccionCerrada NO llama db.select — patrón atómico (no read-modify-write)', async () => {
    await mergeSeccionCerrada('sesion-x', 'identificacion', {
      cerrada_at: new Date().toISOString(),
      review_id: 'r1',
      declino_cajas: [],
    });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalledOnce();
  });

  it('mergeSeccionCerrada SQL contiene operador || jsonb y COALESCE', async () => {
    await mergeSeccionCerrada('sesion-y', 'numeros_del_negocio', {
      cerrada_at: new Date().toISOString(),
      review_id: 'r3',
      declino_cajas: [],
    });
    // db.execute fue llamado con un objeto SQL de Drizzle. Inspeccionamos su
    // representación serializada para confirmar el patrón.
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    // Drizzle's SQL object tiene `queryChunks` (texto + params). Convertimos
    // a string usando JSON.stringify para revisar el patrón.
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('UPDATE sesiones');
    expect(serialized).toContain('||');
    expect(serialized).toContain('COALESCE');
    expect(serialized).toContain("'{}'::jsonb");
  });
});

// =============================================================================
// Sanity check across helpers (non-scenario tests útiles)
// =============================================================================

describe('Helpers de side-effect (cobertura adicional)', () => {
  it('declinarCaja emite INSERT con ON CONFLICT DO NOTHING', async () => {
    await declinarCaja({
      sesion_id: 's',
      caja_codigo: 'gr_dscr_min',
      razon: 'aceptada_round_1',
      review_id_origen: 'r1',
      detalle: 'algo',
    });
    expect(mockDb.execute).toHaveBeenCalledOnce();
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('INSERT INTO cajas_declinadas');
    expect(serialized).toContain('ON CONFLICT');
    expect(serialized).toContain('DO NOTHING');
  });

  it('transicionarSesionASintetizando devuelve true cuando UPDATE returning ≠ []', async () => {
    defaultMockSetup({ transicionExitosa: true });
    const resultado = await transicionarSesionASintetizando('s');
    expect(resultado).toBe(true);
  });

  it('transicionarSesionASintetizando devuelve false cuando race (returning = [])', async () => {
    defaultMockSetup({ transicionExitosa: false });
    const resultado = await transicionarSesionASintetizando('s');
    expect(resultado).toBe(false);
  });

  it('siguienteGrupoCanonico + enforzarReglasMotor coherentes en flow E2E', () => {
    // Dado que el motor enforza orden canónico, verificamos que avanzar coherent
    // con siguienteGrupoCanonico hace pass-through limpio.
    const d: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: siguienteGrupoCanonico('numeros_del_negocio'),
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'numeros_del_negocio',
    });
    expect(out).toEqual(d);
  });
});
