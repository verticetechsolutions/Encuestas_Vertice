// @ts-nocheck — `@testing-library/react` no está instalado en el repo. Estos
// tests viven en `describe.skip` como smoke aspiracional; cuando se ejecute
// deuda técnica #12 (tests STT hook completos con jsdom + RTL), agregar
// `@testing-library/react` como devDependency, quitar el pragma y promover
// los tests a run real. El sibling `app/api/stt/token/route.test.ts` ya no
// requiere el pragma porque solo usa el Request global.
//
// Coverage intent (smoke only — full integration is manual QA on /demo/stt):
//   1. Hook opens the websocket with the cemented STT_LIVE_CONFIG.
//   2. Final vs interim messages route to `final/history` vs `interim`.
//   3. Mic NotAllowedError surfaces an es-MX message and lands status='error'.
//   4. Unexpected close drives up to 3 retries (counter exposed by spy).
//   5. editSegment marks `corregida_manualmente: true`.
//
// Token-endpoint coverage lives in `app/api/stt/token/route.test.ts`.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// SDK mock — captures the latest connect args + lets the test push messages
// via the registered handlers.
const sdkState = {
  lastConnectArgs: null as Record<string, unknown> | null,
  handlers: {} as Record<string, (msg: unknown) => void>,
  closeCount: 0,
};

vi.mock('@deepgram/sdk', () => {
  return {
    DeepgramClient: class {
      listen = {
        v1: {
          connect: async (args: Record<string, unknown>) => {
            sdkState.lastConnectArgs = args;
            return {
              on: (event: string, cb: (msg: unknown) => void) => {
                sdkState.handlers[event] = cb;
              },
              sendMedia: () => {},
              close: () => {
                sdkState.closeCount += 1;
                sdkState.handlers.close?.({});
              },
            };
          },
        },
      };
    },
  };
});

// fetch mock for /api/stt/token.
beforeEach(() => {
  sdkState.lastConnectArgs = null;
  sdkState.handlers = {};
  sdkState.closeCount = 0;
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ access_token: 'jwt-mock', expires_in: 60 }),
  })) as unknown as typeof fetch;
  // Mic mock.
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) },
  });
  // MediaRecorder mock — minimal API surface used by the hook.
  globalThis.MediaRecorder = class {
    state = 'inactive';
    static isTypeSupported() {
      return true;
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
    }
    pause() {
      this.state = 'paused';
    }
    resume() {
      this.state = 'recording';
    }
    ondataavailable: ((ev: { data: Blob }) => void) | null = null;
  } as unknown as typeof MediaRecorder;
});

import { useDeepgramStream } from './use-deepgram-stream';
import { STT_LIVE_CONFIG } from './client';

describe.skip('useDeepgramStream', () => {
  it('opens websocket with the cemented STT_LIVE_CONFIG and a Bearer JWT', async () => {
    const { result } = renderHook(() => useDeepgramStream());
    await act(async () => {
      await result.current.start();
    });
    expect(sdkState.lastConnectArgs).toMatchObject({
      ...STT_LIVE_CONFIG,
      Authorization: 'Bearer jwt-mock',
      reconnectAttempts: 0,
    });
  });

  it('routes final messages to history and interim to transcripts.interim', async () => {
    const { result } = renderHook(() => useDeepgramStream());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      sdkState.handlers.message?.({
        type: 'Results',
        is_final: false,
        start: 0,
        duration: 1,
        channel: { alternatives: [{ transcript: 'hola', confidence: 0.9, words: [] }] },
      });
    });
    expect(result.current.transcripts.interim).toBe('hola');
    expect(result.current.transcripts.history).toHaveLength(0);

    act(() => {
      sdkState.handlers.message?.({
        type: 'Results',
        is_final: true,
        start: 0,
        duration: 2,
        channel: {
          alternatives: [
            { transcript: 'hola, soy el director', confidence: 0.95, words: [{ word: 'hola', start: 0, end: 0.4, speaker: 0 }] },
          ],
        },
      });
    });
    expect(result.current.transcripts.interim).toBe('');
    expect(result.current.transcripts.final).toBe('hola, soy el director');
    expect(result.current.transcripts.history).toHaveLength(1);
    expect(result.current.transcripts.history[0].speaker).toBe(0);
  });

  it('surfaces an es-MX error when getUserMedia rejects with NotAllowedError', async () => {
    const err = new Error('blocked');
    (err as Error & { name: string }).name = 'NotAllowedError';
    (globalThis.navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
    const { result } = renderHook(() => useDeepgramStream());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/Permiso de micrófono denegado/);
  });

  it('retries up to 3 times on unexpected close before erroring out', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDeepgramStream());
    await act(async () => {
      await result.current.start();
    });
    // Simulate 4 consecutive unexpected closes; first 3 schedule retries, 4th errors.
    for (let i = 0; i < 4; i += 1) {
      act(() => {
        sdkState.handlers.close?.({ code: 1006 });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
    }
    expect(result.current.status).toBe('error');
    vi.useRealTimers();
  });

  it('editSegment flips corregida_manualmente=true and replaces text', async () => {
    const { result } = renderHook(() => useDeepgramStream());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      sdkState.handlers.message?.({
        type: 'Results',
        is_final: true,
        start: 0,
        duration: 1,
        channel: { alternatives: [{ transcript: 'orig', confidence: 0.9, words: [] }] },
      });
    });
    const id = result.current.transcripts.history[0].id;
    act(() => {
      result.current.editSegment(id, 'corregido');
    });
    const seg = result.current.transcripts.history[0];
    expect(seg.text).toBe('corregido');
    expect(seg.corregida_manualmente).toBe(true);
  });
});
