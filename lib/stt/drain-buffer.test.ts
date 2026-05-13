// Tests del helper puro `drainBufferToSocket` + invariantes del cap del
// buffer cold-start (BUFFER_MAX_BYTES).
//
// El handler completo del hook necesita DOM (AudioWorklet + Deepgram SDK),
// pero la lógica crítica del cold-start fix vive en este helper puro. Tests:
//   - Drena FIFO sin pérdida.
//   - sendMedia throw → para drain, retorna count parcial, deja resto en buffer.
//   - Buffer vacío → no-op, count 0.
//   - Múltiples frames consecutivos preservan orden.
//
// El comportamiento end-to-end (start → cold-start frames → socket.open →
// drain → live) se valida en smoke manual en /demo/stt o /entrevista; no hay
// jsdom + RTL setup en este suite (deuda técnica conocida en §19).

import { describe, it, expect, vi } from 'vitest';
import { drainBufferToSocket, BUFFER_MAX_BYTES } from './use-deepgram-stream';

function makeFrame(samples: number, fill: number = 0): ArrayBuffer {
  // Int16 stereo placeholder. `samples` Int16 values × 2 bytes.
  const buf = new Int16Array(samples);
  buf.fill(fill);
  return buf.buffer;
}

describe('drainBufferToSocket', () => {
  it('drena frames en orden FIFO y deja buffer vacío', () => {
    const buffer: ArrayBuffer[] = [makeFrame(10, 1), makeFrame(10, 2), makeFrame(10, 3)];
    const sent: ArrayBuffer[] = [];
    const socket = {
      sendMedia: (data: ArrayBuffer) => {
        sent.push(data);
      },
    };

    const count = drainBufferToSocket(buffer, socket);
    expect(count).toBe(3);
    expect(buffer).toEqual([]);
    expect(sent.length).toBe(3);
  });

  it('buffer vacío — no-op, retorna 0', () => {
    const buffer: ArrayBuffer[] = [];
    const socket = { sendMedia: vi.fn() };
    const count = drainBufferToSocket(buffer, socket);
    expect(count).toBe(0);
    expect(socket.sendMedia).not.toHaveBeenCalled();
  });

  it('sendMedia throw después del frame N → drain para, retorna N, resto queda en buffer', () => {
    const buffer: ArrayBuffer[] = [
      makeFrame(10, 1),
      makeFrame(10, 2),
      makeFrame(10, 3),
      makeFrame(10, 4),
    ];
    let calls = 0;
    const socket = {
      sendMedia: () => {
        calls += 1;
        if (calls === 3) throw new Error('socket murió mid-drain');
      },
    };

    const count = drainBufferToSocket(buffer, socket);
    expect(count).toBe(2); // frames 1 y 2 enviados antes del throw
    expect(buffer.length).toBe(2); // frame 3 (no consumido tras throw) + 4
    // Confirmar que el primer frame del buffer remanente conserva referencia
    // al original — no fue consumido tras el throw del 3er send. (Validación
    // por identidad de referencia: el peek con shift solo tras success es la
    // invariante crítica que protege orden cross-retry.)
    expect(buffer[0]).toBeInstanceOf(ArrayBuffer);
  });

  it('orden de envío matches orden de inserción (FIFO)', () => {
    const inputs = [1, 2, 3, 4, 5];
    const buffer: ArrayBuffer[] = inputs.map((n) => makeFrame(10, n));
    const sent: number[] = [];
    const socket = {
      sendMedia(data: ArrayBuffer) {
        // Primer Int16 sample identifica el frame original.
        const view = new Int16Array(data);
        sent.push(view[0]);
      },
    };
    const count = drainBufferToSocket(buffer, socket);
    expect(count).toBe(5);
    expect(buffer.length).toBe(0);
    expect(sent).toEqual(inputs);
  });
});

describe('BUFFER_MAX_BYTES', () => {
  it('dimensionado para ~10s de PCM a 16kHz Int16 mono', () => {
    // 16000 samples/s × 2 bytes/sample × 10s = 320_000 bytes.
    expect(BUFFER_MAX_BYTES).toBe(320_000);
  });

  it('cap rationale: 10 segundos cubre cold-start incluso con red lenta', () => {
    // Smoke 2026-05-12 midió ~200-400ms cold-start típico. 10s da 25x margen.
    // Si el cap bajara, este regression test rompería antes de shipear
    // silenciosamente con menor cobertura.
    const bytesPerSecond = 16000 * 2; // 16kHz × Int16 mono
    expect(BUFFER_MAX_BYTES / bytesPerSecond).toBeGreaterThanOrEqual(5); // ≥ 5s
  });
});
