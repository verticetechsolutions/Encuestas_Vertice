'use client';

// React hook for Deepgram streaming STT — production-grade.
//
// Lifecycle: idle → requesting_mic → connecting → streaming → (idle|reconnecting|error)
//   Reconnecting es estado distinto a connecting: ya hubo open previo, ahora
//   se está restaurando (mejor UX que mostrar "connecting" otra vez).
//
// Owns: MediaStream (mic), MediaRecorder (chunker), Deepgram WS, AudioContext
// (level meter), KeepAlive timer, Pause timer, Retry timer, Long-recording
// auto-stop timer. `stop()` y unmount cleanup llaman al mismo teardown.
//
// Production-grade features (CTO audit 2026-05-12):
//   - KeepAlive cada 8s: previene cierre por timeout idle de Deepgram (~10-12s).
//   - sendFinalize antes de close: no perdemos la última palabra dictada.
//   - Audio constraints: echoCancellation + noiseSuppression + AGC para WER.
//   - track.onended: detecta bluetooth disconnect / permission revoke mid-stream.
//   - Cold-start buffer FIFO (max 10s) — chunks pre-socket-open se preservan.
//   - Retry con jitter (500ms-2s + ±20% jitter) hasta 3 intentos.
//   - Hard cap 30min recording + warning a los 25 — anti-runaway.
//   - AudioContext level meter (RMS 0-1) para feedback visual.
//   - Telemetry estructurada: time_to_open, time_to_first_transcript, reconnects.
//   - Errores categorizados: token, permission, device, network, codec, idle.
//   - visibilitychange: pausa recorder cuando tab está oculta; iOS Safari friendly.
//
// Auth: el browser usa JWT del endpoint /api/stt/token (mintea cada start o retry).
// Audio NUNCA toca nuestro server — va directo browser → Deepgram WS.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DeepgramClient } from '@deepgram/sdk';
import {
  STT_AUDIO_CONSTRAINTS,
  STT_FINALIZE_GRACE_MS,
  STT_KEEPALIVE_INTERVAL_MS,
  STT_LIVE_CONFIG,
  STT_MAX_RECORDING_MS,
  STT_WARN_LONG_RECORDING_MS,
} from './client';

export type SttStatus =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'error';

// Error category: drive UX messaging + telemetry filtering. Genérico string
// para que el caller pueda mostrar mensaje contextual (e.g. botón "Habilitar
// micrófono" cuando es permission, vs "Reintentar" cuando es network).
export type SttErrorCode =
  | 'permission_denied' // user dijo no al prompt o bloqueó en config
  | 'permission_revoked' // se concedió pero luego se revocó mid-stream
  | 'no_microphone' // sistema no tiene mic
  | 'mic_in_use' // otra app usa el mic
  | 'mic_overconstrained' // el constraint pedido no es soportado
  | 'insecure_context' // no HTTPS/localhost
  | 'codec_unsupported' // MediaRecorder no soporta ningún mime que aceptemos
  | 'token_fetch_failed' // /api/stt/token devolvió error
  | 'token_rate_limited' // 429 del endpoint
  | 'connect_failed' // primer connect del WS falló
  | 'network_unstable' // reconnects agotados (3 retries)
  | 'session_too_long' // hit hard cap 30min
  | 'unknown';

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

export interface SttMetrics {
  /** ms desde click mic hasta primer chunk de audio recibido por Deepgram (open). */
  timeToOpenMs: number | null;
  /** ms desde click mic hasta primer interim/final transcript recibido. */
  timeToFirstTranscriptMs: number | null;
  /** Total de reconexiones en esta sesión de captura (reset en cada start()). */
  reconnects: number;
  /** Total de KeepAlive enviados. */
  keepAlivesSent: number;
  /** Total de segmentos finalizados recibidos. */
  finalsReceived: number;
}

export interface UseDeepgramStreamReturn {
  status: SttStatus;
  error: string | null;
  /** Categoría del último error (drive UX contextual). null si no hubo error. */
  errorCode: SttErrorCode | null;
  transcripts: TranscriptState;
  /** True después de >1.5s sin audio shipping. Resets en siguiente chunk. */
  pauseDetected: boolean;
  /**
   * Nivel de audio normalizado 0-1 (RMS smoothed). 0 silencio, ~0.5 voz normal,
   * 1 saturación. Útil para waveform/meter UI. Solo se computa mientras streaming.
   */
  audioLevel: number;
  /** Warning visible cuando la grabación pasa 25 min (faltan 5 para auto-stop). */
  longRecordingWarning: boolean;
  /** Métricas para observabilidad. */
  metrics: SttMetrics;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Replace a finalized segment's text and flag it as manually corrected. */
  editSegment: (id: string, newText: string) => void;
}

const PAUSE_MS = 1500;
const PAUSE_TICK_MS = 250;
const MAX_RETRIES = 3;
const AUDIO_CHUNK_MS = 250;

// Cold-start buffer (bug O1 STT — doc bugs-encontrados-2026-05-11-stt §O1).
// El recorder arranca al click; mientras el socket conecta los chunks bufferean
// in-memory y se drenan al `socket.open` en orden FIFO. BUFFER_MAX_CHUNKS acota
// memoria (10s a 250ms = 40 chunks).
export const BUFFER_MAX_CHUNKS = 40;

const MIC_ERROR_INFO: Record<string, { code: SttErrorCode; message: string }> = {
  NotAllowedError: {
    code: 'permission_denied',
    message:
      'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para continuar.',
  },
  NotFoundError: {
    code: 'no_microphone',
    message: 'No encontramos un micrófono. Conecta uno y vuelve a intentar.',
  },
  NotReadableError: {
    code: 'mic_in_use',
    message:
      'El micrófono está en uso por otra aplicación. Ciérrala y vuelve a intentar.',
  },
  OverconstrainedError: {
    code: 'mic_overconstrained',
    message:
      'La configuración de audio solicitada no es compatible con tu micrófono.',
  },
  SecurityError: {
    code: 'insecure_context',
    message:
      'El navegador bloqueó el acceso al micrófono. Verifica que estés en HTTPS o localhost.',
  },
  AbortError: {
    code: 'permission_revoked',
    message: 'El acceso al micrófono se interrumpió. Reintenta para reconectar.',
  },
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

function classifyMicError(err: unknown): { code: SttErrorCode; message: string } {
  const name = (err as { name?: string } | null)?.name;
  if (name && MIC_ERROR_INFO[name]) return MIC_ERROR_INFO[name];
  return {
    code: 'unknown',
    message: 'No pudimos abrir el micrófono. Recarga la página y vuelve a intentar.',
  };
}

function pickSpeaker(
  words: Array<{ speaker?: number }> | undefined,
): number | null {
  if (!words || words.length === 0) return null;
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
    const err = new Error(body.error ?? `token_fetch_${res.status}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Drena el buffer de chunks pre-socket-open al socket en orden FIFO.
 *
 * Pure helper exportado para test. Mutación in-place del array es deliberada —
 * los useRef arrays compartidos no admiten reasignación desde fuera del hook.
 * Si sendMedia throws, dejamos el resto del buffer intacto para que la
 * siguiente vuelta del retry loop lo intente de nuevo.
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
      return sent;
    }
  }
  return sent;
}

function pickAudioMimeType(): string {
  // Browsers vary; webm/opus es lo más eficiente. Safari 14.5+ ship solo
  // `audio/mp4`. Si ninguno soporta MediaRecorder, devolvemos '' y dejamos
  // a Deepgram autodetectar. iOS Safari < 14.5 no tiene MediaRecorder en
  // absoluto — el caller debe verificar `typeof MediaRecorder` antes.
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

interface DeepgramSocketHandle {
  on(event: 'open', cb: () => void): void;
  on(event: 'message', cb: (msg: unknown) => void): void;
  on(event: 'close', cb: (event: { code?: number; reason?: string }) => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  sendMedia(data: ArrayBuffer | Blob | ArrayBufferView): void;
  /** Envía un KeepAlive — previene timeout idle (~10s) del lado Deepgram. */
  sendKeepAlive(payload: { type: 'KeepAlive' }): void;
  /** Solicita el último is_final pendiente antes de close. No cierra el socket. */
  sendFinalize(payload: { type: 'Finalize' }): void;
  close(): void;
  // SDK v5+ retorna el V1Socket en estado `startClosed: true` deliberadamente.
  // El caller tiene que llamar `connect()` después de registrar handlers para
  // que el ReconnectingWebSocket interno corra `reconnect()` y abra el ws real.
  connect(): DeepgramSocketHandle;
}

export function useDeepgramStream(): UseDeepgramStreamReturn {
  const [status, setStatus] = useState<SttStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SttErrorCode | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptState>({
    interim: '',
    final: '',
    history: [],
  });
  const [pauseDetected, setPauseDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [longRecordingWarning, setLongRecordingWarning] = useState(false);
  const [metrics, setMetrics] = useState<SttMetrics>({
    timeToOpenMs: null,
    timeToFirstTranscriptMs: null,
    reconnects: 0,
    keepAlivesSent: 0,
    finalsReceived: 0,
  });

  const socketRef = useRef<DeepgramSocketHandle | null>(null);
  // socketOpenRef: true entre `on('open')` y `on('close')`. La ondataavailable
  // del recorder decide buffer-vs-send-directo según este flag SIN tener que
  // re-asignarse, evitando una clase de bugs por re-wireado fuera de orden.
  const socketOpenRef = useRef<boolean>(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAudioAtRef = useRef<number>(0);
  const pauseTimerRef = useRef<number | null>(null);
  const keepAliveTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  // Tracks intent: un unexpected close vs un user-initiated close divergen.
  const stoppedByUserRef = useRef<boolean>(false);
  const retryTimerRef = useRef<number | null>(null);
  const segmentCounterRef = useRef<number>(0);
  const recorderWasRunningOnHideRef = useRef<boolean>(false);
  const bufferedChunksRef = useRef<Blob[]>([]);
  // AudioContext + Analyser para level meter. Lazy: creados al primer start
  // (iOS Safari requiere gesture). Reusados en starts subsiguientes.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  // Telemetría: timestamps por sesión de captura. Reset en start().
  const startedAtRef = useRef<number>(0);
  const firstOpenAtRef = useRef<number>(0);
  const firstTranscriptAtRef = useRef<number>(0);
  // Tracker del max recording auto-stop.
  const maxRecordingTimerRef = useRef<number | null>(null);
  const warnRecordingTimerRef = useRef<number | null>(null);

  const teardown = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (keepAliveTimerRef.current !== null) {
      window.clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (maxRecordingTimerRef.current !== null) {
      window.clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
    if (warnRecordingTimerRef.current !== null) {
      window.clearTimeout(warnRecordingTimerRef.current);
      warnRecordingTimerRef.current = null;
    }
    if (levelRafRef.current !== null) {
      window.cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } catch {
        // Recorder puede estar en estado terminal.
      }
      recorderRef.current = null;
    }
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      audioSourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      analyserRef.current = null;
    }
    // AudioContext NO se cierra — keep para reuso (iOS overhead).
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
    setAudioLevel(0);
    setLongRecordingWarning(false);
  }, []);

  const handleResult = useCallback((msg: DeepgramResultMessage) => {
    if (msg.type !== 'Results') return;
    const alt = msg.channel?.alternatives?.[0];
    if (!alt) return;
    const text = alt.transcript;
    if (!text) return;

    // Telemetría: time to first transcript (interim o final, lo que llegue primero).
    if (firstTranscriptAtRef.current === 0 && startedAtRef.current > 0) {
      firstTranscriptAtRef.current = Date.now();
      setMetrics((m) => ({
        ...m,
        timeToFirstTranscriptMs: firstTranscriptAtRef.current - startedAtRef.current,
      }));
    }

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
      setMetrics((m) => ({ ...m, finalsReceived: m.finalsReceived + 1 }));
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
          buf.shift(); // drop oldest
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

  /**
   * KeepAlive timer: envía `{type: "KeepAlive"}` cada 8s mientras el socket
   * esté abierto. Sin esto, Deepgram cierra el WS tras ~10-12s de silencio
   * (cuando el user está pensando sin dictar) y entramos en retry loop
   * espurio. Doc: https://developers.deepgram.com/docs/keepalive
   */
  const startKeepAliveTimer = useCallback(() => {
    if (keepAliveTimerRef.current !== null) return;
    keepAliveTimerRef.current = window.setInterval(() => {
      const sock = socketRef.current;
      if (!sock || !socketOpenRef.current) return;
      try {
        sock.sendKeepAlive({ type: 'KeepAlive' });
        setMetrics((m) => ({ ...m, keepAlivesSent: m.keepAlivesSent + 1 }));
      } catch {
        // Si falla, el close handler reiniciará el flujo.
      }
    }, STT_KEEPALIVE_INTERVAL_MS);
  }, []);

  /**
   * Tick del AudioContext analyser: lee RMS de la stream y publica audioLevel
   * en 0-1. Usa rAF para no saturar React renders. Solo corre mientras streaming.
   */
  const startAudioLevelMeter = useCallback((stream: MediaStream) => {
    // iOS Safari: AudioContext requiere user gesture en mobile. start() YA
    // viene de un click handler así que es seguro instanciar.
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      // iOS suspende el context si no hay gesture reciente — resume defensivo.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // No-fail: si no podemos resume, simplemente no hay meter.
        });
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioSourceRef.current = source;
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        // RMS sobre el waveform centrado en 128 (uint8 → -1..+1).
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Scale: voz típica ~0.05-0.2 RMS. Multiplicamos por 3 para que el
        // meter llegue a ~0.5-0.6 con voz normal y reserve headroom para gritos.
        setAudioLevel(Math.min(1, rms * 3));
        levelRafRef.current = window.requestAnimationFrame(tick);
      };
      levelRafRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Si AudioContext falla por cualquier razón, el meter queda en 0 — no
      // afecta la grabación. No-fail explícito.
    }
  }, []);

  const scheduleRetry = useCallback(
    (boot: () => Promise<void>) => {
      if (stoppedByUserRef.current) return;
      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus('error');
        setError(
          'Conexión interrumpida tras varios intentos. Vuelve a presionar el micrófono.'
        );
        setErrorCode('network_unstable');
        teardown();
        return;
      }
      const attempt = retryCountRef.current;
      retryCountRef.current += 1;
      setMetrics((m) => ({ ...m, reconnects: m.reconnects + 1 }));
      setStatus('reconnecting');
      // Backoff exponencial 500 → 1000 → 2000 ms, con jitter ±20% para
      // desincronizar reconnects masivos (thundering herd si el WS server hiccup).
      const base = 500 * 2 ** attempt;
      const jitter = base * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.max(100, Math.round(base + jitter));
      retryTimerRef.current = window.setTimeout(() => {
        boot().catch(() => scheduleRetry(boot));
      }, delay);
    },
    [teardown],
  );

  const boot = useCallback(async (): Promise<void> => {
    setStatus(retryCountRef.current === 0 ? 'connecting' : 'reconnecting');
    let token: string;
    try {
      token = await fetchEphemeralToken();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        setError('Demasiados intentos. Espera unos segundos y reintenta.');
        setErrorCode('token_rate_limited');
      } else {
        setError(
          err instanceof Error
            ? `No pudimos obtener autorización para el micrófono: ${err.message}`
            : 'No pudimos obtener autorización para el micrófono.'
        );
        setErrorCode('token_fetch_failed');
      }
      throw err;
    }

    const socket = await openSocket(token);
    socketRef.current = socket;
    socketOpenRef.current = false;

    socket.on('open', () => {
      retryCountRef.current = 0;
      setStatus('streaming');
      setError(null);
      setErrorCode(null);
      // Telemetría: time to first open (solo en primer open, no retries).
      if (firstOpenAtRef.current === 0 && startedAtRef.current > 0) {
        firstOpenAtRef.current = Date.now();
        setMetrics((m) => ({
          ...m,
          timeToOpenMs: firstOpenAtRef.current - startedAtRef.current,
        }));
      }
      // Drenar el buffer cold-start ANTES de marcar live. Preserva orden FIFO.
      const sock = socketRef.current;
      if (sock && bufferedChunksRef.current.length > 0) {
        drainBufferToSocket(bufferedChunksRef.current, sock);
      }
      socketOpenRef.current = true;
      startPauseTimer();
      startKeepAliveTimer();
    });

    socket.on('message', (msg: unknown) => {
      handleResult(msg as DeepgramResultMessage);
    });

    socket.on('close', () => {
      socketRef.current = null;
      socketOpenRef.current = false;
      if (keepAliveTimerRef.current !== null) {
        window.clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
      // En retry, el recorder se queda CORRIENDO. Chunks que vengan caen al
      // buffer cold-start. Cuando el nuevo socket abra, drena el buffer y continúa.
      if (!stoppedByUserRef.current) scheduleRetry(boot);
    });

    socket.on('error', () => {
      // Let the close handler drive the retry — error fires before close.
    });

    // SDK v5+: el V1Socket viene `startClosed: true` por diseño. Hay que
    // disparar `connect()` explícitamente DESPUÉS de registrar handlers.
    socket.connect();
  }, [
    handleResult,
    openSocket,
    scheduleRetry,
    startKeepAliveTimer,
    startPauseTimer,
  ]);

  const start = useCallback(async (): Promise<void> => {
    if (status === 'streaming' || status === 'connecting' || status === 'requesting_mic') {
      return;
    }
    setError(null);
    setErrorCode(null);
    setTranscripts({ interim: '', final: '', history: [] });
    setPauseDetected(false);
    setAudioLevel(0);
    setLongRecordingWarning(false);
    setMetrics({
      timeToOpenMs: null,
      timeToFirstTranscriptMs: null,
      reconnects: 0,
      keepAlivesSent: 0,
      finalsReceived: 0,
    });
    stoppedByUserRef.current = false;
    retryCountRef.current = 0;
    bufferedChunksRef.current.length = 0;
    socketOpenRef.current = false;
    firstOpenAtRef.current = 0;
    firstTranscriptAtRef.current = 0;
    startedAtRef.current = Date.now();

    setStatus('requesting_mic');
    let stream: MediaStream;
    try {
      // Audio constraints profesionales: EC + NS + AGC + mono + 16kHz.
      // Browsers que no soporten constraint específico lo ignoran (no throw).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: STT_AUDIO_CONSTRAINTS,
      });
    } catch (err) {
      const info = classifyMicError(err);
      setStatus('error');
      setError(info.message);
      setErrorCode(info.code);
      return;
    }
    streamRef.current = stream;

    // Listener para track ended: detecta bluetooth disconnect, OS revoke,
    // user click "stop sharing" en el browser permission UI. Sin esto, el
    // recorder seguiría grabando silencio o fallaría silenciosamente.
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) {
      setStatus('error');
      setError('No se obtuvo pista de audio del micrófono.');
      setErrorCode('no_microphone');
      teardown();
      return;
    }
    tracks[0].onended = () => {
      // Mid-stream device loss: trato como error terminal (no es retry de WS).
      if (stoppedByUserRef.current) return;
      setStatus('error');
      setError('El micrófono se desconectó. Reintenta para reconectar.');
      setErrorCode('permission_revoked');
      teardown();
    };

    const mimeType = pickAudioMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error
          ? `Tu navegador no puede grabar audio: ${err.message}`
          : 'Tu navegador no puede grabar audio en un formato compatible.'
      );
      setErrorCode('codec_unsupported');
      teardown();
      return;
    }
    recorderRef.current = recorder;

    // FIX cold-start: instalar handler ANTES de start() y arrancar AHORA,
    // sin esperar al socket. Chunks dichos antes del socket.open caen al
    // buffer in-memory y se drenan al abrir.
    installRecorderHandler(recorder);
    try {
      recorder.start(AUDIO_CHUNK_MS);
    } catch (err) {
      teardown();
      setStatus('error');
      setError(
        err instanceof Error
          ? `No pudimos iniciar la grabación: ${err.message}`
          : 'No pudimos iniciar la grabación.'
      );
      setErrorCode('unknown');
      return;
    }

    // Audio level meter (UX): no-fail si falla.
    startAudioLevelMeter(stream);

    // Hard cap 30min + warning 25min — anti-runaway.
    warnRecordingTimerRef.current = window.setTimeout(() => {
      setLongRecordingWarning(true);
    }, STT_WARN_LONG_RECORDING_MS);
    maxRecordingTimerRef.current = window.setTimeout(() => {
      setStatus('error');
      setError(
        'Grabación detenida automáticamente tras 30 minutos. Vuelve a presionar el micrófono para continuar.'
      );
      setErrorCode('session_too_long');
      void stopInternal({ skipFinalize: false });
    }, STT_MAX_RECORDING_MS);

    try {
      await boot();
    } catch (err) {
      // Initial connect failure: el recorder sigue corriendo y bufferea
      // chunks hasta que el retry conecte (o se agote MAX_RETRIES y teardown).
      const message = err instanceof Error ? err.message : 'connect_failed';
      // No piso errorCode si boot ya lo setteó (token errors).
      if (!errorCode) {
        setError(`No pudimos conectar con el servicio de voz: ${message}`);
        setErrorCode('connect_failed');
      }
      scheduleRetry(boot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    boot,
    installRecorderHandler,
    scheduleRetry,
    startAudioLevelMeter,
    status,
    teardown,
  ]);

  /**
   * Stop interno con opción de skip Finalize. user-initiated stop hace Finalize
   * + grace; auto-stop por error puede saltearlo si quiere ser instantáneo.
   */
  const stopInternal = useCallback(
    async (opts: { skipFinalize: boolean }) => {
      stoppedByUserRef.current = true;
      const sock = socketRef.current;
      // Finalize + grace ANTES de close: pide a Deepgram que emita el último
      // is_final pendiente del audio ya enviado. Sin esto, podemos perder la
      // última palabra/frase dictada justo antes del stop.
      if (
        !opts.skipFinalize &&
        sock &&
        socketOpenRef.current
      ) {
        try {
          sock.sendFinalize({ type: 'Finalize' });
          await new Promise((r) => setTimeout(r, STT_FINALIZE_GRACE_MS));
        } catch {
          // Si falla, igual continuamos al teardown.
        }
      }
      teardown();
      setStatus('idle');
      setPauseDetected(false);
    },
    [teardown]
  );

  const stop = useCallback(async (): Promise<void> => {
    await stopInternal({ skipFinalize: false });
  }, [stopInternal]);

  const editSegment = useCallback((id: string, newText: string) => {
    setTranscripts((prev) => ({
      ...prev,
      history: prev.history.map((s) =>
        s.id === id ? { ...s, text: newText, corregida_manualmente: true } : s,
      ),
    }));
  }, []);

  // Pause stream when tab loses focus; resume when it returns. iOS Safari
  // friendly: suspende AudioContext si está activo, resume al volver.
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
            // iOS Safari: AudioContext queda suspendido al backgrounding;
            // resume defensivo para que el meter siga vivo.
            audioCtxRef.current?.resume().catch(() => {});
          } catch {
            // Resume may fail if the underlying track was stopped.
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Device change listener: si el user enchufa/desenchufa un mic (BT in/out,
  // USB), Chrome emite `devicechange`. NO reiniciamos automáticamente (puede
  // ser disruptivo si está mid-dictation), pero exponemos via metric futura.
  // Por ahora solo log para visibility.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const md = navigator.mediaDevices;
    const onDeviceChange = () => {
      // eslint-disable-next-line no-console
      console.debug('[stt] devicechange — audio devices changed');
    };
    md.addEventListener('devicechange', onDeviceChange);
    return () => md.removeEventListener('devicechange', onDeviceChange);
  }, []);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      stoppedByUserRef.current = true;
      teardown();
      // Close AudioContext en unmount (no en cada stop) — guarda recursos
      // pero permite reuso intra-component lifecycle.
      if (audioCtxRef.current) {
        try {
          void audioCtxRef.current.close();
        } catch {
          // Already closed.
        }
        audioCtxRef.current = null;
      }
    };
  }, [teardown]);

  return {
    status,
    error,
    errorCode,
    transcripts,
    pauseDetected,
    audioLevel,
    longRecordingWarning,
    metrics,
    start,
    stop,
    editSegment,
  };
}
