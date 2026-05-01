// Tool definitions que ve Sonnet 4.6 en Fase 1.
//
// Tres tools, ni una más. Founder excluyó deliberadamente `marcar_caja_llena` —
// la caja se marca llena automáticamente cuando una extracción cruza el threshold
// (lógica en `computeMapaIncertidumbre`). Tener `marcar_caja_llena` como tool del
// modelo le daría una vía para sub-llenar el form sin extraer (mal incentivo).
//
// Cada tool exporta:
//   - `<NAME>InputSchema`: Zod para validar input al recibirlo (capa motor).
//   - `<NAME>Input`: tipo TS via z.infer.
//   - `<NAME>_TOOL`: definición Anthropic (name + description + input_schema JSON).
//
// El array `SONNET_FASE1_TOOLS` agrupa los tres para pasarlos al SDK de Anthropic.
//
// Notas operativas:
//   - `registrar_extraccion.valor` queda `z.unknown()` por diseño. La capa motor
//     resuelve la forma esperada vía `valorSchemaFor(caja_codigo)` cuando recibe el
//     tool_use. Sonnet aprende la forma esperada del bloque
//     `<formato_valores_por_caja>` que se inyecta al system prompt en el step 3
//     de Fase 5 (a discutir con founder).
//   - `version` y `superseded_by` NO los maneja Sonnet. El motor autoincrementa
//     `version` y settea `superseded_by` cuando recibe una extracción nueva sobre
//     una caja con extracción previa.
//   - `cajas_objetivo` en `generar_batch_preguntas` es self-reported: telemetría
//     de calidad de prompt (compara intended vs cajas que efectivamente cerraron).

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tipo Anthropic tool — defino inline para no atar el archivo al SDK exact path.
// El SDK acepta este shape en la opción `tools` de messages.create().
// ---------------------------------------------------------------------------
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// ===========================================================================
// 1. registrar_extraccion
// ===========================================================================
// Sonnet llama esta tool una o más veces por turno conforme va extrayendo cajas
// del último batch de respuestas del usuario. Una llamada puede traer múltiples
// extracciones — eso ahorra round-trips. La capa motor:
//   1. Valida cada `valor` contra `valorSchemaFor(caja_codigo)`.
//   2. Si hay extracción previa para esa caja, la marca como superseded_by ←
//      la nueva, y autoincrementa `version`.
//   3. Persiste a la tabla `extracciones`.

export const RegistrarExtraccionItemSchema = z.object({
  caja_codigo: z.string().min(1, { message: 'caja_codigo no puede estar vacío' }),
  /**
   * Forma depende de `caja_codigo`. La capa motor valida con `valorSchemaFor`.
   * Sonnet aprende qué shape mandar del bloque `<formato_valores_por_caja>` del
   * system prompt.
   */
  valor: z.unknown(),
  confianza: z.number().min(0).max(1),
  evidencia_textual: z
    .string()
    .min(1, { message: 'evidencia_textual es obligatoria — cita la frase original del entrevistado' }),
  /**
   * Sonnet marca esto cuando sabe que está corrigiendo o reemplazando una
   * extracción previa (ej. el usuario clarificó que dijo otra cosa). El motor
   * lo usa como hint para confirmar el supersede chain.
   */
  contradice_extraccion_previa: z.boolean().optional(),
});
export type RegistrarExtraccionItem = z.infer<typeof RegistrarExtraccionItemSchema>;

export const RegistrarExtraccionInputSchema = z.object({
  extracciones: z.array(RegistrarExtraccionItemSchema).min(1),
});
export type RegistrarExtraccionInput = z.infer<typeof RegistrarExtraccionInputSchema>;

export const REGISTRAR_EXTRACCION_TOOL: AnthropicTool = {
  name: 'registrar_extraccion',
  description: [
    'Registra una o más extracciones de cajas a partir del último batch de respuestas del usuario.',
    'Una sola llamada puede traer múltiples extracciones (más eficiente que llamar una por una).',
    'El campo `valor` debe respetar la forma esperada por la caja según el bloque <formato_valores_por_caja> del system prompt.',
    '`evidencia_textual` es obligatoria: cita la frase original del entrevistado que sustenta el valor.',
    '`confianza` ∈ [0,1]. La caja se marca llena automáticamente cuando confianza ≥ 0.80 (críticas) o ≥ 0.65 (blandas).',
    'Si estás corrigiendo o reemplazando una extracción previa para la misma caja, marca contradice_extraccion_previa=true.',
  ].join(' '),
  input_schema: z.toJSONSchema(RegistrarExtraccionInputSchema) as Record<string, unknown>,
};

// ===========================================================================
// 2. generar_batch_preguntas
// ===========================================================================
// Sonnet llama esta tool cuando el orquestador le pide el siguiente batch.
// Un batch agrupa 2-4 preguntas temáticamente cercanas para que el usuario
// responda en bloque (mejor para entrevista hablada que pregunta-por-pregunta).
// `cajas_objetivo` es self-reported: Sonnet declara qué cajas espera tocar con
// cada pregunta. Sirve para auditar calidad del prompt comparando intent vs
// cajas que efectivamente cerraron tras el batch.

export const PreguntaSchema = z.object({
  texto: z.string().min(1, { message: 'texto de pregunta no puede estar vacío' }),
  cajas_objetivo: z
    .array(z.string().min(1))
    .min(1, { message: 'cada pregunta debe declarar al menos una caja objetivo' }),
});
export type Pregunta = z.infer<typeof PreguntaSchema>;

export const GenerarBatchPreguntasInputSchema = z
  .object({
    preguntas: z.array(PreguntaSchema).min(2).max(4),
    longitud_batch: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  })
  .refine((d) => d.preguntas.length === d.longitud_batch, {
    message: 'preguntas.length debe coincidir con longitud_batch',
    path: ['preguntas'],
  });
export type GenerarBatchPreguntasInput = z.infer<typeof GenerarBatchPreguntasInputSchema>;

export const GENERAR_BATCH_PREGUNTAS_TOOL: AnthropicTool = {
  name: 'generar_batch_preguntas',
  description: [
    'Genera el siguiente batch de preguntas para el entrevistado (2, 3 o 4 preguntas temáticamente cercanas).',
    'Cada pregunta declara las cajas que pretende tocar (`cajas_objetivo`) — esto es telemetría de calidad de prompt.',
    'Las preguntas deben ser abiertas (no checkboxes). En entrevista hablada, agrupar 2-4 reduce fricción frente a una-por-una.',
    'NO repitas preguntas que ya tocaron cajas con confianza ≥ threshold. Prioriza cajas críticas con status `parcial` (cerca de threshold) o `vacia`.',
    '`longitud_batch` debe coincidir con `preguntas.length` (validado al recibirse).',
  ].join(' '),
  input_schema: z.toJSONSchema(GenerarBatchPreguntasInputSchema) as Record<string, unknown>,
};

// ===========================================================================
// 3. solicitar_caso_sintetico
// ===========================================================================
// Sonnet llama esta tool cuando una caja resiste 3 preguntas directas o cuando
// detecta que un caso sintético (escenario de cliente real) destrabaría más
// señales que más preguntas abstractas. El orquestador decide si dispara Opus
// para generar el caso o agarra del fallback (db/seeds/safe_rails_casos.ts).
// Sujeto al cap global de 5 casos por sesión.

export const SolicitarCasoSinteticoInputSchema = z.object({
  cajas_objetivo: z
    .array(z.string().min(1))
    .min(1, { message: 'el caso debe targetear al menos una caja' }),
  hipotesis_a_clausurar: z
    .string()
    .min(1, {
      message: 'describe en una línea qué hipótesis sobre la institución busca cerrar este caso',
    }),
  urgencia: z.enum(['alta', 'media']),
});
export type SolicitarCasoSinteticoInput = z.infer<typeof SolicitarCasoSinteticoInputSchema>;

export const SOLICITAR_CASO_SINTETICO_TOOL: AnthropicTool = {
  name: 'solicitar_caso_sintetico',
  description: [
    'Solicita al orquestador que muestre un caso sintético al entrevistado.',
    'Úsalo cuando una caja resiste 3+ preguntas directas o cuando un escenario concreto destrabaría señales más rápido que preguntar abstracto.',
    'Cada sesión tiene cap global de 5 casos sintéticos. El orquestador decide si genera con Opus o usa fallback curado.',
    'urgencia="alta" reserva un slot para una caja crítica resistente; urgencia="media" para profundizar en blandas o tolerancias.',
    'NO la llames si ya se mostraron 5 casos en la sesión — el cap está hard-stopped por el motor.',
  ].join(' '),
  input_schema: z.toJSONSchema(SolicitarCasoSinteticoInputSchema) as Record<string, unknown>,
};

// ===========================================================================
// Bundle
// ===========================================================================
export const SONNET_FASE1_TOOLS: readonly AnthropicTool[] = [
  REGISTRAR_EXTRACCION_TOOL,
  GENERAR_BATCH_PREGUNTAS_TOOL,
  SOLICITAR_CASO_SINTETICO_TOOL,
] as const;

export type SonnetToolName =
  | 'registrar_extraccion'
  | 'generar_batch_preguntas'
  | 'solicitar_caso_sintetico';
