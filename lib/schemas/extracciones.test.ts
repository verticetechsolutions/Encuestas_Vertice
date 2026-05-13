// Tests del mapping type ValorPorCaja + helper parseValorPorCaja + parseExtraccion
// con hint generic (deuda #6 Plan B, 2026-05-13).
//
// Cubre:
//   1. parseValorPorCaja con cada una de las 14 cajas especiales (runtime válido).
//   2. parseValorPorCaja con valor inválido → ZodError.
//   3. parseValorPorCaja con caja desconocida → unknown fallback (no throw).
//   4. parseExtraccion sin hint → comportamiento backward-compatible.
//   5. parseExtraccion con hint correcto → narrow runtime equivalent.
//   6. parseExtraccion con hint mismatch → ExtraccionHintMismatchError.
//   7. Type-level: ValorPorCaja<'to_historial_credito'> debe ser Tolerancia (no unknown).
//      Validado en tiempo de compilación via assignments — si TS rompe, falla el build.

import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  parseValorPorCaja,
  parseExtraccion,
  ExtraccionHintMismatchError,
  type ValorPorCaja,
  type Tolerancia,
  type SituacionEspecial,
  type EmailTelefono,
  type EeffAuditados,
  type TasasPorProducto,
  type PlazosPorProducto,
} from './extracciones';

const sesion_id = crypto.randomUUID();
const turno_id = crypto.randomUUID();

function envelope(caja_codigo: string, valor: unknown) {
  return {
    sesion_id,
    turno_id,
    caja_codigo,
    valor,
    confianza: 0.9,
    fuente: 'llm' as const,
    evidencia_textual: null,
    version: 1,
    superseded_by: null,
  };
}

describe('parseValorPorCaja — runtime narrowing por caja especial', () => {
  it('to_historial_credito devuelve Tolerancia (string)', () => {
    const out = parseValorPorCaja(
      'to_historial_credito',
      'Acepta retraso de 30 días, no reincidente, regularizado.'
    );
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('to_situacion_fiscal, to_ratios_financieros, to_colateral, to_gobierno_documentacion son Tolerancia', () => {
    expect(parseValorPorCaja('to_situacion_fiscal', 'opinión 32-D positiva mínimo')).toBeTypeOf('string');
    expect(parseValorPorCaja('to_ratios_financieros', 'DSCR ≥ 1.2 con cobertura ≥ 1.5x')).toBeTypeOf('string');
    expect(parseValorPorCaja('to_colateral', 'hipoteca priority 1, prendaria con valuación vigente')).toBeTypeOf('string');
    expect(parseValorPorCaja('to_gobierno_documentacion', 'acta constitutiva + poderes notariados vigentes')).toBeTypeOf('string');
  });

  it('se_* devuelven SituacionEspecial con respuesta enum', () => {
    const out = parseValorPorCaja('se_sin_historial', {
      respuesta: 'condicional',
      condiciones: 'Acepta sin historial empresarial si PF supera 700 + aval con patrimonio',
    });
    expect(out.respuesta).toBe('condicional');
    expect(out.condiciones).toMatch(/aval/);

    const out2 = parseValorPorCaja('se_sat_32d_negativa', { respuesta: 'no' });
    expect(out2.respuesta).toBe('no');
    expect(out2.condiciones).toBeUndefined();
  });

  it('co_email_telefono valida email + tel MX', () => {
    const out = parseValorPorCaja('co_email_telefono', {
      email: 'contacto@vertice.test',
      telefono: '+525555551234',
    });
    expect(out.email).toBe('contacto@vertice.test');
    expect(out.telefono).toMatch(/5555551234/);
  });

  it('op_eeff_auditados con politica "desde_monto" requiere monto_min_mxn', () => {
    const out = parseValorPorCaja('op_eeff_auditados', {
      politica: 'desde_monto',
      monto_min_mxn: 25_000_000,
    });
    expect(out.politica).toBe('desde_monto');
    expect(out.monto_min_mxn).toBe(25_000_000);
  });

  it('pc_tasas_por_producto devuelve record producto → {min_pct, max_pct, cat_pct?}', () => {
    const out = parseValorPorCaja('pc_tasas_por_producto', {
      credito_simple: { min_pct: 14, max_pct: 22, cat_pct: 26 },
      capital_trabajo: { min_pct: 18, max_pct: 28 },
    });
    expect(out['credito_simple'].min_pct).toBe(14);
    expect(out['capital_trabajo'].max_pct).toBe(28);
  });

  it('pc_plazos_por_producto devuelve record producto → {min_meses, max_meses}', () => {
    const out = parseValorPorCaja('pc_plazos_por_producto', {
      arrendamiento_financiero: { min_meses: 12, max_meses: 60 },
    });
    expect(out['arrendamiento_financiero'].max_meses).toBe(60);
  });
});

describe('parseValorPorCaja — validación runtime', () => {
  it('Tolerancia vacía lanza ZodError', () => {
    expect(() => parseValorPorCaja('to_historial_credito', '')).toThrow();
  });

  it('SituacionEspecial con respuesta=condicional sin condiciones lanza', () => {
    expect(() =>
      parseValorPorCaja('se_concurso_mercantil', { respuesta: 'condicional' })
    ).toThrow(/condiciones es requerido/);
  });

  it('EmailTelefono con email inválido lanza', () => {
    expect(() =>
      parseValorPorCaja('co_email_telefono', {
        email: 'no-es-email',
        telefono: '+525555551234',
      })
    ).toThrow(/email inválido/);
  });

  it('EeffAuditados con desde_monto sin monto_min_mxn lanza', () => {
    expect(() =>
      parseValorPorCaja('op_eeff_auditados', { politica: 'desde_monto' })
    ).toThrow(/monto_min_mxn es requerido/);
  });

  it('TasasPorProducto con max_pct < min_pct lanza', () => {
    expect(() =>
      parseValorPorCaja('pc_tasas_por_producto', {
        credito_simple: { min_pct: 20, max_pct: 10 },
      })
    ).toThrow(/max_pct debe ser/);
  });
});

describe('parseValorPorCaja — caja generic / desconocida (fallback)', () => {
  it('ru_monto_min (caja generic int) valida y devuelve number | null', () => {
    expect(parseValorPorCaja('ru_monto_min', 5_000_000)).toBe(5_000_000);
    expect(parseValorPorCaja('ru_monto_min', null)).toBeNull();
  });

  it('caja_codigo desconocida cae a z.unknown() — acepta cualquier valor sin throw', () => {
    const out = parseValorPorCaja('codigo_inventado_v999', {
      cualquier_cosa: [1, 'two', { tres: true }],
    });
    expect(out).toEqual({ cualquier_cosa: [1, 'two', { tres: true }] });
  });
});

describe('parseExtraccion — backward compatible sin hint', () => {
  it('sin hint devuelve Extraccion con valor: unknown', () => {
    const out = parseExtraccion(
      envelope('to_historial_credito', 'Tolera retraso de 30 días con garantía')
    );
    expect(out.caja_codigo).toBe('to_historial_credito');
    expect(out.valor).toBeTypeOf('string');
  });

  it('sin hint funciona para caja generic con valor null sentinel', () => {
    const out = parseExtraccion(envelope('ru_score_pm_min', null));
    expect(out.valor).toBeNull();
  });
});

describe('parseExtraccion — con hint generic', () => {
  it('hint correcto valida runtime + narrow type', () => {
    const out = parseExtraccion(
      envelope('co_email_telefono', { email: 'a@b.com', telefono: '+525555551234' }),
      'co_email_telefono' as const
    );
    expect(out.caja_codigo).toBe('co_email_telefono');
    // Sin cast: out.valor.email accesible porque ValorPorCaja<'co_email_telefono'> = EmailTelefono
    expect(out.valor.email).toBe('a@b.com');
  });

  it('hint mismatch lanza ExtraccionHintMismatchError', () => {
    expect(() =>
      parseExtraccion(
        envelope('to_historial_credito', 'algo'),
        'op_eeff_auditados' as const
      )
    ).toThrow(ExtraccionHintMismatchError);
  });

  it('ExtraccionHintMismatchError expone expected y actual', () => {
    try {
      parseExtraccion(
        envelope('to_situacion_fiscal', 'x'),
        'pc_tasas_por_producto' as const
      );
    } catch (err) {
      expect(err).toBeInstanceOf(ExtraccionHintMismatchError);
      const e = err as ExtraccionHintMismatchError;
      expect(e.expected).toBe('pc_tasas_por_producto');
      expect(e.actual).toBe('to_situacion_fiscal');
    }
  });
});

describe('ValorPorCaja — type-level narrowing (compile-time)', () => {
  it('mapea cada caja especial a su shape concreto', () => {
    expectTypeOf<ValorPorCaja<'to_historial_credito'>>().toEqualTypeOf<Tolerancia>();
    expectTypeOf<ValorPorCaja<'to_situacion_fiscal'>>().toEqualTypeOf<Tolerancia>();
    expectTypeOf<ValorPorCaja<'se_sin_historial'>>().toEqualTypeOf<SituacionEspecial>();
    expectTypeOf<ValorPorCaja<'se_sat_32d_negativa'>>().toEqualTypeOf<SituacionEspecial>();
    expectTypeOf<ValorPorCaja<'co_email_telefono'>>().toEqualTypeOf<EmailTelefono>();
    expectTypeOf<ValorPorCaja<'op_eeff_auditados'>>().toEqualTypeOf<EeffAuditados>();
    expectTypeOf<ValorPorCaja<'pc_tasas_por_producto'>>().toEqualTypeOf<TasasPorProducto>();
    expectTypeOf<ValorPorCaja<'pc_plazos_por_producto'>>().toEqualTypeOf<PlazosPorProducto>();
  });

  it('cajas no especiales caen a unknown', () => {
    expectTypeOf<ValorPorCaja<'ru_monto_min'>>().toEqualTypeOf<unknown>();
    expectTypeOf<ValorPorCaja<'nm_sectores_aceptados'>>().toEqualTypeOf<unknown>();
    expectTypeOf<ValorPorCaja<'codigo_inventado_xyz'>>().toEqualTypeOf<unknown>();
  });

  it('cuando C es wide string (no literal), devuelve unknown', () => {
    expectTypeOf<ValorPorCaja<string>>().toEqualTypeOf<unknown>();
  });
});
