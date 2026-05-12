// Tests del server-side gate canCloseSeccion (lib/motor/review-gate.ts).
//
// Estrategia:
//   - `evaluateCriticasAccionables` es PURA — tests directos sin mocks.
//   - `canCloseSeccion` orquesta DB + mapa + reglas; mockeamos @/lib/db con
//     thenable chainable + mockeamos persistence/listarExtraccionesActivas y
//     listarCajasDeclinadas para inyectar estado controlado.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockReviewsRows, mockExtracciones, mockDeclinadas } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
    },
    mockReviewsRows: { value: [] as Array<{ decision: string }> },
    mockExtracciones: { value: [] as unknown[] },
    mockDeclinadas: { value: [] as string[] },
  };
});

vi.mock('@/lib/db', () => {
  // Chainable thenable: select(...).from(...).where(...).limit(N) → reviewsRows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  const methods = ['select', 'from', 'where', 'limit', 'innerJoin', 'orderBy'];
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  obj.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(mockReviewsRows.value).then(onFulfilled, onRejected);
  // Reflect on top-level select so spy on db.select works.
  mockDb.select = obj.select;
  return { db: obj };
});

vi.mock('@/lib/motor/persistence', () => ({
  listarExtraccionesActivas: vi.fn(async () => mockExtracciones.value),
  listarCajasDeclinadas: vi.fn(async () => mockDeclinadas.value),
}));

import {
  canCloseSeccion,
  evaluateCriticasAccionables,
  MIN_TURNS_PARA_DECLINAR,
} from './review-gate';
import { CAJAS_CANON, getCajasAplicables } from '@/lib/schemas/cajas';
import type { CajaState } from '@/lib/motor/mapa';
import type { SolicitarReviewSeccionInput } from '@/lib/schemas/review_seccion';

const SESION_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  mockReviewsRows.value = [];
  mockExtracciones.value = [];
  mockDeclinadas.value = [];
  vi.clearAllMocks();
});

// =============================================================================
// MIN_TURNS_PARA_DECLINAR — constante cementada
// =============================================================================

describe('MIN_TURNS_PARA_DECLINAR', () => {
  it('está cementado en 2 (alineado con regla 6 del prompt Sonnet)', () => {
    expect(MIN_TURNS_PARA_DECLINAR).toBe(2);
  });
});

// =============================================================================
// evaluateCriticasAccionables — pura, sin DB
// =============================================================================

describe('evaluateCriticasAccionables (pura)', () => {
  const cajasIdent = CAJAS_CANON.filter((c) => c.grupo_ui === 'identificacion');
  const criticasIdent = cajasIdent.filter((c) => c.criticidad === 'critica');

  function stateTerminal(codigo: string): CajaState {
    return {
      codigo,
      criticidad: 'critica',
      status: 'llena',
      confianza: 0.9,
      evidencias_count: 1,
      ultima_extraccion_id: 'ext-' + codigo,
    };
  }
  function stateVacia(codigo: string): CajaState {
    return {
      codigo,
      criticidad: 'critica',
      status: 'vacia',
      confianza: 0,
      evidencias_count: 0,
      ultima_extraccion_id: null,
    };
  }
  function stateParcial(codigo: string, confianza = 0.5): CajaState {
    return {
      codigo,
      criticidad: 'critica',
      status: 'parcial',
      confianza,
      evidencias_count: 1,
      ultima_extraccion_id: 'ext-' + codigo,
    };
  }

  it('todas críticas terminales → pendientes vacío', () => {
    const states: Record<string, CajaState> = {};
    for (const c of criticasIdent) states[c.codigo] = stateTerminal(c.codigo);
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [],
    });
    expect(out).toEqual([]);
  });

  it('una crítica vacía sin declarar → aparece pendiente', () => {
    const states: Record<string, CajaState> = {};
    for (const c of criticasIdent) states[c.codigo] = stateTerminal(c.codigo);
    // Forzamos la primera crítica a vacía.
    const objetivo = criticasIdent[0].codigo;
    states[objetivo] = stateVacia(objetivo);
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].caja_codigo).toBe(objetivo);
    expect(out[0].status).toBe('vacia');
    expect(out[0].sugerencia).toMatch(/Pregunta directa/i);
  });

  it('crítica parcial declarada con turnos_intentados < MIN → pendiente con sugerencia', () => {
    const states: Record<string, CajaState> = {};
    for (const c of criticasIdent) states[c.codigo] = stateTerminal(c.codigo);
    const objetivo = criticasIdent[0].codigo;
    states[objetivo] = stateParcial(objetivo, 0.7);
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [
        {
          caja_codigo: objetivo,
          razon: 'estancada',
          detalle: 'usuario evade',
          turnos_intentados: 1,
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].sugerencia).toMatch(/1 turno\(s\)/);
    expect(out[0].sugerencia).toMatch(/2/);
  });

  it('crítica parcial declarada con turnos_intentados >= MIN → exhausta, no pendiente', () => {
    const states: Record<string, CajaState> = {};
    for (const c of criticasIdent) states[c.codigo] = stateTerminal(c.codigo);
    const objetivo = criticasIdent[0].codigo;
    states[objetivo] = stateParcial(objetivo, 0.7);
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [
        {
          caja_codigo: objetivo,
          razon: 'estancada',
          detalle: 'usuario evade después de 2 reformulaciones',
          turnos_intentados: 2,
        },
      ],
    });
    expect(out).toEqual([]);
  });

  it('crítica contradictoria sin declarar → pendiente (requiere resolución)', () => {
    const states: Record<string, CajaState> = {};
    for (const c of criticasIdent) states[c.codigo] = stateTerminal(c.codigo);
    const objetivo = criticasIdent[0].codigo;
    states[objetivo] = {
      codigo: objetivo,
      criticidad: 'critica',
      status: 'contradictoria',
      confianza: 0.6,
      evidencias_count: 2,
      ultima_extraccion_id: 'ext-' + objetivo,
    };
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('contradictoria');
    expect(out[0].sugerencia).toMatch(/conflicto|contradice/i);
  });

  it('crítica sin state en el mapa → tratada como vacía accionable (defensa)', () => {
    // Mapa stale: el caller no computó algun crítica. Gate debería marcar
    // pendiente en vez de crashear.
    const states: Record<string, CajaState> = {};
    // Solo poblamos algunas, no todas.
    states[criticasIdent[0].codigo] = stateTerminal(criticasIdent[0].codigo);
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: states,
      cajas_no_clausuradas: [],
    });
    // criticasIdent.length - 1 cajas sin state → todas pendientes.
    expect(out.length).toBe(criticasIdent.length - 1);
    expect(out[0].sugerencia).toMatch(/No hay extracción/i);
  });

  it('blandas NUNCA cuentan como pendientes — solo críticas son obligatorias', () => {
    const cajasIdentVacias: Record<string, CajaState> = {};
    for (const c of cajasIdent) {
      cajasIdentVacias[c.codigo] = stateVacia(c.codigo);
    }
    // Forzar críticas a terminal, blandas a vacías.
    for (const c of cajasIdent.filter((c) => c.criticidad === 'critica')) {
      cajasIdentVacias[c.codigo] = stateTerminal(c.codigo);
    }
    const out = evaluateCriticasAccionables({
      grupo_ui: 'identificacion',
      cajasAplicables: cajasIdent,
      cajaStates: cajasIdentVacias,
      cajas_no_clausuradas: [],
    });
    expect(out).toEqual([]);
  });

  it('cajas de OTRO grupo no se consideran (filtro por grupo_ui)', () => {
    // Mapa con todas críticas de identificacion en vacía, pero pedimos review
    // de productos_y_mercado.
    const todas = getCajasAplicables('banco');
    const states: Record<string, CajaState> = {};
    for (const c of todas.filter((c) => c.grupo_ui === 'identificacion')) {
      states[c.codigo] = stateVacia(c.codigo);
    }
    for (const c of todas.filter((c) => c.grupo_ui === 'productos_y_mercado')) {
      states[c.codigo] = stateTerminal(c.codigo);
    }
    const out = evaluateCriticasAccionables({
      grupo_ui: 'productos_y_mercado',
      cajasAplicables: todas,
      cajaStates: states,
      cajas_no_clausuradas: [],
    });
    expect(out).toEqual([]);
  });
});

// =============================================================================
// canCloseSeccion — orchestración con DB mockeada
// =============================================================================

describe('canCloseSeccion (orquestación)', () => {
  const cajasBanco = getCajasAplicables('banco');
  const criticasIdent = cajasBanco.filter(
    (c) => c.grupo_ui === 'identificacion' && c.criticidad === 'critica'
  );

  function buildInputBase(): SolicitarReviewSeccionInput {
    // Snapshot con todas las críticas en estado terminal vía LLM (confianza
    // alta), evidencia textual no vacía. Sin cajas_no_clausuradas.
    return {
      grupo_ui_codigo: 'identificacion',
      extracciones_snapshot: criticasIdent.map((c) => ({
        caja_codigo: c.codigo,
        valor: c.tipo_dato === 'int' ? 10 : 'mock',
        confianza: 0.9,
        evidencia_textual: 'el usuario dijo X literalmente',
        status: 'llena' as const,
        version: 1,
      })),
      cajas_no_clausuradas: [],
      hipotesis_sonnet:
        'Institución es banco múltiple regulado por CNBV con más de 10 años en mercado',
      turno_disparador: 3,
    };
  }

  // Helper para inyectar extracciones reales como si vinieran de DB.
  function injectExtraccionesSnapshot(input: SolicitarReviewSeccionInput) {
    mockExtracciones.value = input.extracciones_snapshot.map((s, i) => ({
      id: `ext-${i}`,
      sesion_id: SESION_ID,
      turno_id: 'tur-' + i,
      caja_codigo: s.caja_codigo,
      valor: s.valor,
      confianza: s.confianza,
      fuente: 'llm',
      evidencia_textual: s.evidencia_textual,
      version: s.version,
      superseded_by: null,
      created_at: new Date(),
    }));
  }

  it('G1 — review previa terminal (avanzar) → already_closed', async () => {
    const input = buildInputBase();
    injectExtraccionesSnapshot(input);
    mockReviewsRows.value = [{ decision: 'avanzar' }];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return; // narrow
    expect(out.razon).toBe('already_closed');
    expect(out.message).toMatch(/ya fue cerrado/i);
  });

  it('G1 — review previa caso_sintetico → already_closed', async () => {
    const input = buildInputBase();
    injectExtraccionesSnapshot(input);
    mockReviewsRows.value = [{ decision: 'caso_sintetico' }];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.razon).toBe('already_closed');
  });

  it('G1 — review previa "profundizar" NO bloquea (round 2 legítimo)', async () => {
    const input = buildInputBase();
    injectExtraccionesSnapshot(input);
    // El query usa inArray sobre ['avanzar','caso_sintetico'] — profundizar
    // NO matchea, así que mockReviewsRows queda vacío y el gate avanza a G2/G3.
    mockReviewsRows.value = [];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(true);
  });

  it('G2 — snapshot sin cajas del grupo → snapshot_not_in_grupo', async () => {
    const input = buildInputBase();
    // Re-mapeo snapshot a otro grupo (productos_y_mercado).
    const cajasOtro = cajasBanco.filter((c) => c.grupo_ui === 'productos_y_mercado');
    input.extracciones_snapshot = cajasOtro.slice(0, 1).map((c) => ({
      caja_codigo: c.codigo,
      valor: 'x',
      confianza: 0.9,
      evidencia_textual: 'algo',
      status: 'llena' as const,
      version: 1,
    }));
    mockReviewsRows.value = [];
    mockExtracciones.value = [];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.razon).toBe('snapshot_not_in_grupo');
  });

  it('G3 — crítica del grupo aplicable no extraída → critical_cajas_actionable', async () => {
    // Snapshot incluye 1 crítica del grupo (G2 pasa), pero faltan otras
    // críticas del grupo que están vacías → G3 las marca pendientes.
    const input: SolicitarReviewSeccionInput = {
      grupo_ui_codigo: 'identificacion',
      extracciones_snapshot: [
        {
          caja_codigo: criticasIdent[0].codigo,
          valor: 'x',
          confianza: 0.9,
          evidencia_textual: 'evidencia válida del usuario',
          status: 'llena',
          version: 1,
        },
      ],
      cajas_no_clausuradas: [],
      hipotesis_sonnet:
        'Identidad institucional medianamente capturada — falta confirmar regulación',
      turno_disparador: 2,
    };
    mockReviewsRows.value = [];
    // Solo 1 extracción real persistida; las demás críticas quedan vacías.
    mockExtracciones.value = [
      {
        id: 'ext-0',
        sesion_id: SESION_ID,
        turno_id: 't-0',
        caja_codigo: criticasIdent[0].codigo,
        valor: 'x',
        confianza: 0.9,
        fuente: 'llm',
        evidencia_textual: 'algo',
        version: 1,
        superseded_by: null,
        created_at: new Date(),
      },
    ];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.razon).toBe('critical_cajas_actionable');
    // Las otras críticas del grupo identificacion (no extraídas) deben aparecer.
    expect(out.cajas_pendientes?.length ?? 0).toBe(criticasIdent.length - 1);
  });

  it('G3 — todas críticas terminales (extracciones reales) → ok', async () => {
    const input = buildInputBase();
    injectExtraccionesSnapshot(input);
    mockReviewsRows.value = [];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(true);
  });

  it('G3 — crítica accionable pero declarada con turnos_intentados >= 2 → ok', async () => {
    const input = buildInputBase();
    // Removemos la última crítica del snapshot — quedará vacía en el mapa.
    const removida = criticasIdent[criticasIdent.length - 1].codigo;
    input.extracciones_snapshot = input.extracciones_snapshot.filter(
      (s) => s.caja_codigo !== removida
    );
    input.cajas_no_clausuradas = [
      {
        caja_codigo: removida,
        razon: 'usuario_evade',
        detalle: '3 reformulaciones, usuario cambia tema',
        turnos_intentados: 3,
      },
    ];
    injectExtraccionesSnapshot(input);
    mockReviewsRows.value = [];

    const out = await canCloseSeccion({
      sesion_id: SESION_ID,
      input,
      cajasAplicables: cajasBanco,
    });
    expect(out.ok).toBe(true);
  });
});
