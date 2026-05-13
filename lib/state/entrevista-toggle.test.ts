// Tests del action `togglearMarcada` — cierre del bug O3 race condition
// (deuda #2, doc archive/bugs/2026-05-11-e2e.md §O3).
//
// El bug: navegación entre preguntas + marcado en automation sub-segundo dejaba
// el contador global "X MARCADAS" con solo la última marca, perdiendo las
// previas. Causa raíz: `MarcarButton.onToggle={() => onToggleMarcada(!marcada)}`
// cerraba sobre `marcada` (prop) potencialmente stale entre renders rápidos.
//
// Fix: action atómico `togglearMarcada(preguntaId)` que lee el state actual
// via `set((s) => ...)` y togglea el flag sin depender de un valor cerrado.
//
// Tests:
//   1. Toggle único: false → true → false → true.
//   2. Toggle concurrente sobre 3 preguntas distintas — todas quedan true (no se
//      pisan entre sí aunque las llamadas sean síncronas).
//   3. Toggle interleaved con marcarRespondida explícito — orden secuencial OK.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/app/actions/respuestas', () => ({
  guardarRespuestaPendiente: vi.fn(async () => ({ ok: true })),
}));

import { useEntrevistaStore } from './entrevista';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';

function freshStore() {
  // Reset del store al estado inicial. useEntrevistaStore es un singleton
  // (zustand create), así que cada test debe limpiar marcadas_respondidas
  // explícitamente.
  useEntrevistaStore.setState({
    marcadas_respondidas: {},
    preguntas_con_stt: {},
  });
}

describe('togglearMarcada — bug O3 race condition fix', () => {
  beforeEach(() => {
    freshStore();
  });

  it('togglea idempotentemente entre true y false', () => {
    const { togglearMarcada } = useEntrevistaStore.getState();
    expect(useEntrevistaStore.getState().marcadas_respondidas['p1']).toBeUndefined();

    togglearMarcada('p1');
    expect(useEntrevistaStore.getState().marcadas_respondidas['p1']).toBe(true);

    togglearMarcada('p1');
    expect(useEntrevistaStore.getState().marcadas_respondidas['p1']).toBe(false);

    togglearMarcada('p1');
    expect(useEntrevistaStore.getState().marcadas_respondidas['p1']).toBe(true);
  });

  it('toggles secuenciales sobre 3 preguntas distintas NO se pisan entre sí (escenario del bug O3)', () => {
    const { togglearMarcada } = useEntrevistaStore.getState();

    // Simula el escenario reproducible: marcar P1 → navegar → marcar P2 →
    // navegar → marcar P3, todo sub-segundo. En el bug original el contador
    // global terminaba con solo la última marca; aquí verificamos que las 3
    // quedan TRUE en el state.
    togglearMarcada('p1');
    togglearMarcada('p2');
    togglearMarcada('p3');

    const marcadas = useEntrevistaStore.getState().marcadas_respondidas;
    expect(marcadas['p1']).toBe(true);
    expect(marcadas['p2']).toBe(true);
    expect(marcadas['p3']).toBe(true);

    // Contador global computado igual que en el shell:
    // `batch.preguntas.every((p) => marcadas[p.id] === true)`.
    const allMarcadas = ['p1', 'p2', 'p3'].every((id) => marcadas[id] === true);
    expect(allMarcadas).toBe(true);
  });

  it('coexiste con marcarRespondida explícito sin perder state', () => {
    const { togglearMarcada, marcarRespondida } = useEntrevistaStore.getState();

    marcarRespondida('p1', true);
    togglearMarcada('p2');
    marcarRespondida('p3', true);
    togglearMarcada('p1'); // P1: true → false

    const marcadas = useEntrevistaStore.getState().marcadas_respondidas;
    expect(marcadas['p1']).toBe(false);
    expect(marcadas['p2']).toBe(true);
    expect(marcadas['p3']).toBe(true);
  });

  it('togglearMarcada con state previamente seedeado se basa en él, no en undefined', () => {
    const { togglearMarcada } = useEntrevistaStore.getState();
    useEntrevistaStore.setState({
      marcadas_respondidas: { p1: true, p2: false },
    });

    togglearMarcada('p1'); // true → false
    togglearMarcada('p2'); // false → true
    togglearMarcada('p3'); // undefined → true (truthy invert)

    const marcadas = useEntrevistaStore.getState().marcadas_respondidas;
    expect(marcadas['p1']).toBe(false);
    expect(marcadas['p2']).toBe(true);
    expect(marcadas['p3']).toBe(true);
  });
});

describe('togglearMarcada — invariantes del state', () => {
  beforeEach(() => {
    freshStore();
  });

  it('no toca preguntas_con_stt al togglear', () => {
    const { togglearMarcada, marcarSttUsado } = useEntrevistaStore.getState();
    marcarSttUsado('p1');
    togglearMarcada('p1');

    expect(useEntrevistaStore.getState().preguntas_con_stt['p1']).toBe(true);
    expect(useEntrevistaStore.getState().marcadas_respondidas['p1']).toBe(true);
  });

  it('no toca cajas_llenas_por_grupo al togglear', () => {
    const { togglearMarcada } = useEntrevistaStore.getState();
    const grupos: GrupoUI[] = GrupoUISchema.options;
    const before = useEntrevistaStore.getState().cajas_llenas_por_grupo;
    togglearMarcada('p1');
    const after = useEntrevistaStore.getState().cajas_llenas_por_grupo;

    for (const g of grupos) {
      expect(after[g]).toEqual(before[g]);
    }
  });
});
