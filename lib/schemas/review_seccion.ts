// Zod source of truth for the Sonnet→Opus review handoff (Phase 5 step 5).
// Mirrors spec v2 §2 (tool input — what Sonnet emits) and §3 (Opus response —
// discriminated union over `decision`), plus §6/§7 razones canónicas que el
// motor escribe en `cajas_declinadas` como side-effect.
//
// Why one file:
//   - Tool input + Opus output + decline razones son el mismo contrato de
//     handoff. Mantenerlos juntos evita drift entre las tres piezas cuando el
//     spec evolucione.
//   - `lib/motor/tools.ts` importa de aquí. Patrón espejo a cómo las extracciones
//     viven en `lib/schemas/extracciones.ts` y la tool `registrar_extraccion` solo
//     compone sobre ellas.
//
// Lo que NO está aquí:
//   - El persistence schema de `reviews_seccion` y `cajas_declinadas` vive en
//     `db/schema.ts` (Drizzle). Step (ii) lo agrega.
//   - La lógica de orquestación (cuándo se invoca cada decision branch) vive en
//     `lib/motor/review.ts` y `app/api/turn/route.ts`. Step (iii).

import { z } from 'zod';
import { GrupoUISchema } from './cajas';

// =============================================================================
// CajaStatus enum — Zod mirror del type en lib/motor/mapa.ts
// =============================================================================
// mapa.ts mantiene `CajaStatus` como TS-only (archivo sin zod). Aquí lo replicamos
// como enum para validar el snapshot que Sonnet adjunta. Si agregas un valor a
// uno, agrégalo al otro — no hay enforcement automático.

export const CajaStatusSchema = z.enum([
  'llena',
  'parcial',
  'vacia',
  'no_aplica',
  'contradictoria',
]);
export type CajaStatusZ = z.infer<typeof CajaStatusSchema>;

// =============================================================================
// Tool input — solicitar_review_seccion (spec §2)
// =============================================================================
// Sonnet emite esto cuando determina que cumple §1.2 (todas las críticas en
// terminal/parcial_estable, ninguna blanda en parcial_en_progreso<0.50, o
// override por techo de 8 turnos). El motor valida + lo persiste en
// `reviews_seccion` antes de pasarlo a Opus.

export const ExtraccionSnapshotItemSchema = z.object({
  caja_codigo: z.string().min(1, { message: 'caja_codigo no puede estar vacío' }),
  // Forma depende de caja_codigo. Aquí pasa-thru — la validación contra
  // valorSchemaFor() ya ocurrió cuando se persistió la extracción.
  valor: z.unknown(),
  confianza: z.number().min(0).max(1),
  evidencia_textual: z.string().min(1, {
    message: 'evidencia_textual obligatoria — cita la frase original',
  }),
  status: CajaStatusSchema,
  version: z.number().int().positive(),
});
export type ExtraccionSnapshotItem = z.infer<typeof ExtraccionSnapshotItemSchema>;

export const RazonNoClausuraSchema = z.enum([
  'estancada', // 3+ turnos sin cambio de confianza, no llega a threshold
  'contradictoria', // múltiples valores no-superseded en conflicto
  'evidencia_debil', // confianza alcanzada pero Sonnet duda de la cita
  'usuario_evade', // 3+ preguntas directas, usuario no contesta o cambia tema
]);
export type RazonNoClausura = z.infer<typeof RazonNoClausuraSchema>;

export const CajaNoClausuradaSchema = z.object({
  caja_codigo: z.string().min(1),
  razon: RazonNoClausuraSchema,
  detalle: z.string().min(1).max(200),
  turnos_intentados: z.number().int().nonnegative(),
});
export type CajaNoClausurada = z.infer<typeof CajaNoClausuradaSchema>;

export const SolicitarReviewSeccionInputSchema = z.object({
  grupo_ui_codigo: GrupoUISchema,
  extracciones_snapshot: z.array(ExtraccionSnapshotItemSchema).min(1, {
    message: 'extracciones_snapshot no puede estar vacío',
  }),
  cajas_no_clausuradas: z.array(CajaNoClausuradaSchema), // puede ser []
  hipotesis_sonnet: z
    .string()
    .min(20, {
      message: 'hipótesis vacía o trivial — describe la postura de la institución en 1 línea',
    })
    .max(400),
  turno_disparador: z.number().int().positive(),
});
export type SolicitarReviewSeccionInput = z.infer<typeof SolicitarReviewSeccionInputSchema>;

// =============================================================================
// Opus response — discriminated union sobre `decision` (spec §3)
// =============================================================================
// Tres branches, no más. El motor enforza:
//   1. `profundizar` solo en round 1; round 2 con esa decisión → reprompt.
//   2. `caso_sintetico` solo si casos_usados < 5; al cap → reprompt forzando avanzar.
//   3. `avanzar.siguiente_grupo_ui` debe coincidir con orden canónico §4.3 o ser null.

export const DecisionOpusSchema = z.enum(['avanzar', 'profundizar', 'caso_sintetico']);
export type DecisionOpus = z.infer<typeof DecisionOpusSchema>;

export const RespuestaOpusAvanzarSchema = z.object({
  decision: z.literal('avanzar'),
  // null sii era el último grupo (cierre de sesión §4.2.4).
  siguiente_grupo_ui: GrupoUISchema.nullable(),
  // Libre, opcional. Telemetría post-mortem para casos donde Opus avanzó pese a
  // tener cajas_no_clausuradas en el input.
  anotacion_audit: z.string().max(300).optional(),
});
export type RespuestaOpusAvanzar = z.infer<typeof RespuestaOpusAvanzarSchema>;

export const RespuestaOpusProfundizarSchema = z.object({
  decision: z.literal('profundizar'),
  // Texto es-MX para inyectar al system_prompt de Sonnet bajo <feedback_director>.
  // Mín 40 chars: descarta guidance trivial. Máx 1200: mantiene foco.
  guidance: z.string().min(40).max(1200),
  // Códigos de caja que Sonnet debe re-extraer. Min 1 — sin esto no hay foco.
  cajas_a_reabordar: z.array(z.string().min(1)).min(1),
});
export type RespuestaOpusProfundizar = z.infer<typeof RespuestaOpusProfundizarSchema>;

export const RazonEscalacionCasoSchema = z.enum([
  'profundizacion_agotada', // ya hubo round 1 profundizar y no cerró
  'caja_resistente', // crítica estancada, evidencia imposible vía pregunta abstracta
  'evidencia_imposible_via_pregunta', // Opus determina que solo un caso destraba esta señal
]);
export type RazonEscalacionCaso = z.infer<typeof RazonEscalacionCasoSchema>;

export const RespuestaOpusCasoSinteticoSchema = z.object({
  decision: z.literal('caso_sintetico'),
  cajas_objetivo: z.array(z.string().min(1)).min(1),
  hipotesis_a_clausurar: z.string().min(20).max(300),
  urgencia: z.enum(['alta', 'media']),
  razon_escalacion: RazonEscalacionCasoSchema,
});
export type RespuestaOpusCasoSintetico = z.infer<typeof RespuestaOpusCasoSinteticoSchema>;

export const RespuestaOpusSchema = z.discriminatedUnion('decision', [
  RespuestaOpusAvanzarSchema,
  RespuestaOpusProfundizarSchema,
  RespuestaOpusCasoSinteticoSchema,
]);
export type RespuestaOpus = z.infer<typeof RespuestaOpusSchema>;

// =============================================================================
// Decline canónico — razones que el motor escribe a `cajas_declinadas` (spec §6)
// =============================================================================
// Side-effect del motor cuando una caja queda sin clausurar tras un branch
// específico. Sonnet/Opus NO emiten estos valores directamente; los escribe el
// motor según el contexto del review.

export const RazonDeclineSchema = z.enum([
  'aceptada_round_1', // Opus avanzó sin profundizar pese a cajas_no_clausuradas
  'estancada_post_profundizar', // round 2 cerró sin clausurar
  'cap_casos_alcanzado', // Opus pidió caso pero estábamos al cap
  'cap_turnos_alcanzado', // review forzado por techo §1.2(3) y Opus avanzó
]);
export type RazonDecline = z.infer<typeof RazonDeclineSchema>;
