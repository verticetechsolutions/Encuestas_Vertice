// Zustand store for the entrevista UI (Phase 7 shell).
//
// Spec: IMPLEMENTATION.md §8.3 (EntrevistaState) ampliada con marcadas_respondidas,
// cajas_llenas_por_grupo y cargarFixtureMock para soportar dev sin API key.
//
// Autosave model (memoria feedback_resolved_decisions §6 autosave_1.5s):
//   - setRespuesta updates the in-memory text immediately and schedules a
//     server-action call after 1.5s of inactivity for that pregunta.
//   - Per-pregunta debounce timers (a single global timer would coalesce
//     unrelated preguntas).
//   - Failures are non-blocking — logged in console + a transient ui flag,
//     never throw to the component.

import { create } from 'zustand';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import { guardarRespuestaPendiente } from '@/app/actions/respuestas';
import { FIXTURE_BATCH_MOCK } from './fixture-batch-mock';

// =============================================================================
// Public types — exported for components and the fixture file
// =============================================================================

export type TipoPregunta = 'directa' | 'caso_sintetico_solicitado';

export interface Pregunta {
  id: string;
  texto_pregunta: string;
  cajas_objetivo: string[];
  tipo: TipoPregunta;
}

export interface PreguntaBatch {
  id: string;
  preguntas: Pregunta[];
}

export type EntrevistaStatus =
  | 'cargando'
  | 'esperando_batch'
  | 'mostrando_batch'
  | 'enviando'
  | 'procesando'
  | 'cerrada';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface CajasGrupoCount {
  llenas: number;
  total: number;
}

interface EntrevistaState {
  sesion_id: string;
  status: EntrevistaStatus;
  batch_actual: PreguntaBatch | null;
  respuestas_pendientes: Record<string, string>; // preguntaId → texto
  marcadas_respondidas: Record<string, boolean>; // preguntaId → boolean
  cajas_llenas_por_grupo: Record<GrupoUI, CajasGrupoCount>;
  // Per-pregunta autosave UI state (status text in the card footer).
  autosave_estado: Record<string, AutosaveStatus>;

  // Actions
  init: (sesion_id: string, totalsPorGrupo: Record<GrupoUI, number>) => void;
  setRespuesta: (preguntaId: string, texto: string) => void;
  marcarRespondida: (preguntaId: string, marcada: boolean) => void;
  enviarBatch: () => Promise<void>;
  cargarFixtureMock: () => void;
}

// =============================================================================
// Internals — debounce timers live OUTSIDE the store so Zustand state stays
// JSON-serializable. Timer ids are keyed by `${sesion_id}::${pregunta_id}` to
// avoid collisions if two sessions ever coexist (e.g. tab restore edge cases).
// =============================================================================

const AUTOSAVE_DEBOUNCE_MS = 1_500;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debounceKey(sesion_id: string, pregunta_id: string): string {
  return `${sesion_id}::${pregunta_id}`;
}

function emptyGrupoCounts(): Record<GrupoUI, CajasGrupoCount> {
  const out = {} as Record<GrupoUI, CajasGrupoCount>;
  for (const g of GrupoUISchema.options) {
    out[g] = { llenas: 0, total: 0 };
  }
  return out;
}

// =============================================================================
// Store
// =============================================================================

export const useEntrevistaStore = create<EntrevistaState>((set, get) => ({
  sesion_id: '',
  status: 'cargando',
  batch_actual: null,
  respuestas_pendientes: {},
  marcadas_respondidas: {},
  cajas_llenas_por_grupo: emptyGrupoCounts(),
  autosave_estado: {},

  init: (sesion_id, totalsPorGrupo) => {
    const cajas_llenas_por_grupo = emptyGrupoCounts();
    for (const g of GrupoUISchema.options) {
      cajas_llenas_por_grupo[g] = { llenas: 0, total: totalsPorGrupo[g] ?? 0 };
    }
    set({ sesion_id, cajas_llenas_por_grupo, status: 'esperando_batch' });
  },

  setRespuesta: (preguntaId, texto) => {
    set((s) => ({
      respuestas_pendientes: { ...s.respuestas_pendientes, [preguntaId]: texto },
      autosave_estado: { ...s.autosave_estado, [preguntaId]: 'pending' },
    }));

    const sesion_id = get().sesion_id;
    if (!sesion_id) return; // not init'd yet — skip autosave

    const key = debounceKey(sesion_id, preguntaId);
    const prev = debounceTimers.get(key);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(async () => {
      debounceTimers.delete(key);
      set((s) => ({
        autosave_estado: { ...s.autosave_estado, [preguntaId]: 'saving' },
      }));
      try {
        const res = await guardarRespuestaPendiente({
          sesion_id,
          pregunta_id: preguntaId,
          texto,
        });
        set((s) => ({
          autosave_estado: {
            ...s.autosave_estado,
            [preguntaId]: res.ok ? 'saved' : 'error',
          },
        }));
      } catch (err) {
        // Server action threw (network, etc). Non-blocking — log + flag.
        // eslint-disable-next-line no-console
        console.warn('[entrevista] autosave throw:', err);
        set((s) => ({
          autosave_estado: { ...s.autosave_estado, [preguntaId]: 'error' },
        }));
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    debounceTimers.set(key, timer);
  },

  marcarRespondida: (preguntaId, marcada) => {
    set((s) => ({
      marcadas_respondidas: { ...s.marcadas_respondidas, [preguntaId]: marcada },
    }));
  },

  enviarBatch: async () => {
    const { batch_actual, respuestas_pendientes, marcadas_respondidas } = get();
    if (!batch_actual) return;
    const todasMarcadas = batch_actual.preguntas.every(
      (p) => marcadas_respondidas[p.id] === true
    );
    if (!todasMarcadas) return;

    set({ status: 'enviando' });
    try {
      // TODO Fase 7+: cuando ANTHROPIC_API_KEY esté disponible, sustituir este
      // fetch placeholder por el llamado real a /api/turn (POST con
      // mensaje_usuario = string concatenado de las respuestas, y consumir el
      // stream UI message para extraer el siguiente batch).
      // Por ahora el shell solo simula la transición para que el founder vea
      // el "estado de envío" antes de quedar en esperando_batch otra vez.
      await new Promise((r) => setTimeout(r, 600));
      set({
        status: 'esperando_batch',
        batch_actual: null,
        respuestas_pendientes: {},
        marcadas_respondidas: {},
        autosave_estado: {},
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[entrevista] enviarBatch failed:', err);
      set({ status: 'mostrando_batch' });
    }

    void respuestas_pendientes; // explicit no-op — wiring point for /api/turn
  },

  cargarFixtureMock: () => {
    set({
      batch_actual: FIXTURE_BATCH_MOCK,
      status: 'mostrando_batch',
    });
  },
}));
