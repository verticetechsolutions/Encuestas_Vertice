'use client';

// React hook for Deepgram streaming STT with the cemented Nova-3 config.
//
// Lifecycle: idle → requesting_mic → connecting → streaming → (idle|error)
//
// Owns three resources that must shut down together: the `MediaStream`
// (mic), the `MediaRecorder` (audio chunker), and the Deepgram websocket.
// `stop()` and the unmount cleanup both call the same teardown.
//
// Pause detection: we track the timestamp of the last audio chunk shipped
// to Deepgram. If >1.5s elapses without one (mic muted, user stopped
// talking, etc.) we flip `pauseDetected` so the caller can decide whether
// to treat it as a turn boundary.
//
// Reconnect: on unexpected websocket close the hook does up to 3 retries
// with exponential backoff (500ms → 1s → 2s), each refreshing the JWT
// because the prior one may have expired. After 3 failures we surface
// `status='error'` and the caller decides whether to call `start()` again.
//
// Diarization: Deepgram returns `speaker` per word. We assume one speaker
// per result (the dominant one) and store it on each segment. The MVP
// only listens to the subdirector, but conserving the metadata costs
// nothing and lets a later flow handle two-person interviews.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DeepgramClient } from '@deepgram/sdk';
import { STT_LIVE_CONFIG } from './client';

export type SttStatus = 'idle' | 'requesting_mic' | 'connecting' | 'streaming' | 'error';

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: number | null;
  start_sec: number;
  end_sec: number;
  confidence: number;
  corregida_manualmente: boolean;
}

export interface TranscriptState {
  /** Last interim (non-final) transcript — preview only, render in muted color. */
  interim: string;
  /** Last finalized transcript text — committable. */
  final: string;
  /** All finalized segments in order. */
  history: TranscriptSegment[];
}

export interface UseDeepgramStreamReturn {
  status: SttStatus;
  error: string | null;
  transcripts: TranscriptState;
  /** True after >1.5s without an audio chunk being shipped. Resets on next chunk. */
  pauseDetected: boolean;
  start: () => Promise<void>;
  stop: () => void;
  /** Replace a finalized segment's text and flag it as manually corrected. */
  editSegment: (id: string, newText: string) => void;
}

const PAUSE_MS = 1500;
const PAUSE_TICK_MS = 250;
const MAX_RETRIES = 3;
const AUDIO_CHUNK_MS = 250;
const MIC_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para continuar.',
  NotFoundError:
    'No encontramos un micrófono. Conecta uno y vuelve a intentar.',
  NotReadableError:
    'El micrófono está en uso por otra aplicación. Ciérrala y vuelve a intentar.',
  OverconstrainedError:
    'La configuración de audio solicitada no es compatible con tu micrófono.',
  SecurityError:
    'El navegador bloqueó el acceso al micrófono. Verifica que estés en HTTPS o localhost.',
};

interface DeepgramResultMessage {
  type: string;
  is_final?: boolean;
  start?: number;
  duration?: number;
  channel?: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{ word: string; start: number; end: number; speaker?: number }>;
    }>;
  };
}

function classifyMicError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name && MIC_ERROR_MESSAGES[name]) return MIC_ERROR_MESSAGES[name];
  return 'No pudimos abrir el micrófono. Recarga la página y vuelve a intentar.';
}

function pickSpeaker(
  words: Array<{ speaker?: number }> | undefined,
): number | null {
  if (!words || words.length === 0) return null;
  // Pick the modal speaker across the words. If diarize is off, undefined.
  const counts = new Map<number, number>();
  for (const w of words) {
    if (w.speaker === undefined) continue;
    counts.set(w.speaker, (counts.get(w.speaker) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: number | null = null;
  let bestCount = -1;
  for (const [s, c] of counts) {
    if (c > bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return best;
}

async function fetchEphemeralToken(): Promise<string> {
  const res = await fetch('/api/stt/token', { method: 'POST' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `token_fetch_${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function pickAudioMimeType(): string {
  // Browsers vary; webm/opus is the broadest. Safari 14+ ships MediaRecorder
  // but only `audio/mp4`. Fall back rather than throw — Deepgram autodetects.
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

// SDK's V1Socket type isn't part of the top-level export. We type the handle
// with the methods we actually call so we don't depend on the internal path.
interface DeepgramSocketHandle {
  on(event: 'open', cb: () => void): void;
  on(event: 'message', cb: (msg: unknown) => void): void;
  on(event: 'close', cb: (event: { code?: number; reason?: string }) => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  sendMedia(data: ArrayBuffer | Blob | ArrayBufferView): void;
  close(): void;
}

export function useDeepgramStream(): UseDeepgramStreamReturn {
  const [status, setStatus] = useState<SttStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptState>({
    interim: '',
    final: '',
    history: [],
  });
  const [pauseDetected, setPauseDetected] = useState(false);

  const socketRef = useRef<DeepgramSocketHandle | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAudioAtRef = useRef<number>(0);
  const pauseTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  // Tracks intent so an unexpected close vs a user-initiated close diverge.
  const stoppedByUserRef = useRef<boolean>(false);
  const retryTimerRef = useRef<number | null>(null);
  const segmentCounterRef = useRef<number>(0);
  // Pause-while-tab-hidden support.
  const recorderWasRunningOnHideRef = useRef<boolean>(false);

  const teardown = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } catch {
        // Recorder may already be in a terminal state.
      }
      recorderRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // Already closed.
      }
      socketRef.current = null;
    }
  }, []);

  const handleResult = useCallback((msg: DeepgramResultMessage) => {
    if (msg.type !== 'Results') return;
    const alt = msg.channel?.alternatives?.[0];
    if (!alt) return;
    const text = alt.transcript;
    if (!text) return;
    const speaker = pickSpeaker(alt.words);
    const startSec = msg.start ?? 0;
    const endSec = startSec + (msg.duration ?? 0);

    if (msg.is_final) {
      segmentCounterRef.current += 1;
      const seg: TranscriptSegment = {
        id: `seg-${segmentCounterRef.current}`,
        text,
        speaker,
        start_sec: startSec,
        end_sec: endSec,
        confidence: alt.confidence,
        corregida_manualmente: false,
      };
      setTranscripts((prev) => ({
        interim: '',
        final: text,
        history: [...prev.history, seg],
      }));
    } else {
      setTranscripts((prev) => ({ ...prev, interim: text }));
    }
  }, []);

  const openSocket = useCallback(
    async (token: string): Promise<DeepgramSocketHandle> => {
      const dg = new DeepgramClient({ accessToken: () => token });
      const socket = (await dg.listen.v1.connect({
        ...STT_LIVE_CONFIG,
        Authorization: `Bearer ${token}`,
        // Defer reconnect logic to our own retry loop so we can refresh the JWT.
        reconnectAttempts: 0,
      })) as unknown as DeepgramSocketHandle;
      return socket;
    },
    [],
  );

  const wireRecorderToSocket = useCallback(
    (recorder: MediaRecorder, socket: DeepgramSocketHandle) => {
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          try {
            socket.sendMedia(ev.data);
            lastAudioAtRef.current = Date.now();
            if (pauseDetected) setPauseDetected(false);
          } catch {
            // Socket may have closed mid-chunk; the close handler will retry.
          }
        }
      };
    },
    [pauseDetected],
  );

  const startPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) return;
    lastAudioAtRef.current = Date.now();
    pauseTimerRef.current = window.setInterval(() => {
      if (Date.now() - lastAudioAtRef.current > PAUSE_MS) {
        setPauseDetected((prev) => (prev ? prev : true));
      }
    }, PAUSE_TICK_MS);
  }, []);

  const scheduleRetry = useCallback(
    (boot: () => Promise<void>) => {
      if (stoppedByUserRef.current) return;
      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus('error');
        setError('Conexión interrumpida. Vuelve a presionar el micrófono para reintentar.');
        teardown();
        return;
      }
      const attempt = retryCountRef.current;
      retryCountRef.current += 1;
      const delay = 500 * 2 ** attempt; // 500, 1000, 2000
      retryTimerRef.current = window.setTimeout(() => {
        boot().catch(() => scheduleRetry(boot));
      }, delay);
    },
    [teardown],
  );

  const boot = useCallback(async (): Promise<void> => {
    setStatus('connecting');
    const token = await fetchEphemeralToken();
    const socket = await openSocket(token);
    socketRef.current = socket;

    socket.on('open', () => {
      retryCountRef.current = 0;
      setStatus('streaming');
      if (recorderRef.current && recorderRef.current.state === 'inactive') {
        recorderRef.current.start(AUDIO_CHUNK_MS);
      }
      startPauseTimer();
    });

    socket.on('message', (msg: unknown) => {
      handleResult(msg as DeepgramResultMessage);
    });

    socket.on('close', () => {
      socketRef.current = null;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // already stopped
        }
      }
      if (!stoppedByUserRef.current) scheduleRetry(boot);
    });

    socket.on('error', () => {
      // Let the close handler drive the retry — error fires before close.
    });

    if (recorderRef.current && socketRef.current) {
      wireRecorderToSocket(recorderRef.current, socketRef.current);
    }
  }, [handleResult, openSocket, scheduleRetry, startPauseTimer, wireRecorderToSocket]);

  const start = useCallback(async (): Promise<void> => {
    if (status === 'streaming' || status === 'connecting' || status === 'requesting_mic') {
      return;
    }
    setError(null);
    setTranscripts({ interim: '', final: '', history: [] });
    setPauseDetected(false);
    stoppedByUserRef.current = false;
    retryCountRef.current = 0;

    setStatus('requesting_mic');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus('error');
      setError(classifyMicError(err));
      return;
    }
    streamRef.current = stream;

    const mimeType = pickAudioMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;

    try {
      await boot();
    } catch (err) {
      // Initial connect failure — try the retry path so the user gets the same
      // behavior as a mid-stream drop.
      const message = err instanceof Error ? err.message : 'connect_failed';
      setError(`No pudimos conectar con el servicio de voz: ${message}`);
      scheduleRetry(boot);
    }
  }, [boot, scheduleRetry, status]);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    teardown();
    setStatus('idle');
    setPauseDetected(false);
  }, [teardown]);

  const editSegment = useCallback((id: string, newText: string) => {
    setTranscripts((prev) => ({
      ...prev,
      history: prev.history.map((s) =>
        s.id === id ? { ...s, text: newText, corregida_manualmente: true } : s,
      ),
    }));
  }, []);

  // Pause stream when tab loses focus; resume when it returns.
  useEffect(() => {
    const onVisibilityChange = (): void => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      if (document.hidden) {
        if (recorder.state === 'recording') {
          recorderWasRunningOnHideRef.current = true;
          try {
            recorder.pause();
          } catch {
            // Recorder might be inactive already.
          }
        }
      } else if (recorderWasRunningOnHideRef.current) {
        recorderWasRunningOnHideRef.current = false;
        if (recorder.state === 'paused') {
          try {
            recorder.resume();
            lastAudioAtRef.current = Date.now();
          } catch {
            // Resume may fail if the underlying track was stopped.
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true;
      teardown();
    };
  }, [teardown]);

  return {
    status,
    error,
    transcripts,
    pauseDetected,
    start,
    stop,
    editSegment,
  };
}
