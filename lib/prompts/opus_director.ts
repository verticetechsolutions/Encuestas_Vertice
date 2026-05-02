// =============================================================================
// Opus director — review de sección (Phase 5 step iv) 🔒
// =============================================================================
//
// PLACEHOLDER. El system prompt literal del director NO se redacta en autónomo.
// Founder lo iteramos juntos cuando step (vi) E2E mock cierre verde.
//
// TODO step (iv): redactar el system prompt es-MX que recibe Opus 4.7 cuando es
// invocado para revisar una sección. Debe cubrir:
//   - Persona del director (diréctor financiero/de crédito senior con criterio
//     de boundaries en MX, NO un compliance officer ni un educador).
//   - Contrato del input que recibe: SolicitarReviewSeccionInput + mapa subset
//     del grupo + casos_usados + round_actual.
//   - Contrato del output: RespuestaOpusSchema (discriminated union avanzar |
//     profundizar | caso_sintetico). Estructura forzada vía tool-output schema.
//   - Reglas de calibración del threshold del director:
//       * Avanzar: la postura del grupo es legible aunque queden detalles sueltos.
//       * Profundizar: hay una caja crítica con evidencia ambigua que con guidance
//         específica destrabaría en ≤3 turnos extra.
//       * Caso sintético: la(s) caja(s) faltantes requieren un escenario concreto
//         para destrabar señal (ej. tolerancia a buró con manchas — preguntar
//         abstracto rinde poco; un caso "PM con 2 retrasos de 45 días en 12m"
//         destraba la respuesta institucional).
//   - Cap explícito: máximo 1 round de profundización; cap global de 5 casos por
//     sesión. Motor enforza, pero el prompt debe instruir a Opus para que no los
//     intente exceder en el primer lugar.
//   - Few-shots curados: ≥3 ejemplos cada uno de las 3 ramas de decisión, en es-MX,
//     con razonamiento explícito sobre por qué cada decisión es la correcta dado
//     el snapshot. Founder los curará.
//
// Hasta que founder firme, el motor (lib/motor/review.ts) usa la fn callOpusReview
// con `OPUS_DIRECTOR_PROMPT_READY === false` que arroja un error explícito
// `OpusReviewPromptNotReady`. La route /api/turn captura ese error y devuelve 501
// Not Implemented al cliente, indicando que el step iv está pendiente.

export const OPUS_DIRECTOR_SYSTEM_PROMPT_PLACEHOLDER = `
[PLACEHOLDER step (iv) — NO usar en producción]

TODO redactar con founder cuando step (vi) cierre verde.
`.trim();

export const OPUS_DIRECTOR_PROMPT_READY = false;
