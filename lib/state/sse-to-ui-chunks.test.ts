// Tests del converter sseBytesToUIChunks (regression guard para bug F2).
//
// Bug F2 (doc bugs-encontrados-2026-05-11-e2e §F2): pasar `res.body`
// (ReadableStream<Uint8Array>) directo a `readUIMessageStream` crashea
// con "Cannot read properties of undefined (reading 'startsWith')". El fix
// es interponer `parseJsonEventStream(uiMessageChunkSchema)` para parsear
// los bytes SSE a UIMessageChunk objects.
//
// Cobertura:
//   - Happy path: SSE válido con chunks (start, text-delta, finish) → objetos.
//   - Múltiples eventos consecutivos preservan orden.
//   - Chunk con shape inválido contra el schema → throw al leer.
//   - JSON malformado → throw al leer.
//   - SSE event con boundary partido entre chunks de bytes → reensambla OK.

import { describe, it, expect } from 'vitest';
import { sseBytesToUIChunks } from './sse-to-ui-chunks';
import type { UIMessageChunk } from 'ai';

// Helper para serializar un objeto UIMessageChunk a SSE wire format.
// Formato: `data: <json>\n\n` (líneas terminadas con \n y separadas por \n\n).
function encodeSseEvent(payload: unknown): Uint8Array {
  const json = JSON.stringify(payload);
  return new TextEncoder().encode(`data: ${json}\n\n`);
}

function buildSseStream(events: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
}

async function drainChunks(
  stream: ReadableStream<UIMessageChunk>
): Promise<UIMessageChunk[]> {
  const out: UIMessageChunk[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) out.push(value);
  }
  return out;
}

describe('sseBytesToUIChunks', () => {
  it('parsea un SSE event válido (text-start) a UIMessageChunk objeto', async () => {
    const chunk: UIMessageChunk = {
      type: 'text-start',
      id: 'text-0',
    };
    const sse = buildSseStream([encodeSseEvent(chunk)]);
    const out = await drainChunks(sseBytesToUIChunks(sse));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'text-start', id: 'text-0' });
  });

  it('preserva orden de múltiples eventos consecutivos', async () => {
    const events: UIMessageChunk[] = [
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', delta: 'hola' },
      { type: 'text-delta', id: 'text-0', delta: ' mundo' },
      { type: 'text-end', id: 'text-0' },
    ];
    const sse = buildSseStream(events.map(encodeSseEvent));
    const out = await drainChunks(sseBytesToUIChunks(sse));
    expect(out).toHaveLength(4);
    expect(out.map((c) => c.type)).toEqual([
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
    ]);
  });

  it('chunk con shape inválido contra el schema → throw al leer', async () => {
    const bogus = new TextEncoder().encode(
      `data: ${JSON.stringify({ type: 'no-such-chunk-type', random: 'data' })}\n\n`
    );
    const sse = buildSseStream([bogus]);
    await expect(drainChunks(sseBytesToUIChunks(sse))).rejects.toBeInstanceOf(Error);
  });

  it('JSON malformado → throw al leer', async () => {
    const bogus = new TextEncoder().encode(`data: {not valid json}\n\n`);
    const sse = buildSseStream([bogus]);
    await expect(drainChunks(sseBytesToUIChunks(sse))).rejects.toBeInstanceOf(Error);
  });

  it('SSE event partido entre chunks de bytes se reensambla y parsea OK', async () => {
    // Simula el caso real del transport: un evento llega en 2 paquetes TCP.
    const json = JSON.stringify({ type: 'text-delta', id: 'text-0', delta: 'partial' });
    const full = `data: ${json}\n\n`;
    const half = full.length >>> 1;
    const part1 = new TextEncoder().encode(full.slice(0, half));
    const part2 = new TextEncoder().encode(full.slice(half));
    const sse = buildSseStream([part1, part2]);
    const out = await drainChunks(sseBytesToUIChunks(sse));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'text-delta', delta: 'partial' });
  });

  it('stream vacío (cerrado sin events) → 0 chunks, sin throw', async () => {
    const empty = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const out = await drainChunks(sseBytesToUIChunks(empty));
    expect(out).toEqual([]);
  });

  it('regression guard: NO depender de un schema "loose" — chunks tienen types canónicos del SDK', async () => {
    // Si el SDK cambia el schema y los chunks dejan de matchear, este test
    // explota antes de shipping silenciosamente. Lista de tipos que el motor
    // realmente emite hoy:
    const tiposEmitidosPorElMotor = [
      'start',
      'start-step',
      'text-start',
      'text-delta',
      'text-end',
      'tool-input-start',
      'tool-input-delta',
      'tool-input-available',
      'tool-output-available',
      'finish-step',
      'finish',
    ];
    // Construimos un SSE plausible (no necesariamente válido para todos los
    // chunks — solo text-* + finish para garantizar que la lista no se rompe).
    const events: UIMessageChunk[] = [
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 'text-0' },
      { type: 'text-delta', id: 'text-0', delta: 'x' },
      { type: 'text-end', id: 'text-0' },
      { type: 'finish-step' },
      { type: 'finish' },
    ];
    const sse = buildSseStream(events.map(encodeSseEvent));
    const out = await drainChunks(sseBytesToUIChunks(sse));
    expect(out.length).toBe(7);
    for (const t of out.map((c) => c.type)) {
      expect(tiposEmitidosPorElMotor).toContain(t);
    }
  });
});
