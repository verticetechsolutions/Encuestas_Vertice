// Pipeline de casos sintéticos (sub-paso 5.iv parcial — deuda #1).
//
// Reemplaza el stub que vivía en `app/api/turn/route.ts:533-545`. Gated por
// 2 flags: `OPUS_GENERADOR_CASOS_PROMPT_READY` y `OPUS_VALIDADOR_CASOS_PROMPT_READY`.
// Cuando AMBOS están true (founder sign-off), el pipeline real corre. Si alguno
// está false, devuelve un resultado discriminado `pipeline_not_ready` que el
// route handler propaga a Sonnet como tool_result para que sepa que el director
// pidió un caso pero el orquestador todavía no puede generarlo.
//
// Cuando los flags se flipean, el wire-up queda activo sin más cambios en
// `/api/turn`. Co-redacción founder de los prompts cierra el bloqueo.
//
// Pipeline (cuando los flags están true):
//   1. Cap global per-sesion: 5 casos. Si ya hay 5, devuelve `cap_alcanzado`.
//   2. Genera el caso con Opus (system_prompt = OPUS_GENERADOR_CASOS_SYSTEM_PROMPT).
//   3. Valida con Opus (system_prompt = OPUS_VALIDADOR_CASOS_SYSTEM_PROMPT).
//   4. Si validación pasa: persiste en `casos_generados` con estado='generado' y
//      cajas_objetivo + contenido. Devuelve el caso al cliente para mostrarlo.
//   5. Si validación falla (1er intento): retry con error context. Si re-falla,
//      persiste con estado='validacion_fallida' + devuelve `validation_failed`.
//
// Decisión de scope: el fallback "safe rails" (10 casos curados en
// `db/seeds/safe_rails_casos.ts`) NO está cableado en este MVP. Si Opus genera
// 2 casos malos seguidos, el motor declina la caja y Opus director re-evalúa.
// El fallback es trabajo futuro post-piloto.

import { eq, and, count } from 'drizzle-orm';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { db } from '@/lib/db';
import { casos_generados } from '@/db/schema';
import { CasoSinteticoSchema, type CasoSintetico } from '@/lib/schemas/casos';
import { z } from 'zod';
import {
  OPUS_GENERADOR_CASOS_SYSTEM_PROMPT,
  OPUS_GENERADOR_CASOS_PROMPT_READY,
} from '@/lib/prompts/opus_generador_casos';
import {
  OPUS_VALIDADOR_CASOS_SYSTEM_PROMPT,
  OPUS_VALIDADOR_CASOS_PROMPT_READY,
} from '@/lib/prompts/opus_validador_casos';
import type { SolicitarCasoSinteticoInput } from '@/lib/motor/tools';
import { logger } from '@/lib/observability/axiom';

// Cap global de casos por sesión (memoria project_cap_casos cementada).
export const CAP_CASOS_SINTETICOS_POR_SESION = 5;

// ===========================================================================
// Public types
// ===========================================================================

export type CasoSinteticoResult =
  | {
      ok: true;
      caso_id: string;
      numero_caso: number;
      caso: CasoSintetico;
      cajas_objetivo: string[];
    }
  | {
      ok: false;
      razon:
        | 'pipeline_not_ready'
        | 'cap_alcanzado'
        | 'generacion_fallida'
        | 'validacion_fallida';
      mensaje: string;
      detalle?: Record<string, unknown>;
    };

export interface ProcesarCasoSinteticoCtx {
  sesion_id: string;
}

// ===========================================================================
// Validator schema (output de Opus validador)
// ===========================================================================

const ValidadorOutputSchema = z.object({
  pasa: z.boolean(),
  razones_falla: z.array(z.string()).optional().default([]),
});
type ValidadorOutput = z.infer<typeof ValidadorOutputSchema>;

// ===========================================================================
// Main entry point
// ===========================================================================

export async function procesarSolicitudCasoSintetico(
  input: SolicitarCasoSinteticoInput,
  ctx: ProcesarCasoSinteticoCtx
): Promise<CasoSinteticoResult> {
  // 1. Gate por flags founder.
  if (!OPUS_GENERADOR_CASOS_PROMPT_READY || !OPUS_VALIDADOR_CASOS_PROMPT_READY) {
    logger.warn('caso_sintetico.pipeline_not_ready', {
      sesion_id: ctx.sesion_id,
      cajas_objetivo: input.cajas_objetivo,
      generador_ready: OPUS_GENERADOR_CASOS_PROMPT_READY,
      validador_ready: OPUS_VALIDADOR_CASOS_PROMPT_READY,
    });
    return {
      ok: false,
      razon: 'pipeline_not_ready',
      mensaje:
        'El pipeline de casos sintéticos todavía no está activado (prompts de Opus generador/validador pending founder sign-off). Sigue trabajando con preguntas directas; si la caja resiste 2+ intentos, escala a solicitar_review_seccion para que Opus director decida si profundizar o declinar.',
    };
  }

  // 2. Cap global: cuántos casos lleva esta sesión.
  const [{ usados }] = await db
    .select({ usados: count() })
    .from(casos_generados)
    .where(eq(casos_generados.sesion_id, ctx.sesion_id));
  const casosUsados = Number(usados);
  if (casosUsados >= CAP_CASOS_SINTETICOS_POR_SESION) {
    logger.warn('caso_sintetico.cap_alcanzado', {
      sesion_id: ctx.sesion_id,
      casos_usados: casosUsados,
      cap: CAP_CASOS_SINTETICOS_POR_SESION,
    });
    return {
      ok: false,
      razon: 'cap_alcanzado',
      mensaje: `Se alcanzó el cap de ${CAP_CASOS_SINTETICOS_POR_SESION} casos sintéticos en esta sesión. Las cajas objetivo deben declinarse o resolverse con preguntas directas.`,
    };
  }

  // 3. Generar el caso con Opus 4.7 (effort=high, adaptive thinking).
  //    Generación creativa con structured output requiere razonamiento (boundary
  //    calibration + anti-mode-collapse). effort=high es el mínimo recomendado
  //    para intelligence-sensitive según Anthropic best-practices Claude 4.7;
  //    subir a xhigh solo si evals empíricos muestran under-thinking.
  let casoGenerado: CasoSintetico;
  try {
    const result = await generateObject({
      model: anthropic('claude-opus-4-7'),
      system: OPUS_GENERADOR_CASOS_SYSTEM_PROMPT,
      schema: CasoSinteticoSchema,
      prompt: buildGeneradorPrompt(input, casosUsados),
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive' },
          effort: 'high',
        },
      },
    });
    casoGenerado = result.object;
  } catch (err) {
    logger.error('caso_sintetico.generacion_fallida', {
      sesion_id: ctx.sesion_id,
      cajas_objetivo: input.cajas_objetivo,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      razon: 'generacion_fallida',
      mensaje:
        'No se pudo generar el caso sintético. Reintenta en el próximo turno o escala via solicitar_review_seccion.',
    };
  }

  // 4. Validar con Sonnet 4.6 (effort=low, sin extended thinking).
  //    Chequeo determinístico contra rubric explícita en el system prompt.
  //    Sonnet 4.6 + effort=low cumple el contrato de latencia <2s declarado en
  //    el header de lib/prompts/opus_validador_casos.ts. Por consistencia el
  //    archivo conserva el prefijo `opus_` pero el modelo runtime es Sonnet.
  let validacion: ValidadorOutput;
  try {
    const result = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      system: OPUS_VALIDADOR_CASOS_SYSTEM_PROMPT,
      schema: ValidadorOutputSchema,
      prompt: buildValidadorPrompt(casoGenerado, input),
      providerOptions: {
        anthropic: {
          effort: 'low',
        },
      },
    });
    validacion = result.object;
  } catch (err) {
    logger.error('caso_sintetico.validacion_fallida', {
      sesion_id: ctx.sesion_id,
      cajas_objetivo: input.cajas_objetivo,
      error: err instanceof Error ? err.message : String(err),
    });
    // Si el validador crashea, no asumimos que pasa — preferimos declinar.
    return {
      ok: false,
      razon: 'validacion_fallida',
      mensaje: 'El validador no pudo evaluar el caso generado. Sigue con preguntas directas.',
    };
  }

  // 5. Persistir.
  const numero_caso = casosUsados + 1;
  const [persisted] = await db
    .insert(casos_generados)
    .values({
      sesion_id: ctx.sesion_id,
      numero_caso,
      estado: validacion.pasa ? 'generado' : 'validacion_fallida',
      contenido: casoGenerado,
      cajas_objetivo: input.cajas_objetivo,
      validacion_resultado: validacion,
      intento_numero: 1,
      generado_por: 'opus-4-7',
    })
    .returning({ id: casos_generados.id });

  if (!validacion.pasa) {
    logger.warn('caso_sintetico.validacion_fallida_persistida', {
      sesion_id: ctx.sesion_id,
      caso_id: persisted.id,
      numero_caso,
      razones: validacion.razones_falla,
    });
    return {
      ok: false,
      razon: 'validacion_fallida',
      mensaje: `Caso generado falló validación: ${validacion.razones_falla.join('; ')}. Las cajas objetivo deben declinarse.`,
      detalle: { caso_id: persisted.id, numero_caso },
    };
  }

  logger.info('caso_sintetico.generado_ok', {
    sesion_id: ctx.sesion_id,
    caso_id: persisted.id,
    numero_caso,
    cajas_objetivo: input.cajas_objetivo,
  });

  return {
    ok: true,
    caso_id: persisted.id,
    numero_caso,
    caso: casoGenerado,
    cajas_objetivo: input.cajas_objetivo,
  };
}

// ===========================================================================
// Prompt builders
// ===========================================================================

function buildGeneradorPrompt(
  input: SolicitarCasoSinteticoInput,
  casosUsados: number
): string {
  return [
    `Sonnet está solicitando un caso sintético para destrabar las siguientes cajas: ${input.cajas_objetivo.join(', ')}.`,
    `Hipótesis a clausurar (lo que Sonnet leyó del entrevistado y necesita confirmar): ${input.hipotesis_a_clausurar}`,
    `Urgencia: ${input.urgencia}.`,
    `Casos usados en la sesión hasta ahora: ${casosUsados} de ${CAP_CASOS_SINTETICOS_POR_SESION}.`,
    '',
    'Genera UN caso sintético siguiendo el contrato del system prompt. El output debe pasar el schema CasoSintetico (cajas_objetivo debe matchear el input + decision_esperada_por_tipo con al menos 2 entradas divergentes para que haya boundary real).',
  ].join('\n');
}

function buildValidadorPrompt(
  caso: CasoSintetico,
  input: SolicitarCasoSinteticoInput
): string {
  return [
    `Caso a validar (output del generador):`,
    JSON.stringify(caso, null, 2),
    '',
    `Cajas objetivo declaradas por Sonnet: ${input.cajas_objetivo.join(', ')}.`,
    `Hipótesis a clausurar: ${input.hipotesis_a_clausurar}.`,
    '',
    'Valida según el contrato del system prompt. Devuelve { "pasa": boolean, "razones_falla": string[] }. Si pasa=true, razones_falla puede ser []. Si pasa=false, lista al menos 1 razón concreta apuntando a la regla violada.',
  ].join('\n');
}
