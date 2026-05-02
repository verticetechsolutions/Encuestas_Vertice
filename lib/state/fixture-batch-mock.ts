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
      texto_pregunta:
        '¿Qué productos de crédito ofrece su institución actualmente? Por ejemplo: capital de trabajo, crédito simple, factoraje, arrendamiento, etc.',
      cajas_objetivo: ['nm_productos_ofrecidos'],
      tipo: 'directa',
    },
    {
      id: 'mock-p-2',
      texto_pregunta:
        '¿En qué sectores económicos financian activamente y cuáles tienen rechazo automático? Mencionar tanto los que más operan como los que evitan por política.',
      cajas_objetivo: ['nm_sectores_aceptados', 'nm_sectores_excluidos'],
      tipo: 'directa',
    },
    {
      id: 'mock-p-3',
      texto_pregunta:
        '¿Cuál es el monto mínimo y máximo por operación que están dispuestos a desembolsar (en pesos mexicanos)? Y si tienen un ticket ideal, ¿cuál sería?',
      cajas_objetivo: ['ru_monto_min', 'ru_monto_max', 'ru_ticket_ideal'],
      tipo: 'directa',
    },
  ],
};
