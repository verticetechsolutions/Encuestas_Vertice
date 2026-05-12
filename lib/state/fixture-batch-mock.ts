// Mock batch shown in the entrevista shell when ANTHROPIC_API_KEY isn't wired.
// Once /api/turn is operative, the store will replace this with the real
// streamed batch from Sonnet — this file is dev-only scaffolding.
//
// The 3 preguntas target cajas del núcleo común de Vértice
// (productos_y_mercado + numeros_del_negocio) — all CANON, applicable to any
// tipo de institución.

import type { PreguntaBatch } from './entrevista';

export const FIXTURE_BATCH_MOCK: PreguntaBatch = {
  id: 'mock-batch-001',
  preguntas: [
    {
      id: 'mock-p-1',
      texto_pregunta: '¿Qué productos crediticios ofrecen hoy?',
      auxiliar: 'Capital de trabajo, crédito simple, factoraje, arrendamiento, lo que apliquen.',
      cajas_objetivo: ['nm_productos_ofrecidos'],
      tipo: 'directa',
    },
    {
      id: 'mock-p-2',
      texto_pregunta: '¿Qué sectores financian activamente?',
      auxiliar: 'Después te pregunto cuáles tienen rechazo automático por política.',
      cajas_objetivo: ['nm_sectores_aceptados', 'nm_sectores_excluidos'],
      tipo: 'directa',
    },
    {
      id: 'mock-p-3',
      texto_pregunta: '¿Qué ticket originan hoy?',
      auxiliar: 'El piso, el techo y el ideal si lo manejan, en MXN.',
      cajas_objetivo: ['ru_monto_min', 'ru_monto_max', 'ru_ticket_ideal'],
      tipo: 'directa',
    },
  ],
};
