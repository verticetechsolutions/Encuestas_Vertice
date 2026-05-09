import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mocks hoisted — necesarios para tests de Inngest dispatch que tocan
// processSolicitarReview (commit 9: dispatchSesionListaParaSintesis llama
// inngest.send real ahora).
// =============================================================================

const { mockDb, mockInngestSend } = vi.hoisted(() => {
  return {
    mockDb: {
      insert: vi.fn(),
      update: vi.fn(),
      select: vi.fn(),
      execute: vi.fn(),
    },
    mockInngestSend: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}));

import {
  ORDEN_CANONICO_GRUPOS,
  CAP_CASOS_SINTETICOS,
  OpusReviewPromptNotReady,
  productionOpusCall,
  enforzarReglasMotor,
  siguienteGrupoCanonico,
  razonDeclineParaAvanzar,
  processSolicitarReview,
  mergeSeccionCerrada,
} from './review';
import type {
  RespuestaOpus,
  SolicitarReviewSeccionInput,
} from '@/lib/schemas/review_seccion';

// =============================================================================
// Constantes spec v2
// =============================================================================

describe('ORDEN_CANONICO_GRUPOS (spec §4.3)', () => {
  it('contiene los 6 grupos en el orden canónico exacto', () => {
    expect([...ORDEN_CANONICO_GRUPOS]).toEqual([
      'identificacion',
      'productos_y_mercado',
      'numeros_del_negocio',
      'operacion',
      'pricing_y_criterio',
      'contacto_y_especificos',
    ]);
  });
});

describe('CAP_CASOS_SINTETICOS', () => {
  it('está cementado en 5 (memoria project_cap_casos)', () => {
    expect(CAP_CASOS_SINTETICOS).toBe(5);
  });
});

// =============================================================================
// Pure: siguienteGrupoCanonico
// =============================================================================

describe('siguienteGrupoCanonico', () => {
  it('devuelve el siguiente grupo en orden canónico', () => {
    expect(siguienteGrupoCanonico('identificacion')).toBe('productos_y_mercado');
    expect(siguienteGrupoCanonico('productos_y_mercado')).toBe('numeros_del_negocio');
    expect(siguienteGrupoCanonico('numeros_del_negocio')).toBe('operacion');
    expect(siguienteGrupoCanonico('operacion')).toBe('pricing_y_criterio');
    expect(siguienteGrupoCanonico('pricing_y_criterio')).toBe('contacto_y_especificos');
  });

  it('devuelve null para el último grupo (cierre de sesión)', () => {
    expect(siguienteGrupoCanonico('contacto_y_especificos')).toBeNull();
  });

  it('devuelve null para grupo desconocido', () => {
    expect(siguienteGrupoCanonico('inexistente')).toBeNull();
  });
});

// =============================================================================
// Pure: razonDeclineParaAvanzar (spec §6 razones canónicas)
// =============================================================================

describe('razonDeclineParaAvanzar', () => {
  const baseAvanzar = {
    decision: 'avanzar' as const,
    siguiente_grupo_ui: 'productos_y_mercado' as const,
  };

  it('round 1 sin anotación → aceptada_round_1', () => {
    expect(razonDeclineParaAvanzar(baseAvanzar, { round: 1 })).toBe('aceptada_round_1');
  });

  it('round 2 sin anotación → estancada_post_profundizar', () => {
    expect(razonDeclineParaAvanzar(baseAvanzar, { round: 2 })).toBe(
      'estancada_post_profundizar'
    );
  });

  it('avanzar con anotación cap_casos_alcanzado → cap_casos_alcanzado', () => {
    const d = {
      ...baseAvanzar,
      anotacion_audit: 'motor_coerced: cap_casos_alcanzado, forzado a avanzar',
    };
    expect(razonDeclineParaAvanzar(d, { round: 1 })).toBe('cap_casos_alcanzado');
  });

  it('avanzar coerced desde round 2 con anotación → estancada_post_profundizar', () => {
    const d = {
      ...baseAvanzar,
      anotacion_audit: 'motor_coerced: round 2 con profundizar rechazado',
    };
    expect(razonDeclineParaAvanzar(d, { round: 2 })).toBe('estancada_post_profundizar');
  });
});

// =============================================================================
// Pure: enforzarReglasMotor (spec §3 reglas 1, 2, 3)
// =============================================================================

describe('enforzarReglasMotor — Regla 1: profundizar solo en round 1', () => {
  it('round 1 + profundizar → pasa intacto', () => {
    const d: RespuestaOpus = {
      decision: 'profundizar',
      guidance: 'Reformula gr_dscr_min preguntando con un caso concreto en vez de número directo',
      cajas_a_reabordar: ['gr_dscr_min'],
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'numeros_del_negocio',
    });
    expect(out).toEqual(d);
  });

  it('round 2 + profundizar → coerce a avanzar con anotación', () => {
    const d: RespuestaOpus = {
      decision: 'profundizar',
      guidance: 'Reformula otra vez con otro caso porque el anterior no funcionó',
      cajas_a_reabordar: ['gr_dscr_min'],
    };
    const out = enforzarReglasMotor(d, {
      round: 2,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'numeros_del_negocio',
    });
    expect(out.decision).toBe('avanzar');
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBe('operacion');
      expect(out.anotacion_audit).toContain('round 2');
    }
  });
});

describe('enforzarReglasMotor — Regla 2: caso_sintetico bajo cap', () => {
  const baseCaso: RespuestaOpus = {
    decision: 'caso_sintetico',
    cajas_objetivo: ['to_historial_credito'],
    hipotesis_a_clausurar: 'Entender si aceptan restructuras concluidas hace <6 meses',
    urgencia: 'alta',
    razon_escalacion: 'profundizacion_agotada',
  };

  // Pasamos `casosPipelineReady: true` en estos tests para aislar la regla del
  // cap (el flag CASOS_PIPELINE_READY=false en módulo coercionaría todo).
  it('caso_sintetico con casos_usados < 5 + pipeline ready → pasa intacto', () => {
    const out = enforzarReglasMotor(
      baseCaso,
      {
        round: 1,
        casos_usados: 3,
        sesion_id: 's',
        grupo_ui: 'pricing_y_criterio',
      },
      { casosPipelineReady: true }
    );
    expect(out).toEqual(baseCaso);
  });

  it('caso_sintetico con casos_usados === 5 (cap) → coerce a avanzar', () => {
    const out = enforzarReglasMotor(
      baseCaso,
      {
        round: 1,
        casos_usados: 5,
        sesion_id: 's',
        grupo_ui: 'pricing_y_criterio',
      },
      { casosPipelineReady: true }
    );
    expect(out.decision).toBe('avanzar');
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBe('contacto_y_especificos');
      expect(out.anotacion_audit).toContain('cap_casos_alcanzado');
    }
  });

  it('caso_sintetico con casos_usados > 5 (corrupto) → también coerce', () => {
    const out = enforzarReglasMotor(
      baseCaso,
      {
        round: 1,
        casos_usados: 7,
        sesion_id: 's',
        grupo_ui: 'pricing_y_criterio',
      },
      { casosPipelineReady: true }
    );
    expect(out.decision).toBe('avanzar');
  });
});

describe('enforzarReglasMotor — Regla 2 (extensión): feature flag CASOS_PIPELINE_READY', () => {
  const baseCaso: RespuestaOpus = {
    decision: 'caso_sintetico',
    cajas_objetivo: ['to_historial_credito'],
    hipotesis_a_clausurar: 'Entender si aceptan restructuras concluidas hace <6 meses',
    urgencia: 'alta',
    razon_escalacion: 'profundizacion_agotada',
  };

  it('pipeline NO ready + casos_usados=0 → coerce con misma anotacion que cap', () => {
    const out = enforzarReglasMotor(
      baseCaso,
      {
        round: 1,
        casos_usados: 0,
        sesion_id: 's',
        grupo_ui: 'pricing_y_criterio',
      },
      { casosPipelineReady: false }
    );
    expect(out.decision).toBe('avanzar');
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBe('contacto_y_especificos');
      // Misma anotacion que cap_casos_alcanzado: razonDecline downstream
      // mapea ambos casos a la misma rama.
      expect(out.anotacion_audit).toContain('cap_casos_alcanzado');
    }
  });

  it('pipeline ready + casos_usados=0 → pasa intacto (sin coerción)', () => {
    const out = enforzarReglasMotor(
      baseCaso,
      {
        round: 1,
        casos_usados: 0,
        sesion_id: 's',
        grupo_ui: 'pricing_y_criterio',
      },
      { casosPipelineReady: true }
    );
    expect(out).toEqual(baseCaso);
  });

  it('default (sin opts) usa CASOS_PIPELINE_READY del módulo (hoy=false → coerce)', () => {
    const out = enforzarReglasMotor(baseCaso, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'pricing_y_criterio',
    });
    // Test acoplado al estado actual del flag. Si flag se flippa a true en el
    // futuro, este test rompe — y eso es correcto: avísale al refactor que
    // tiene que actualizar el contrato del default.
    expect(out.decision).toBe('avanzar');
  });
});

describe('enforzarReglasMotor — Regla 3: avanzar con orden canónico', () => {
  it('avanzar con siguiente_grupo_ui correcto → pasa intacto', () => {
    const d: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: 'operacion',
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'numeros_del_negocio',
    });
    expect(out).toEqual(d);
  });

  it('avanzar con siguiente_grupo_ui incorrecto → corregido por motor', () => {
    const d: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: 'identificacion', // out of order
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'numeros_del_negocio',
    });
    expect(out.decision).toBe('avanzar');
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBe('operacion');
    }
  });

  it('avanzar desde último grupo → siguiente_grupo_ui = null preservado', () => {
    const d: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: null,
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'contacto_y_especificos',
    });
    expect(out.decision).toBe('avanzar');
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBeNull();
    }
  });

  it('avanzar desde último con siguiente_grupo_ui ≠ null → corregido a null', () => {
    const d: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: 'identificacion',
    };
    const out = enforzarReglasMotor(d, {
      round: 1,
      casos_usados: 0,
      sesion_id: 's',
      grupo_ui: 'contacto_y_especificos',
    });
    if (out.decision === 'avanzar') {
      expect(out.siguiente_grupo_ui).toBeNull();
    }
  });
});

// =============================================================================
// Production opusCall — wire real (Phase 5 step iv firmado)
// =============================================================================

describe('productionOpusCall', () => {
  // Con OPUS_DIRECTOR_PROMPT_READY=true, productionOpusCall ya NO arroja
  // OpusReviewPromptNotReady — invoca generateObject del AI SDK. Sin
  // ANTHROPIC_API_KEY el AI SDK arroja AI_LoadAPIKeyError. Eso es la garantía
  // que queremos: "lo único que falta para correr de verdad es la key".
  it('sin ANTHROPIC_API_KEY arroja AI_LoadAPIKeyError (no OpusReviewPromptNotReady)', async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(
        productionOpusCall({
          sonnet_input: {
            grupo_ui_codigo: 'identificacion',
            extracciones_snapshot: [
              {
                caja_codigo: 'id_razon_social',
                valor: 'Demo SA',
                confianza: 0.9,
                evidencia_textual: 'Somos Demo SA',
                status: 'llena',
                version: 1,
              },
            ],
            cajas_no_clausuradas: [],
            hipotesis_sonnet: 'Banco regional medio enfocado en PyME del bajío con CNBV',
            turno_disparador: 1,
          },
          round: 1,
          casos_usados: 0,
        })
      ).rejects.toThrow(/api key/i);
    } finally {
      if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('OpusReviewPromptNotReady sigue siendo el error contractual si el flag se vuelve a flippar a false', () => {
    // No re-test del flujo (eso requeriría mockear el módulo); validamos el
    // shape del error para que el contrato del fail-fast quede documentado.
    const err = new OpusReviewPromptNotReady();
    expect(err.name).toBe('OpusReviewPromptNotReady');
    expect(err.message).toContain('step iv');
  });
});

// =============================================================================
// Inngest dispatch — wiring real verificado contra mocks (commit 9)
// =============================================================================
// Estos tests integran processSolicitarReview con db + inngest mockeados para
// verificar la condición clave: dispatchSesionListaParaSintesis (y por ende
// inngest.send) corre SOLO cuando la transición de status fue exitosa. Si dos
// flujos cierran sesión casi simultáneos, la transición atómica
// `WHERE status='abierta'` deja un solo ganador — el otro recibe RETURNING
// vacío y NO debe duplicar el dispatch.

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  obj.then = (
    onFulfilled?: (v: T) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(value).then(onFulfilled, onRejected);
  return obj;
}

const baseInputCierreSesion: SolicitarReviewSeccionInput = {
  grupo_ui_codigo: 'contacto_y_especificos',
  extracciones_snapshot: [
    {
      caja_codigo: 'co_email_telefono',
      valor: { email: 'demo@demo.mx', telefono: '+525555555555' },
      confianza: 0.95,
      evidencia_textual: 'mi correo es demo@demo.mx, mi celular es 55-5555-5555',
      status: 'llena',
      version: 1,
    },
  ],
  cajas_no_clausuradas: [],
  hipotesis_sonnet:
    'Banco regional de tamaño medio enfocado en PyME del bajío con regulación CNBV',
  turno_disparador: 12,
};

function setupCierreSesionMocks({ transicionExitosa }: { transicionExitosa: boolean }) {
  // db.insert(reviews_seccion).values().returning() → [{ id: 'rid' }]
  mockDb.insert.mockImplementation(() =>
    chainableResolves([{ id: 'review-mock-id' }])
  );
  // db.select() encadenado:
  //   0: determinarRound → []
  //   1: contarCasosUsados → [{ n: 0 }]
  //   2: calcularTotalesSesion #1 → [{ n: 1 }]
  //   3: calcularTotalesSesion #2 → [{ n: 0 }]
  //   4: calcularTotalesSesion #3 → [{ n: 0 }]
  let n = 0;
  mockDb.select.mockImplementation(() => {
    const i = n++;
    if (i === 0) return chainableResolves([]);
    if (i === 1) return chainableResolves([{ n: 0 }]);
    if (i === 2) return chainableResolves([{ n: 1 }]);
    if (i === 3) return chainableResolves([{ n: 0 }]);
    if (i === 4) return chainableResolves([{ n: 0 }]);
    return chainableResolves([]);
  });
  mockDb.update.mockImplementation(() =>
    chainableResolves(transicionExitosa ? [{ id: 'sesion-id' }] : [])
  );
  mockDb.execute.mockImplementation(() => Promise.resolve());
}

describe('Inngest dispatch — sesion/lista_para_sintesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ['mock-event-id'] });
  });

  it('inngest.send llamado con shape correcto cuando transicionExitosa=true', async () => {
    setupCierreSesionMocks({ transicionExitosa: true });

    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: null, // último grupo cerrando
    } satisfies RespuestaOpus);

    await processSolicitarReview(baseInputCierreSesion, {
      sesion_id: 'sesion-cierre-OK',
      opusCall,
    });

    expect(mockInngestSend).toHaveBeenCalledOnce();
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'sesion/lista_para_sintesis',
      data: expect.objectContaining({
        sesion_id: 'sesion-cierre-OK',
        ultimo_review_id: 'review-mock-id',
        total_reviews: expect.any(Number),
        total_profundizaciones: expect.any(Number),
        total_casos: expect.any(Number),
      }),
    });
  });

  it('inngest.send NO llamado cuando transicionExitosa=false (race con otro proceso)', async () => {
    setupCierreSesionMocks({ transicionExitosa: false });

    const opusCall = vi.fn().mockResolvedValue({
      decision: 'avanzar',
      siguiente_grupo_ui: null,
    } satisfies RespuestaOpus);

    await processSolicitarReview(baseInputCierreSesion, {
      sesion_id: 'sesion-cierre-RACE',
      opusCall,
    });

    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});

// =============================================================================
// mergeSeccionCerrada SQL shape (commit 10 — reubicados desde review.e2e.test.ts)
// =============================================================================
// Estos asserts verifican el SHAPE del SQL que emite el helper, no la ejecución
// concurrente. El test concurrente (que ambas calls emitan db.execute sin
// perder ninguna) vive en review.e2e.test.ts. La división responde a
// responsabilidad: aquí se protege el patrón atómico del helper individual;
// allá se protege que múltiples invocaciones simultáneas ambas persisten.

describe('mergeSeccionCerrada SQL shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.execute.mockResolvedValue(undefined);
  });

  it('SQL serializado contiene UPDATE sesiones, ||, COALESCE, \'{}\'::jsonb (intención atómica)', async () => {
    await mergeSeccionCerrada('sesion-y', 'numeros_del_negocio', {
      cerrada_at: new Date().toISOString(),
      review_id: 'r3',
      declino_cajas: [],
    });
    // db.execute recibió un objeto SQL de Drizzle. Su representación
    // serializada (queryChunks + params) debe contener los 4 marcadores del
    // patrón atómico spec v2 §4.5.
    const sqlArg = mockDb.execute.mock.calls[0]?.[0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('UPDATE sesiones');
    expect(serialized).toContain('||');
    expect(serialized).toContain('COALESCE');
    expect(serialized).toContain("'{}'::jsonb");
  });

  it('mergeSeccionCerrada NO llama db.select (ausencia de read-modify-write)', async () => {
    await mergeSeccionCerrada('sesion-x', 'identificacion', {
      cerrada_at: new Date().toISOString(),
      review_id: 'r1',
      declino_cajas: [],
    });
    // Único patrón aceptable: 1 db.execute, 0 db.select. Si alguien
    // refactoriza el helper a "leer estado actual + mergear en JS + escribir",
    // este test rompe.
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// Note: tests adicionales de integración (declinarCaja idempotencia,
// escenarios E2E con opusCall variando, race concurrente sobre
// mergeSeccionCerrada) viven en review.e2e.test.ts. Tests de DB real
// requieren Neon branch dedicada y NO viven en este suite.
// =============================================================================
