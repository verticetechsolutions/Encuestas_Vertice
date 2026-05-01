// System prompt scaffolding for Sonnet 4.6 in Phase 1 (entrevista adaptativa).
// The actual prompt is built in Phase 5 (motor conversacional). This file
// reserves the slot for the `<senales_a_escuchar>` block that anchors the
// to_* cajas to the 54 historical Likert items (now scaffolding-only).

// TODO Fase 1: inyectar señales_a_escuchar agrupadas por to_* (54 items, asesor las pasa)
//
// Expected shape per to_* caja (5 total: to_historial_credito, to_situacion_fiscal,
// to_ratios_financieros, to_colateral, to_gobierno_documentacion):
//
//   <caja codigo="to_historial_credito" criticidad="alta">
//     <descripcion>Tolerancia a manchas, retrasos y restructuras en historial</descripcion>
//     <senales_a_escuchar>
//       - Retrasos 1-30 días en últimos 12 meses
//       - Retrasos 31-60 días en últimos 24 meses
//       - Cuenta en restructura activa
//       - Crédito castigado pagado hace >36 meses
//       [... resto de los 11 ítems de 12A condensados como bullets cortos]
//     </senales_a_escuchar>
//     <formato_extraccion>
//       Texto libre estructurado describiendo qué tolera, con qué condiciones,
//       y qué es deal-breaker.
//     </formato_extraccion>
//   </caja>

export const SONNET_FASE1_SYSTEM_PROMPT = `
TODO: replace with the full Phase 1 system prompt. This is a placeholder that
the engine should refuse to load until señales_a_escuchar are wired in.
`.trim();

export const SONNET_FASE1_PROMPT_READY = false;
