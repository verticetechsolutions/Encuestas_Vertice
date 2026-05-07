// Mock LanguageModel V3 para tests E2E del motor conversacional (Phase 5).
//
// Reemplaza al provider Anthropic real (`@ai-sdk/anthropic`) en tests donde
// queremos simular Sonnet 4.6 con tool-calls scriptados turno-a-turno. Resuelve
// el bloqueo "ANTHROPIC_API_KEY vacío" para suites E2E sin perder fidelidad
// del wire format del AI SDK v6 (LanguageModelV3StreamPart).
//
// Uso típico:
//
//   const model = createMockSonnet([
//     { toolCalls: [{ toolName: 'registrar_extraccion', input: {...} }] },
//     { toolCalls: [{ toolName: 'solicitar_review_seccion', input: {...} }] },
//     { text: 'Listo. Cierro la sección.' }, // finishReason='stop'
//   ]);
//
//   const result = streamText({ model, tools, messages: [...] });
//   await result.consumeStream();
//
// Cada `TurnScript` consume una invocación de `doStream` (un "step" del SDK).
// Si el script tiene tool-calls, el SDK los ejecuta, agrega los tool-results
// al historial, y vuelve a invocar `doStream` para el siguiente step. Loop
// termina cuando: (a) el siguiente script tiene `finishReason='stop'` y solo
// texto sin tool-calls, o (b) se agotan los scripts (lanza error).

import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import type {
  LanguageModelV3,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

// LanguageModelV3FinishReason.unified — shape interno V3. La API de usuario
// de streamText sigue siendo el string plano (mapeo automático del SDK).
type FinishReasonUnified =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other';

// =============================================================================
// Tipos públicos
// =============================================================================

export interface ScriptedToolCall {
  /** Debe matchear el name de un tool registrado en `streamText({ tools })`. */
  toolName: string;
  /** Input del tool. Se serializa con JSON.stringify para emitir tool-call. */
  input: unknown;
  /**
   * toolCallId opcional. Si se omite, se autogenera por (turn_idx, tool_name).
   * Útil overrideearlo solo si el test verifica un ID específico.
   */
  toolCallId?: string;
}

export interface TurnScript {
  /** Tool-calls que el modelo emite este step. Default: ninguno. */
  toolCalls?: ScriptedToolCall[];
  /** Texto que el modelo emite este step (text-start/delta/end). */
  text?: string;
  /**
   * Override de finishReason (la versión "unified" string). Default:
   * 'tool-calls' si hay toolCalls, 'stop' si no. Útil para forzar 'stop'
   * cuando hay toolCalls (raro, pero soportado).
   */
  finishReason?: FinishReasonUnified;
  /**
   * Tokens reportados al SDK como números planos. El helper los empaqueta en
   * la shape V3 ({ total, ... }). Default: input=100, output=50.
   */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface MockSonnetOptions {
  /** Identificador del provider para errores legibles. Default: 'mock-sonnet'. */
  provider?: string;
  /** modelId reportado al SDK. Default: 'mock-claude-sonnet-4-6'. */
  modelId?: string;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Crea un MockLanguageModelV3 que consume los scripts en orden. Cada vez que
 * `streamText` invoca `doStream` (un "step"), saca el siguiente TurnScript y
 * emite los chunks V3 correspondientes.
 *
 * Si el SDK pide más steps de los scriptados, el modelo arroja un error con
 * el índice — diagnóstico claro en tests donde el loop no termina como
 * esperabas.
 */
export function createMockSonnet(
  turns: TurnScript[],
  opts: MockSonnetOptions = {}
): LanguageModelV3 {
  let stepIdx = 0;

  return new MockLanguageModelV3({
    provider: opts.provider ?? 'mock-sonnet',
    modelId: opts.modelId ?? 'mock-claude-sonnet-4-6',
    doStream: async () => {
      const idx = stepIdx++;
      const script = turns[idx];
      if (!script) {
        throw new Error(
          `MockSonnet: el SDK pidió un step ${idx + 1} pero solo hay ${turns.length} scripts. ` +
            `Asegúrate de que el último script no tenga toolCalls (force finishReason='stop').`
        );
      }

      const chunks: LanguageModelV3StreamPart[] = [
        { type: 'stream-start', warnings: [] },
      ];

      if (script.text) {
        const id = `mock-text-${idx}`;
        chunks.push({ type: 'text-start', id });
        chunks.push({ type: 'text-delta', id, delta: script.text });
        chunks.push({ type: 'text-end', id });
      }

      for (const tc of script.toolCalls ?? []) {
        const tcId = tc.toolCallId ?? `mock-tc-${idx}-${tc.toolName}`;
        const inputJson = JSON.stringify(tc.input);
        chunks.push({ type: 'tool-input-start', id: tcId, toolName: tc.toolName });
        chunks.push({ type: 'tool-input-delta', id: tcId, delta: inputJson });
        chunks.push({ type: 'tool-input-end', id: tcId });
        chunks.push({
          type: 'tool-call',
          toolCallId: tcId,
          toolName: tc.toolName,
          input: inputJson,
        });
      }

      const unified: FinishReasonUnified =
        script.finishReason ??
        ((script.toolCalls?.length ?? 0) > 0 ? 'tool-calls' : 'stop');

      const inputTokens = script.usage?.inputTokens ?? 100;
      const outputTokens = script.usage?.outputTokens ?? 50;
      chunks.push({
        type: 'finish',
        finishReason: { unified, raw: undefined },
        usage: {
          inputTokens: {
            total: inputTokens,
            noCache: inputTokens,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: outputTokens,
            text: outputTokens,
            reasoning: undefined,
          },
        },
      });

      return {
        stream: simulateReadableStream({ chunks }),
      };
    },
  });
}
