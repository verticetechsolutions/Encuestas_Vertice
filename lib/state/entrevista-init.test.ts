// Tests del store entrevista.init() — el path de rehidratación que conecta
// `cargarRehidratacion` (server-side, integration-tested en
// lib/motor/rehidratacion.integration.test.ts) con el estado client-side al
// reload (fix bug O1 entrevista — doc bugs-encontrados-2026-05-11-e2e §O1).
//
// Cobertura puramente client-side:
//   - Con rehidratacion: batch_actual, llenas_por_grupo, drafts, autosave_estado
//     y status quedan seedeados antes del primer render del shell (sin parpadeo
//     "Cargando..." → batch correcto).
//   - Filtrado de drafts huérfanos (preguntas que no están en el batch
//     rehidratado se descartan para no contaminar el state).
//   - preview_mode coexiste con rehidratacion.
//   - Sin rehidratacion: status='esperando_batch' (no asume primer batch).
//
// La integración server↔client está cubierta end-to-end por el smoke real
// /entrevista. Acá solo testeamos el contrato del store.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub de Server Action — el store no debe llamarla en init() (solo en
// setRespuesta tras debounce), pero hay que mockearla para evitar el side
// effect en imports.
vi.mock('@/app/actions/respuestas', () => ({
  guardarRespuestaPendiente: vi.fn(async () => ({ ok: true })),
}));

import { useEntrevistaStore, PRIMER_BATCH_BIENVENIDA } from './entrevista';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { PreguntaBatch } from '@/lib/schemas/pregunta-batch';

const SESION_ID = '11111111-1111-4111-8111-111111111111';

function emptyTotalsPorGrupo(): Record<GrupoUI, number> {
  const out = {} as Record<GrupoUI, number>;
  for (const g of GrupoUISchema.options) out[g] = 0;
  return out;
}

function buildBatch(id: string, ...preguntaIds: string[]): PreguntaBatch {
  return {
    id,
    preguntas: preguntaIds.map((pid, i) => ({
      id: pid,
      texto_pregunta: `¿Pregunta ${i + 1}?`,
      cajas_objetivo: [`caja-${pid}`],
      tipo: 'directa',
    })),
  };
}

beforeEach(() => {
  // Reset store entre tests — Zustand stores son globales, los snapshots
  // contaminan tests subsecuentes. Usamos setState con todas las keys default.
  useEntrevistaStore.setState({
    sesion_id: '',
    status: 'cargando',
    batch_actual: null,
    respuestas_pendientes: {},
    marcadas_respondidas: {},
    cajas_llenas_por_grupo: {} as Record<GrupoUI, { llenas: number; total: number }>,
    autosave_estado: {},
    ultimo_error_turn: null,
    mensaje_estado: null,
    preview_mode: false,
  });
});

describe('useEntrevistaStore.init() — sin rehidratacion', () => {
  it('seedea totals y deja status=esperando_batch (fallback a primer_batch)', () => {
    const totales: Record<GrupoUI, number> = {
      ...emptyTotalsPorGrupo(),
      identificacion: 5,
      productos_y_mercado: 7,
    };

    useEntrevistaStore.getState().init(SESION_ID, totales);

    const s = useEntrevistaStore.getState();
    expect(s.sesion_id).toBe(SESION_ID);
    expect(s.status).toBe('esperando_batch');
    expect(s.batch_actual).toBeNull();
    expect(s.cajas_llenas_por_grupo.identificacion).toEqual({
      llenas: 0,
      total: 5,
    });
    expect(s.cajas_llenas_por_grupo.productos_y_mercado).toEqual({
      llenas: 0,
      total: 7,
    });
  });

  it('preview=true setea preview_mode sin afectar otras keys', () => {
    useEntrevistaStore
      .getState()
      .init(SESION_ID, emptyTotalsPorGrupo(), { preview: true });
    expect(useEntrevistaStore.getState().preview_mode).toBe(true);
    expect(useEntrevistaStore.getState().status).toBe('esperando_batch');
  });
});

describe('useEntrevistaStore.init() — con rehidratacion (fix O1)', () => {
  it('seedea batch_actual desde rehidratacion + status=mostrando_batch', () => {
    const batch = buildBatch('batch-rehidratado-001', 'p-1', 'p-2');
    const totales: Record<GrupoUI, number> = {
      ...emptyTotalsPorGrupo(),
      identificacion: 5,
    };
    const llenas_por_grupo: Record<GrupoUI, number> = {
      ...emptyTotalsPorGrupo(),
      identificacion: 3,
    };

    useEntrevistaStore.getState().init(SESION_ID, totales, {
      rehidratacion: { batch, llenas_por_grupo },
    });

    const s = useEntrevistaStore.getState();
    expect(s.status).toBe('mostrando_batch');
    expect(s.batch_actual).toEqual(batch);
    expect(s.cajas_llenas_por_grupo.identificacion).toEqual({
      llenas: 3,
      total: 5,
    });
  });

  it('drafts del batch actual se seedean a respuestas_pendientes + autosave=saved', () => {
    const batch = buildBatch('batch-001', 'p-1', 'p-2');
    const drafts = {
      'p-1': 'Banco Demo SA',
      'p-2': 'Multiva',
    };

    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo(), {
      rehidratacion: {
        batch,
        llenas_por_grupo: emptyTotalsPorGrupo() as unknown as Record<GrupoUI, number>,
        drafts,
      },
    });

    const s = useEntrevistaStore.getState();
    expect(s.respuestas_pendientes['p-1']).toBe('Banco Demo SA');
    expect(s.respuestas_pendientes['p-2']).toBe('Multiva');
    expect(s.autosave_estado['p-1']).toBe('saved');
    expect(s.autosave_estado['p-2']).toBe('saved');
  });

  it('drafts huérfanos (pregunta_id no en batch) se descartan', () => {
    const batch = buildBatch('batch-fresco', 'p-actual-1', 'p-actual-2');
    // 2 drafts del batch nuevo + 1 huérfano de batch viejo.
    const drafts = {
      'p-actual-1': 'respuesta nueva',
      'p-actual-2': 'otra nueva',
      'p-vieja-99': 'respuesta huérfana del batch anterior',
    };

    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo(), {
      rehidratacion: {
        batch,
        llenas_por_grupo: emptyTotalsPorGrupo() as unknown as Record<GrupoUI, number>,
        drafts,
      },
    });

    const s = useEntrevistaStore.getState();
    expect(Object.keys(s.respuestas_pendientes).sort()).toEqual([
      'p-actual-1',
      'p-actual-2',
    ]);
    expect(s.respuestas_pendientes['p-vieja-99']).toBeUndefined();
  });

  it('drafts vacíos (sin field drafts) no rompe — respuestas_pendientes={}', () => {
    const batch = buildBatch('batch-fresh', 'p-1');
    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo(), {
      rehidratacion: {
        batch,
        llenas_por_grupo: emptyTotalsPorGrupo() as unknown as Record<GrupoUI, number>,
      },
    });
    expect(useEntrevistaStore.getState().respuestas_pendientes).toEqual({});
    expect(useEntrevistaStore.getState().autosave_estado).toEqual({});
  });

  it('preview=true + rehidratacion coexisten (preview_mode honra rehidratacion)', () => {
    const batch = buildBatch('batch-preview', 'p-1');
    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo(), {
      preview: true,
      rehidratacion: {
        batch,
        llenas_por_grupo: emptyTotalsPorGrupo() as unknown as Record<GrupoUI, number>,
      },
    });
    const s = useEntrevistaStore.getState();
    expect(s.preview_mode).toBe(true);
    expect(s.batch_actual).toEqual(batch);
    expect(s.status).toBe('mostrando_batch');
  });

  it('llenas_por_grupo del rehidratacion clamp a total del grupo (no mayor)', () => {
    // Defensa: si el server alguna vez devolviera llenas > total (bug), el
    // contador queda exactamente con lo que diga el server. NO clampeamos —
    // confiamos en computeMapaIncertidumbre como source of truth.
    const batch = buildBatch('b', 'p-1');
    const totales: Record<GrupoUI, number> = {
      ...emptyTotalsPorGrupo(),
      identificacion: 5,
    };
    const llenas: Record<GrupoUI, number> = {
      ...emptyTotalsPorGrupo(),
      identificacion: 5,
    };
    useEntrevistaStore.getState().init(SESION_ID, totales, {
      rehidratacion: { batch, llenas_por_grupo: llenas },
    });
    expect(
      useEntrevistaStore.getState().cajas_llenas_por_grupo.identificacion
    ).toEqual({ llenas: 5, total: 5 });
  });
});

describe('cargarPrimerBatch — idempotencia (no pisa batch rehidratado)', () => {
  it('si batch_actual ya existe (rehidratacion), cargarPrimerBatch es no-op', () => {
    const batch = buildBatch('batch-rehidratado', 'p-1');
    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo(), {
      rehidratacion: {
        batch,
        llenas_por_grupo: emptyTotalsPorGrupo() as unknown as Record<GrupoUI, number>,
      },
    });
    expect(useEntrevistaStore.getState().batch_actual?.id).toBe('batch-rehidratado');

    useEntrevistaStore.getState().cargarPrimerBatch();

    // Sigue siendo el batch rehidratado, NO el primer batch bienvenida.
    expect(useEntrevistaStore.getState().batch_actual?.id).toBe('batch-rehidratado');
  });

  it('sin batch_actual, cargarPrimerBatch carga PRIMER_BATCH_BIENVENIDA', () => {
    useEntrevistaStore.getState().init(SESION_ID, emptyTotalsPorGrupo());
    useEntrevistaStore.getState().cargarPrimerBatch();
    expect(useEntrevistaStore.getState().batch_actual?.id).toBe(
      PRIMER_BATCH_BIENVENIDA.id
    );
    expect(useEntrevistaStore.getState().status).toBe('mostrando_batch');
  });
});
