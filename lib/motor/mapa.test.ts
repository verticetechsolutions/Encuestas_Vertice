// Vitest suite para computeMapaIncertidumbre. Cubre la incorporación de
// `cajas_declinadas` (Phase 5 step 5 follow-up, deuda §19) además de smoke
// del comportamiento histórico que vivía solo en `scripts/smoke_motor.ts`.

import { describe, it, expect } from 'vitest';
import { computeMapaIncertidumbre, type CajaState } from './mapa';
import type { CajaCanon } from '@/lib/schemas/cajas';
import type { Extraccion } from '@/lib/schemas/extracciones';

const cajaCritica = (codigo: string): CajaCanon => ({
  codigo,
  descripcion: `${codigo} (test)`,
  criticidad: 'critica',
  tipo_dato: 'int',
  grupo_ui: 'numeros_del_negocio',
});

const cajaBlanda = (codigo: string): CajaCanon => ({
  codigo,
  descripcion: `${codigo} (test)`,
  criticidad: 'blanda',
  tipo_dato: 'text',
  grupo_ui: 'operacion',
});

const ext = (
  caja_codigo: string,
  confianza: number,
  overrides: Partial<Extraccion> = {}
): Extraccion => ({
  id: `ext-${caja_codigo}-${confianza}`,
  sesion_id: 'sesion-test',
  turno_id: 'turno-test',
  caja_codigo,
  valor: 42,
  confianza,
  fuente: 'llm',
  evidencia_textual: 'test',
  version: 1,
  superseded_by: null,
  created_at: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
});

describe('computeMapaIncertidumbre — sin declinadas (smoke)', () => {
  it('caja sin extracción → status=vacia', () => {
    const m = computeMapaIncertidumbre([], [cajaCritica('c1')]);
    expect(m.cajas['c1'].status).toBe('vacia');
    expect(m.cajas['c1'].confianza).toBe(0);
  });

  it('caja crítica con confianza 0.85 → llena', () => {
    const m = computeMapaIncertidumbre([ext('c1', 0.85)], [cajaCritica('c1')]);
    expect(m.cajas['c1'].status).toBe('llena');
  });

  it('caja crítica con confianza 0.7 → parcial (debajo de 0.80)', () => {
    const m = computeMapaIncertidumbre([ext('c1', 0.7)], [cajaCritica('c1')]);
    expect(m.cajas['c1'].status).toBe('parcial');
  });

  it('cajas_criticas_pct con todas vacías → 0', () => {
    const m = computeMapaIncertidumbre([], [cajaCritica('c1'), cajaCritica('c2')]);
    expect(m.cajas_criticas_pct).toBe(0);
  });

  it('top_cajas_a_atacar excluye llenas y no_aplica', () => {
    const m = computeMapaIncertidumbre(
      [ext('c1', 0.9), ext('c2', 0.5)],
      [cajaCritica('c1'), cajaCritica('c2')]
    );
    expect(m.top_cajas_a_atacar).toEqual(['c2']);
  });
});

describe('computeMapaIncertidumbre — cajas_declinadas (Phase 5 step 5)', () => {
  it('caja declinada sin extracciones previas → status=declinada, confianza=0', () => {
    const m = computeMapaIncertidumbre([], [cajaCritica('c1')], ['c1']);
    expect(m.cajas['c1'].status).toBe('declinada');
    expect(m.cajas['c1'].confianza).toBe(0);
    expect(m.cajas['c1'].evidencias_count).toBe(0);
    expect(m.cajas['c1'].ultima_extraccion_id).toBeNull();
  });

  it('caja declinada con extracción previa preserva evidencia y confianza', () => {
    const m = computeMapaIncertidumbre(
      [ext('c1', 0.55)],
      [cajaCritica('c1')],
      ['c1']
    );
    expect(m.cajas['c1'].status).toBe('declinada');
    expect(m.cajas['c1'].confianza).toBe(0.55);
    expect(m.cajas['c1'].evidencias_count).toBe(1);
    expect(m.cajas['c1'].ultima_extraccion_id).toBe('ext-c1-0.55');
  });

  it('declinada gana sobre contradictoria (motor decision overrides surface bug)', () => {
    const e1 = ext('c1', 0.85, { id: 'a', valor: 100 });
    const e2 = ext('c1', 0.85, { id: 'b', valor: 200 });
    const sinDecline = computeMapaIncertidumbre([e1, e2], [cajaCritica('c1')]);
    expect(sinDecline.cajas['c1'].status).toBe('contradictoria');

    const conDecline = computeMapaIncertidumbre([e1, e2], [cajaCritica('c1')], ['c1']);
    expect(conDecline.cajas['c1'].status).toBe('declinada');
  });

  it('declinada cuenta en cajas_criticas_pct (terminal)', () => {
    // 2 críticas: 1 llena, 1 declinada → 100%.
    const m = computeMapaIncertidumbre(
      [ext('c1', 0.9)],
      [cajaCritica('c1'), cajaCritica('c2')],
      ['c2']
    );
    expect(m.cajas_criticas_pct).toBe(1);
  });

  it('declinada cuenta en cajas_blandas_pct (terminal)', () => {
    const m = computeMapaIncertidumbre(
      [],
      [cajaBlanda('b1'), cajaBlanda('b2')],
      ['b1']
    );
    expect(m.cajas_blandas_pct).toBe(0.5);
  });

  it('declinada excluida de top_cajas_a_atacar (no se repregunta)', () => {
    const m = computeMapaIncertidumbre(
      [],
      [cajaCritica('c1'), cajaCritica('c2'), cajaCritica('c3')],
      ['c2']
    );
    expect(m.top_cajas_a_atacar).not.toContain('c2');
    expect(m.top_cajas_a_atacar).toEqual(['c1', 'c3']);
  });

  it('confianza_global preserva confianza real de declinadas (sin extracción → 0)', () => {
    // 1 crítica llena (0.9), 1 crítica declinada sin extracción (0).
    // peso 2 cada una → (0.9*2 + 0*2) / 4 = 0.45.
    const m = computeMapaIncertidumbre(
      [ext('c1', 0.9)],
      [cajaCritica('c1'), cajaCritica('c2')],
      ['c2']
    );
    expect(m.confianza_global).toBeCloseTo(0.45, 5);
  });

  it('múltiples declinadas en sets distintos (críticas + blandas) computan correcto', () => {
    const m = computeMapaIncertidumbre(
      [ext('c1', 0.9), ext('b1', 0.7)],
      [
        cajaCritica('c1'),
        cajaCritica('c2'), // declinada sin extracción
        cajaBlanda('b1'),
        cajaBlanda('b2'), // declinada sin extracción
      ],
      ['c2', 'b2']
    );
    // críticas: c1 llena + c2 declinada = 2/2 = 100%
    expect(m.cajas_criticas_pct).toBe(1);
    // blandas: b1 llena (0.7≥0.65) + b2 declinada = 2/2 = 100%
    expect(m.cajas_blandas_pct).toBe(1);
    // top_a_atacar: ninguna pendiente
    expect(m.top_cajas_a_atacar).toEqual([]);
  });

  it('default cajasDeclinadas=[] preserva back-compat con callers de 2 args', () => {
    // Smoke: el route handler pasa solo (extracciones, cajasAplicables) en
    // tests previos al wiring de listarCajasDeclinadas.
    const m = computeMapaIncertidumbre([ext('c1', 0.9)], [cajaCritica('c1')]);
    expect(m.cajas['c1'].status).toBe('llena');
    expect(m.cajas_criticas_pct).toBe(1);
  });
});

describe('CajaState shape (regression guard)', () => {
  it('todos los CajaStatus reconocidos en runtime', () => {
    const statuses: CajaState['status'][] = [
      'llena',
      'parcial',
      'vacia',
      'no_aplica',
      'declinada',
      'contradictoria',
    ];
    // Smoke estructural — si alguien borra un valor del union, este array deja
    // de typecheck-ear y este test rompe en compile, no en runtime.
    expect(statuses.length).toBe(6);
  });
});
