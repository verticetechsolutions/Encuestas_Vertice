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

// Cold-start buffer (bug O1 STT — doc bugs-encontrados-2026-05-11-stt §O1).
// Antes: el MediaRecorder arrancaba al `socket.open` (~200-400ms después del
// click del mic). Audio dicho durante esa ventana se perdía → "Estoy
// probando" se truncaba a "probando".
// Ahora: el recorder arranca al click. Mientras el socket conecta, los
// chunks se buffearean in-memory. Al `socket.open` drenamos en orden y
// switcheamos a send directo. BUFFER_MAX_CHUNKS acota memoria (10s a 250ms
// = 40 chunks); si el socket tarda más, dropeamos los más antiguos. Pérdida
// preferible a OOM.
export const BUFFER_MAX_CHUNKS = 40;
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

/**
 * Drena el buffer de chunks pre-socket-open al socket en orden FIFO.
 *
 * Decisión: pure helper exportado para test unitario. Mutación in-place del
 * array es deliberada — los useRef arrays compartidos no admiten reasignación
 * desde fuera del hook. Si sendMedia throws, dejamos el resto del buffer
 * intacto para que la siguiente vuelta del retry loop lo intente de nuevo.
 *
 * @returns número de chunks enviados exitosamente.
 */
export function drainBufferToSocket(
  buffer: Blob[],
  socket: { sendMedia: (data: Blob) => void }
): number {
  let sent = 0;
  while (buffer.length > 0) {
    const chunk = buffer[0]; // peek
    try {
      socket.sendMedia(chunk);
      buffer.shift(); // consume only after success
      sent += 1;
    } catch {
      // Socket murió mid-drain. Dejamos el resto para el siguiente reintento.
      return sent;
    }
  }
  return sent;
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
  // SDK v5+ retorna el V1Socket en estado `startClosed: true` deliberadamente.
  // El caller tiene que llamar `connect()` después de registrar handlers para
  // que el ReconnectingWebSocket interno corra `reconnect()` y abra el ws real.
  connect(): DeepgramSocketHandle;
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
  // socketOpenRef: true entre `on('open')` y `on('close')`. La ondataavailable
  // del recorder decide buffer-vs-send-directo según este flag SIN tener que
  // re-asignarse, evitando una clase de bugs por re-wireado fuera de orden.
  const socketOpenRef = useRef<boolean>(false);
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
  // Buffer de chunks audio capturados antes de socket.open (cold-start fix).
  // Drenado FIFO en el handler `on('open')` antes de switchear a live mode.
  const bufferedChunksRef = useRef<Blob[]>([]);

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
    socketOpenRef.current = false;
    bufferedChunksRef.current.length = 0;
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
        // Browser WebSocket no soporta headers custom; Deepgram acepta el JWT
        // via subprotocol ['bearer', token]. El SDK pasa este array al
        // constructor `new WebSocket(url, protocols)`. Sin esto el handshake
        // cierra con code 1006 (auth no entregada).
        protocols: ['bearer', token],
        // Defer reconnect logic to our own retry loop so we can refresh the JWT.
        reconnectAttempts: 0,
      })) as unknown as DeepgramSocketHandle;
      return socket;
    },
    [],
  );

  /**
   * Single ondataavailable handler que decide buffer vs send-directo según
   * `socketOpenRef`. Set una vez al start; no se re-asigna por estado, lo
   * cual elimina la clase de bugs por re-wireado fuera de orden.
   *
   * - Si el socket NO está open: encola en `bufferedChunksRef` (cap acotado).
   * - Si el socket está open: drena buffer pendiente (defensivo) y envía live.
   */
  const installRecorderHandler = useCallback(
    (recorder: MediaRecorder) => {
      recorder.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        const sock = socketRef.current;
        if (sock && socketOpenRef.current) {
          // Live mode.
          if (bufferedChunksRef.current.length > 0) {
            // Defensa: si quedó algo del cold-start (e.g. open llegó entre
            // chunks), drenamos antes para preservar orden.
            drainBufferToSocket(bufferedChunksRef.current, sock);
          }
          try {
            sock.sendMedia(ev.data);
            lastAudioAtRef.current = Date.now();
            if (pauseDetected) setPauseDetected(false);
          } catch {
            // Socket pudo cerrarse mid-chunk; el close handler dispara retry.
          }
          return;
        }
        // Cold-start mode: bufferear con cap acotado.
        const buf = bufferedChunksRef.current;
        buf.push(ev.data);
        while (buf.length > BUFFER_MAX_CHUNKS) {
          // Drop oldest — connecting tomó demasiado, prioritizamos memory.
          buf.shift();
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
    // Reset flag al inicio del nuevo intento — si veníamos de retry, debe estar false.
    socketOpenRef.current = false;

    socket.on('open', () => {
      retryCountRef.current = 0;
      setStatus('streaming');
      // Drenar el buffer cold-start ANTES de marcar live. Preserva orden FIFO
      // del audio dicho entre el click del mic y socket.open. drainBufferToSocket
      // es defensivo a sendMedia throws (deja el resto del buffer para próximo
      // intento). El handler unificado fija socketOpenRef en true después.
      const sock = socketRef.current;
      if (sock && bufferedChunksRef.current.length > 0) {
        drainBufferToSocket(bufferedChunksRef.current, sock);
      }
      socketOpenRef.current = true;
      startPauseTimer();
    });

    socket.on('message', (msg: unknown) => {
      handleResult(msg as DeepgramResultMessage);
    });

    socket.on('close', () => {
      socketRef.current = null;
      socketOpenRef.current = false;
      // En retry, el recorder se queda CORRIENDO. Chunks que vengan caen al
      // buffer cold-start (handler unificado detecta !socketOpenRef). Cuando
      // el nuevo socket abra, drena el buffer y continúa. Antes parábamos el
      // recorder aquí — perdíamos audio entre desconexión y reconexión, peor
      // que el cold-start original.
      if (!stoppedByUserRef.current) scheduleRetry(boot);
    });

    socket.on('error', () => {
      // Let the close handler drive the retry — error fires before close.
    });

    // SDK v5+: el V1Socket viene `startClosed: true` por diseño del wrapper
    // `createWebSocketConnection` (deepgram/sdk/dist/.../ws.mjs:343). Hay que
    // disparar `connect()` explícitamente DESPUÉS de registrar handlers para
    // que ReconnectingWebSocket llame `reconnect()` y abra el ws real. Sin
    // esto, `_connect()` retorna early en la primera línea (porque
    // `_shouldReconnect` es false) y nunca se construye el WebSocket.
    socket.connect();
  }, [handleResult, openSocket, scheduleRetry, startPauseTimer]);

  const start = useCallback(async (): Promise<void> => {
    if (status === 'streaming' || status === 'connecting' || status === 'requesting_mic') {
      return;
    }
    setError(null);
    setTranscripts({ interim: '', final: '', history: [] });
    setPauseDetected(false);
    stoppedByUserRef.current = false;
    retryCountRef.current = 0;
    // Reset estado de buffer/socket — nueva sesión de captura.
    bufferedChunksRef.current.length = 0;
    socketOpenRef.current = false;

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

    // FIX cold-start: instalar el handler ANTES de start() y arrancar AHORA,
    // sin esperar al socket. Chunks dichos antes del socket.open caen al
    // buffer in-memory y se drenan al abrir. Doc bugs-encontrados-2026-05-11-stt §O1.
    installRecorderHandler(recorder);
    try {
      recorder.start(AUDIO_CHUNK_MS);
    } catch (err) {
      // Track muerto antes del start (raro pero posible). Limpieza + error.
      teardown();
      setStatus('error');
      setError(
        err instanceof Error
          ? `No pudimos iniciar la grabación: ${err.message}`
          : 'No pudimos iniciar la grabación.'
      );
      return;
    }

    try {
      await boot();
    } catch (err) {
      // Initial connect failure — try the retry path so the user gets the same
      // behavior as a mid-stream drop. El recorder sigue corriendo y bufferea
      // chunks hasta que el retry conecte (o se agote MAX_RETRIES y teardown).
      const message = err instanceof Error ? err.message : 'connect_failed';
      setError(`No pudimos conectar con el servicio de voz: ${message}`);
      scheduleRetry(boot);
    }
  }, [boot, installRecorderHandler, scheduleRetry, status, teardown]);

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
