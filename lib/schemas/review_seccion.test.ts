import { describe, it, expect } from 'vitest';
import {
  SolicitarReviewSeccionInputSchema,
  ExtraccionSnapshotItemSchema,
  CajaNoClausuradaSchema,
  RespuestaOpusSchema,
  RespuestaOpusAvanzarSchema,
  RespuestaOpusProfundizarSchema,
  RespuestaOpusCasoSinteticoSchema,
  CajaStatusSchema,
  RazonNoClausuraSchema,
  RazonEscalacionCasoSchema,
  RazonDeclineSchema,
  type RespuestaOpus,
} from './review_seccion';

// =============================================================================
// CajaStatus + razones canónicas
// =============================================================================

describe('CajaStatusSchema', () => {
  it('accepts the 5 spec-defined statuses', () => {
    for (const s of ['llena', 'parcial', 'vacia', 'no_aplica', 'contradictoria']) {
      expect(CajaStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects unknown status values', () => {
    expect(CajaStatusSchema.safeParse('nueva').success).toBe(false);
    expect(CajaStatusSchema.safeParse('declined').success).toBe(false);
  });
});

describe('RazonNoClausuraSchema', () => {
  it('accepts the 4 spec-defined razones', () => {
    for (const r of ['estancada', 'contradictoria', 'evidencia_debil', 'usuario_evade']) {
      expect(RazonNoClausuraSchema.safeParse(r).success).toBe(true);
    }
  });

  it('rejects mismatch between RazonNoClausura (Sonnet→motor) and RazonDecline (motor→DB)', () => {
    // Verifica que las razones canónicas no se mezclen accidentalmente.
    expect(RazonNoClausuraSchema.safeParse('aceptada_round_1').success).toBe(false);
    expect(RazonDeclineSchema.safeParse('estancada').success).toBe(false);
  });
});

describe('RazonEscalacionCasoSchema', () => {
  it('accepts the 3 spec-defined razones de escalación', () => {
    for (const r of [
      'profundizacion_agotada',
      'caja_resistente',
      'evidencia_imposible_via_pregunta',
    ]) {
      expect(RazonEscalacionCasoSchema.safeParse(r).success).toBe(true);
    }
  });
});

// =============================================================================
// Tool input — SolicitarReviewSeccionInputSchema (spec §2)
// =============================================================================

const validSnapshot = {
  caja_codigo: 'id_razon_social',
  valor: 'Banco Demo SA',
  confianza: 0.92,
  evidencia_textual: 'Somos Banco Demo SA, fundado en 2010',
  status: 'llena' as const,
  version: 1,
};

const validInput = {
  grupo_ui_codigo: 'identificacion' as const,
  extracciones_snapshot: [validSnapshot],
  cajas_no_clausuradas: [],
  hipotesis_sonnet:
    'Banco regional de tamaño medio enfocado en PyME del bajío con regulación CNBV',
  turno_disparador: 7,
};

describe('SolicitarReviewSeccionInputSchema — happy path', () => {
  it('accepts a fully-populated snapshot with no cajas declinadas', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse(validInput);
    expect(r.success).toBe(true);
  });

  it('accepts cajas_no_clausuradas con items', () => {
    const input = {
      ...validInput,
      cajas_no_clausuradas: [
        {
          caja_codigo: 'gr_dscr_min',
          razon: 'estancada' as const,
          detalle: 'Confianza estancada en 0.70 después de 4 turnos',
          turnos_intentados: 4,
        },
      ],
    };
    const r = SolicitarReviewSeccionInputSchema.safeParse(input);
    expect(r.success).toBe(true);
  });

  it('valor:unknown acepta cualquier shape (string, number, object, null)', () => {
    for (const v of ['x', 42, { a: 1 }, null, true, []]) {
      const r = ExtraccionSnapshotItemSchema.safeParse({ ...validSnapshot, valor: v });
      expect(r.success).toBe(true);
    }
  });
});

describe('SolicitarReviewSeccionInputSchema — refines & rejects', () => {
  it('rechaza grupo_ui_codigo no canónico', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse({
      ...validInput,
      grupo_ui_codigo: 'fantasia',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza hipotesis_sonnet menor a 20 chars (trivial)', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse({
      ...validInput,
      hipotesis_sonnet: 'corta',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza hipotesis_sonnet mayor a 400 chars', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse({
      ...validInput,
      hipotesis_sonnet: 'x'.repeat(401),
    });
    expect(r.success).toBe(false);
  });

  it('rechaza extracciones_snapshot vacío', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse({
      ...validInput,
      extracciones_snapshot: [],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza confianza fuera de [0,1]', () => {
    expect(
      ExtraccionSnapshotItemSchema.safeParse({ ...validSnapshot, confianza: -0.1 }).success
    ).toBe(false);
    expect(
      ExtraccionSnapshotItemSchema.safeParse({ ...validSnapshot, confianza: 1.5 }).success
    ).toBe(false);
  });

  it('rechaza version no positiva', () => {
    expect(
      ExtraccionSnapshotItemSchema.safeParse({ ...validSnapshot, version: 0 }).success
    ).toBe(false);
    expect(
      ExtraccionSnapshotItemSchema.safeParse({ ...validSnapshot, version: -1 }).success
    ).toBe(false);
  });

  it('rechaza evidencia_textual vacía', () => {
    const r = ExtraccionSnapshotItemSchema.safeParse({
      ...validSnapshot,
      evidencia_textual: '',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza turno_disparador no positivo', () => {
    const r = SolicitarReviewSeccionInputSchema.safeParse({
      ...validInput,
      turno_disparador: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza CajaNoClausurada con detalle vacío', () => {
    const r = CajaNoClausuradaSchema.safeParse({
      caja_codigo: 'x',
      razon: 'estancada',
      detalle: '',
      turnos_intentados: 3,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza CajaNoClausurada con detalle > 200 chars', () => {
    const r = CajaNoClausuradaSchema.safeParse({
      caja_codigo: 'x',
      razon: 'estancada',
      detalle: 'x'.repeat(201),
      turnos_intentados: 3,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza turnos_intentados negativos', () => {
    const r = CajaNoClausuradaSchema.safeParse({
      caja_codigo: 'x',
      razon: 'estancada',
      detalle: 'algo',
      turnos_intentados: -1,
    });
    expect(r.success).toBe(false);
  });
});

// =============================================================================
// Opus response — discriminated union round-trip (spec §3)
// =============================================================================

describe('RespuestaOpusSchema — discriminated union por `decision`', () => {
  it('parsea avanzar con siguiente_grupo_ui', () => {
    const r = RespuestaOpusSchema.parse({
      decision: 'avanzar',
      siguiente_grupo_ui: 'productos_y_mercado',
    });
    // Type narrowing: tras parse, TypeScript debe saber que es la rama avanzar.
    if (r.decision === 'avanzar') {
      expect(r.siguiente_grupo_ui).toBe('productos_y_mercado');
    } else {
      throw new Error('discriminated union no narrowed correctly');
    }
  });

  it('parsea avanzar con siguiente_grupo_ui null (cierre de sesión)', () => {
    const r = RespuestaOpusSchema.parse({
      decision: 'avanzar',
      siguiente_grupo_ui: null,
    });
    expect(r.decision).toBe('avanzar');
    if (r.decision === 'avanzar') {
      expect(r.siguiente_grupo_ui).toBeNull();
    }
  });

  it('parsea avanzar con anotacion_audit opcional', () => {
    const r = RespuestaOpusSchema.parse({
      decision: 'avanzar',
      siguiente_grupo_ui: 'operacion',
      anotacion_audit: 'Boundary aceptado: gr_dscr_min estancada en 0.70 acceptable v1',
    });
    if (r.decision === 'avanzar') {
      expect(r.anotacion_audit).toContain('Boundary');
    }
  });

  it('parsea profundizar con guidance + cajas_a_reabordar', () => {
    const r = RespuestaOpusSchema.parse({
      decision: 'profundizar',
      guidance:
        'Reformula gr_dscr_min preguntando con un caso concreto en vez de pedir el número directo',
      cajas_a_reabordar: ['gr_dscr_min', 'gr_deuda_ebitda_max'],
    });
    if (r.decision === 'profundizar') {
      expect(r.cajas_a_reabordar).toHaveLength(2);
    } else {
      throw new Error('expected profundizar branch');
    }
  });

  it('parsea caso_sintetico con razon_escalacion', () => {
    const r = RespuestaOpusSchema.parse({
      decision: 'caso_sintetico',
      cajas_objetivo: ['to_historial_credito'],
      hipotesis_a_clausurar: 'Entender si aceptan restructuras concluidas hace <6 meses',
      urgencia: 'alta',
      razon_escalacion: 'profundizacion_agotada',
    });
    if (r.decision === 'caso_sintetico') {
      expect(r.urgencia).toBe('alta');
      expect(r.razon_escalacion).toBe('profundizacion_agotada');
    }
  });

  it('rechaza decision desconocida', () => {
    const r = RespuestaOpusSchema.safeParse({ decision: 'rechazar' });
    expect(r.success).toBe(false);
  });

  it('rechaza profundizar con guidance < 40 chars', () => {
    const r = RespuestaOpusSchema.safeParse({
      decision: 'profundizar',
      guidance: 'Reformula',
      cajas_a_reabordar: ['x'],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza profundizar con guidance > 1200 chars', () => {
    const r = RespuestaOpusSchema.safeParse({
      decision: 'profundizar',
      guidance: 'x'.repeat(1201),
      cajas_a_reabordar: ['x'],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza profundizar con cajas_a_reabordar vacío', () => {
    const r = RespuestaOpusSchema.safeParse({
      decision: 'profundizar',
      guidance: 'Reformula gr_dscr_min usando un caso concreto en vez de número directo',
      cajas_a_reabordar: [],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza caso_sintetico con cajas_objetivo vacío', () => {
    const r = RespuestaOpusSchema.safeParse({
      decision: 'caso_sintetico',
      cajas_objetivo: [],
      hipotesis_a_clausurar: 'Entender si aceptan restructuras concluidas hace <6 meses',
      urgencia: 'alta',
      razon_escalacion: 'profundizacion_agotada',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza caso_sintetico con urgencia fuera de enum', () => {
    const r = RespuestaOpusSchema.safeParse({
      decision: 'caso_sintetico',
      cajas_objetivo: ['x'],
      hipotesis_a_clausurar: 'Entender si aceptan restructuras concluidas hace <6 meses',
      urgencia: 'baja', // no está en el enum
      razon_escalacion: 'profundizacion_agotada',
    });
    expect(r.success).toBe(false);
  });

  it('discriminated union: campos de una rama no se permiten en otra', () => {
    // profundizar no debe aceptar siguiente_grupo_ui (campo de avanzar).
    // Zod por default es lenient con campos extra, pero discriminatedUnion
    // valida estrictamente la rama detectada.
    const r = RespuestaOpusSchema.safeParse({
      decision: 'profundizar',
      siguiente_grupo_ui: 'productos_y_mercado', // campo de avanzar
      // falta guidance + cajas_a_reabordar requeridos por profundizar
    });
    expect(r.success).toBe(false);
  });
});

// =============================================================================
// Sub-schema parsing isolated (sanity check on each branch)
// =============================================================================

describe('Branch schemas individualmente', () => {
  it('RespuestaOpusAvanzarSchema valida rama avanzar', () => {
    const r = RespuestaOpusAvanzarSchema.safeParse({
      decision: 'avanzar',
      siguiente_grupo_ui: 'numeros_del_negocio',
    });
    expect(r.success).toBe(true);
  });

  it('RespuestaOpusProfundizarSchema valida rama profundizar', () => {
    const r = RespuestaOpusProfundizarSchema.safeParse({
      decision: 'profundizar',
      guidance: 'guía suficientemente larga para pasar el min de 40 chars',
      cajas_a_reabordar: ['x'],
    });
    expect(r.success).toBe(true);
  });

  it('RespuestaOpusCasoSinteticoSchema valida rama caso_sintetico', () => {
    const r = RespuestaOpusCasoSinteticoSchema.safeParse({
      decision: 'caso_sintetico',
      cajas_objetivo: ['x'],
      hipotesis_a_clausurar: 'Hipótesis suficientemente descriptiva para pasar el min',
      urgencia: 'media',
      razon_escalacion: 'caja_resistente',
    });
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// Type-level sanity (compile-time, vitest only confirms it runs)
// =============================================================================

describe('Type narrowing in discriminated union', () => {
  it('TS narrows correctly at each branch', () => {
    const sample: RespuestaOpus = {
      decision: 'avanzar',
      siguiente_grupo_ui: 'pricing_y_criterio',
    };
    // Si esto compila, las types están bien derivadas.
    if (sample.decision === 'avanzar') {
      const _grupo: string | null = sample.siguiente_grupo_ui;
      expect(_grupo).toBe('pricing_y_criterio');
    }
  });
});
