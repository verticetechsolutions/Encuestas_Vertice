// Smoke tests del helper `createMockSonnet`.
//
// Verifica que el helper produce chunks V3 que `streamText` consume sin
// errores: text-start/delta/end, tool-input-*/tool-call, finish con usage.
// El test E2E completo del motor vive en `conversation.e2e.test.ts`.

import { describe, it, expect } from 'vitest';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

import { createMockSonnet } from './mock-sonnet';

describe('createMockSonnet', () => {
  it('emite un step de solo texto y resuelve finishReason=stop', async () => {
    const model = createMockSonnet([
      { text: 'Hola, soy el agente.' },
    ]);

    const result = streamText({ model, messages: [{ role: 'user', content: 'hi' }] });
    const finalText = await result.text;
    const finishReason = await result.finishReason;

    expect(finalText).toBe('Hola, soy el agente.');
    expect(finishReason).toBe('stop');
  });

  it('emite tool-call y el SDK ejecuta el tool con input parseado', async () => {
    const ECHO_INPUT = { caja_codigo: 'id_razon_social', valor: 'Banco Demo' };
    const executed: unknown[] = [];

    const model = createMockSonnet([
      {
        toolCalls: [{ toolName: 'echo', input: ECHO_INPUT }],
      },
      // Step 2: cierra el loop con texto. Sin esto el SDK pediría otro step
      // (porque step 1 finishReason='tool-calls') y el helper arrojaría.
      { text: 'OK.' },
    ]);

    const result = streamText({
      model,
      tools: {
        echo: tool({
          description: 'echo back the input',
          inputSchema: z.object({
            caja_codigo: z.string(),
            valor: z.string(),
          }),
          execute: async (input) => {
            executed.push(input);
            return { ok: true };
          },
        }),
      },
      messages: [{ role: 'user', content: 'echo' }],
      // Permite que el SDK ejecute el tool y haga un segundo step para el
      // texto final. Sin stopWhen, streamText usa default que no permite
      // multi-step automáticamente.
      stopWhen: stepCountIs(5),
    });
    await result.consumeStream();
    const finishReason = await result.finishReason;

    expect(executed).toEqual([ECHO_INPUT]);
    expect(finishReason).toBe('stop');
  });

  it('arroja error legible cuando se piden más steps de los scriptados', async () => {
    const model = createMockSonnet([
      // Solo 1 script con tool-calls. El SDK pedirá un 2do step para el final.
      {
        toolCalls: [{ toolName: 'noop', input: {} }],
      },
    ]);

    const errors: unknown[] = [];
    const result = streamText({
      model,
      tools: {
        noop: tool({
          description: 'noop',
          inputSchema: z.object({}),
          execute: async () => ({ ok: true }),
        }),
      },
      messages: [{ role: 'user', content: 'go' }],
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        errors.push(error);
      },
    });
    // consumeStream NO rechaza por default; el SDK captura el doStream throw y
    // lo enruta a onError. Verificamos el error vía la captura local.
    await result.consumeStream();

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toMatch(/MockSonnet|step/i);
  });

  it('respeta finishReason override aunque haya toolCalls', async () => {
    const model = createMockSonnet([
      {
        toolCalls: [{ toolName: 'noop', input: {} }],
        finishReason: 'stop',
      },
    ]);

    const result = streamText({
      model,
      tools: {
        noop: tool({
          description: 'noop',
          inputSchema: z.object({}),
          execute: async () => ({ ok: true }),
        }),
      },
      messages: [{ role: 'user', content: 'go' }],
    });
    await result.consumeStream();

    expect(await result.finishReason).toBe('stop');
  });

  it('reporta usage al SDK (verificable vía totalUsage)', async () => {
    const model = createMockSonnet([
      {
        text: 'fin',
        usage: { inputTokens: 200, outputTokens: 80 },
      },
    ]);
    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'fin' }],
    });
    await result.consumeStream();
    const usage = await result.totalUsage;

    // El SDK v6 expone totalUsage como números planos derivados del shape V3
    // anidado (inputTokens.total, outputTokens.total).
    expect(usage.inputTokens).toBe(200);
    expect(usage.outputTokens).toBe(80);
  });
});
