'use client';

// React hook for Deepgram streaming STT — production-grade.
//
// Lifecycle: idle → requesting_mic → connecting → streaming → (idle|reconnecting|error)
//   Reconnecting es estado distinto a connecting: ya hubo open previo, ahora
//   se está restaurando (mejor UX que mostrar "connecting" otra vez).
//
// Owns: MediaStream (mic), AudioContext + AudioWorkletNode (PCM streamer +
// level meter), Deepgram WS, KeepAlive timer, Pause timer, Retry timer,
// Long-recording auto-stop timer. `stop()` y unmount cleanup llaman al
// mismo teardown.
//
// Production-grade features (CTO audit 2026-05-12, AudioWorklet migration 2026-05-13):
//   - AudioWorklet `pcm-processor` emite Int16 PCM @ 16kHz directo (NO Opus/WebM):
//     elimina el buffering interno de MediaRecorder + container muxing (~100-300ms
//     menos latency hasta el primer transcript).
//   - KeepAlive cada 8s: previene cierre por timeout idle de Deepgram (~10-12s).
//   - sendFinalize antes de close: no perdemos la última palabra dictada.
//   - Audio constraints: echoCancellation + noiseSuppression + AGC para WER.
//   - track.onended: detecta bluetooth disconnect / permission revoke mid-stream.
//   - Cold-start buffer FIFO (cap por bytes ≈ 10s) — frames pre-socket-open se preservan.
//   - Retry con jitter (500ms-2s + ±20% jitter) hasta 3 intentos.
//   - Hard cap 30min recording + warning a los 25 — anti-runaway.
//   - AudioContext analyser (RMS 0-1) para feedback visual del nivel de mic.
//   - Telemetry estructurada: time_to_open, time_to_first_transcript, reconnects.
//   - Errores categorizados: token, permission, device, network, codec, idle.
//   - visibilitychange: suspende AudioContext cuando tab está oculta; iOS Safari friendly.
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
import { playStartChime, playStopChime } from './chime';

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

/**
 * Token pre-minteado en el Server Component que sirve la página de entrevista.
 * Permite saltarse el POST `/api/stt/token` en el PRIMER start() — el endpoint
 * cuesta ~200-400ms por CSRF + DB SELECT + Deepgram grant. Si el user clickea
 * el mic dentro de los ~55s del page load, ese roundtrip se elide. Después se
 * consume y los siguientes start() fetchean normal.
 */
export interface InitialSttToken {
  /** JWT crudo que el browser pasa via subprotocol `['bearer', value]`. */
  value: string;
  /** Unix ms cuando el token expira en Deepgram. Hook verifica antes de usar. */
  expiresAt: number;
}

export interface UseDeepgramStreamOptions {
  /** Token pre-minteado por el RSC. null si el grant falló server-side. */
  initialToken?: InitialSttToken | null;
  /**
   * Si true Y `navigator.permissions.query({name:'microphone'})` reporta
   * 'granted', el hook adquiere el MediaStream del mic al MOUNT del componente
   * (no al click). El primer click reusa ese stream y saltea getUserMedia
   * (~100-300ms shaved del path crítico). Trade-off: el indicador "mic activo"
   * del browser aparece apenas el componente monta, antes de dictar. Apropiado
   * solo en pantallas claramente identificadas como "sala de entrevista". Si
   * permission es 'prompt' o 'denied', no hace nada (no triggear prompt sin
   * gesture). Default: false.
   */
  prewarmMicOnMount?: boolean;
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
  /**
   * True cuando el peak del audioLevel sobre los últimos 4s cae en la banda
   * "señal débil" — el user está produciendo sonido pero por debajo del nivel
   * que Deepgram transcribe bien. Self-clear cuando el user habla más fuerte
   * o cuando entra en silencio puro (pausa natural).
   */
  lowAudioWarning: boolean;
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
// Sample rate target. Match con el query param del STT_LIVE_CONFIG
// (encoding=linear16&sample_rate=16000) y con el constraint pedido al
// getUserMedia. El AudioWorklet downsample si el AudioContext no respetó
// el sampleRate solicitado (Chrome a menudo entrega 48000).
const STT_SAMPLE_RATE = 16000;

// Low-audio warning thresholds. audioLevel viene scaled 0-1 (raw RMS * 3).
// Voz normal cae en ~0.15-0.6; voz baja/whisper en ~0.04-0.12; silencio < 0.04.
// Si el peak del rolling window (LOW_AUDIO_WINDOW_MS) queda EN la banda de
// señal débil — ni silencio puro ni voz audible — el user probablemente está
// hablando muy bajo y disparamos el warning. Banda silencio queda fuera para
// no nag al user durante pausas naturales/pensamiento.
const LOW_AUDIO_SILENCE_FLOOR = 0.04;
const LOW_AUDIO_VOICE_THRESHOLD = 0.15;
const LOW_AUDIO_WINDOW_MS = 4000;
const LOW_AUDIO_CHECK_TICK_MS = 500;
const LOW_AUDIO_MIN_SAMPLES = 8;

// Cold-start buffer (bug O1 STT — doc bugs-encontrados-2026-05-11-stt §O1).
// El AudioWorklet arranca al click; mientras el socket conecta los frames PCM
// bufferean in-memory y se drenan al `socket.open` en orden FIFO.
// BUFFER_MAX_BYTES acota memoria por bytes en lugar de chunks porque el
// worklet emite a cadencia ~2.67ms (128 samples / 48kHz) en lugar de los
// 250ms del antiguo MediaRecorder. 16kHz × 2 bytes/sample × 10s = 320KB.
export const BUFFER_MAX_BYTES = 320_000;

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
  // 'Results' | 'SpeechStarted' | 'UtteranceEnd' | 'Metadata' | 'Error' | 'Warning'
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
  // VAD events (vad_events=true en STT_LIVE_CONFIG). `SpeechStarted` viene con
  // un timestamp en segundos desde el comienzo del stream; `UtteranceEnd` se
  // emite tras `utterance_end_ms` de silencio post-final. Solo usamos estos
  // mensajes para togglar `pauseDetected` (deuda #11 cerrada 2026-05-13).
  channel_index?: number[];
  last_word_end?: number;
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
 * Drena el buffer de frames PCM pre-socket-open al socket en orden FIFO.
 *
 * Pure helper exportado para test. Mutación in-place del array es deliberada —
 * los useRef arrays compartidos no admiten reasignación desde fuera del hook.
 * Si sendMedia throws, dejamos el resto del buffer intacto para que la
 * siguiente vuelta del retry loop lo intente de nuevo.
 *
 * @returns número de frames enviados exitosamente.
 */
export function drainBufferToSocket(
  buffer: ArrayBuffer[],
  socket: { sendMedia: (data: ArrayBuffer) => void }
): number {
  let sent = 0;
  while (buffer.length > 0) {
    const frame = buffer[0]; // peek
    try {
      socket.sendMedia(frame);
      buffer.shift(); // consume only after success
      sent += 1;
    } catch {
      return sent;
    }
  }
  return sent;
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

export function useDeepgramStream(
  opts: UseDeepgramStreamOptions = {},
): UseDeepgramStreamReturn {
  // Stash el initialToken en un ref para no re-disparar lógica en re-render
  // si el RSC re-emite el mismo token. Una vez consumido (primer start), se
  // pone a null para que siguientes starts fetcheen normal.
  const initialTokenRef = useRef<InitialSttToken | null>(opts.initialToken ?? null);
  // MediaStream pre-acquirido al mount (si prewarmMicOnMount + permission
  // granted). Consumido por el primer start(); null'd después para que el
  // siguiente start() haga getUserMedia normal.
  const prewarmedStreamRef = useRef<MediaStream | null>(null);
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
  const [lowAudioWarning, setLowAudioWarning] = useState(false);
  const [longRecordingWarning, setLongRecordingWarning] = useState(false);
  const [metrics, setMetrics] = useState<SttMetrics>({
    timeToOpenMs: null,
    timeToFirstTranscriptMs: null,
    reconnects: 0,
    keepAlivesSent: 0,
    finalsReceived: 0,
  });

  const socketRef = useRef<DeepgramSocketHandle | null>(null);
  // socketOpenRef: true entre `on('open')` y `on('close')`. El message handler
  // del AudioWorklet decide buffer-vs-send-directo según este flag SIN tener
  // que re-asignarse, evitando una clase de bugs por re-wireado fuera de orden.
  const socketOpenRef = useRef<boolean>(false);
  // AudioWorkletNode: corre el `pcm-processor` (public/stt/pcm-worklet.js) que
  // downsample a 16kHz y emite Int16 PCM via port.postMessage. Reemplaza al
  // MediaRecorder original (que añadía buffering interno + Opus encoding +
  // container muxing ≈ 100-300ms de latency antes del primer chunk).
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  // True una vez que `audioWorklet.addModule('/stt/pcm-worklet.js')` resolvió
  // exitosamente — el module load es one-shot por AudioContext y subsequente
  // calls retornan inmediatamente, pero evitamos race al primer start.
  const workletInstalledRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAudioAtRef = useRef<number>(0);
  const pauseTimerRef = useRef<number | null>(null);
  const keepAliveTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  // Tracks intent: un unexpected close vs un user-initiated close divergen.
  const stoppedByUserRef = useRef<boolean>(false);
  const retryTimerRef = useRef<number | null>(null);
  const segmentCounterRef = useRef<number>(0);
  // Tracks si el AudioContext estaba corriendo cuando la tab perdió foco —
  // en ese caso lo resumimos al volver.
  const wasRunningOnHideRef = useRef<boolean>(false);
  const bufferedChunksRef = useRef<ArrayBuffer[]>([]);
  // Bytes acumulados en el buffer cold-start. Cap por BUFFER_MAX_BYTES.
  const bufferedBytesRef = useRef<number>(0);
  // AudioContext + Analyser para level meter. Lazy: creados al primer start
  // (iOS Safari requiere gesture). Reusados en starts subsiguientes.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  // Rolling window de muestras de audioLevel para detección "habla más fuerte".
  // Push en cada tick del meter, prune entries fuera de LOW_AUDIO_WINDOW_MS.
  const audioLevelHistoryRef = useRef<Array<{ t: number; level: number }>>([]);
  const lowAudioCheckTimerRef = useRef<number | null>(null);
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
    if (lowAudioCheckTimerRef.current !== null) {
      window.clearInterval(lowAudioCheckTimerRef.current);
      lowAudioCheckTimerRef.current = null;
    }
    audioLevelHistoryRef.current.length = 0;
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      workletNodeRef.current = null;
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
    bufferedBytesRef.current = 0;
    // Suspender el AudioContext en teardown libera el hardware del mic en
    // browsers que lo respetan (Chrome >=120). El context se reusa al
    // siguiente start con `resume()` — más barato que crear uno nuevo.
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend().catch(() => undefined);
    }
    setAudioLevel(0);
    setLowAudioWarning(false);
    setLongRecordingWarning(false);
  }, []);

  const handleResult = useCallback((msg: DeepgramResultMessage) => {
    // VAD events del modo `vad_events=true` (STT_LIVE_CONFIG). Reemplazan el
    // polling sobre `lastAudioAtRef` que NUNCA disparaba via MediaRecorder
    // porque los frames PCM llegan cada ~2.67ms aunque el user no hable
    // (deuda #11 cerrada 2026-05-13). `SpeechStarted` = el modelo detectó
    // inicio real de habla; `UtteranceEnd` = pasaron `utterance_end_ms` de
    // silencio post-final (1000ms en config) y el utterance se cerró.
    if (msg.type === 'SpeechStarted') {
      setPauseDetected(false);
      return;
    }
    if (msg.type === 'UtteranceEnd') {
      setPauseDetected(true);
      return;
    }
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
   * Handler del `port.onmessage` del AudioWorklet. Cada frame PCM (Int16 ~2.67ms
   * a 48kHz, ~8ms a 16kHz) entra y se envía directo al socket o se bufferea
   * con cap por bytes si el WS no abrió todavía. Set una vez al start.
   */
  const installWorkletHandler = useCallback(
    (worklet: AudioWorkletNode) => {
      worklet.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
        const frame = ev.data;
        if (!frame || frame.byteLength === 0) return;
        const sock = socketRef.current;
        if (sock && socketOpenRef.current) {
          // Live mode.
          if (bufferedChunksRef.current.length > 0) {
            // Defensa: si quedó algo del cold-start (e.g. open llegó entre
            // frames), drenamos antes para preservar orden.
            drainBufferToSocket(bufferedChunksRef.current, sock);
            bufferedBytesRef.current = 0;
          }
          try {
            sock.sendMedia(frame);
            lastAudioAtRef.current = Date.now();
            if (pauseDetected) setPauseDetected(false);
          } catch {
            // Socket pudo cerrarse mid-frame; el close handler dispara retry.
          }
          return;
        }
        // Cold-start mode: bufferear con cap acotado en bytes.
        const buf = bufferedChunksRef.current;
        buf.push(frame);
        bufferedBytesRef.current += frame.byteLength;
        while (bufferedBytesRef.current > BUFFER_MAX_BYTES && buf.length > 0) {
          const dropped = buf.shift();
          if (dropped) bufferedBytesRef.current -= dropped.byteLength;
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
   * Detector de "habla más fuerte". Cada LOW_AUDIO_CHECK_TICK_MS computa el
   * peak del audioLevel sobre la ventana rodante LOW_AUDIO_WINDOW_MS. Si el
   * peak cae en la banda de señal débil (entre silencio puro y voz audible)
   * dispara el warning; auto-clear cuando el user habla más fuerte o se
   * queda en silencio puro (pausa natural).
   */
  const startLowAudioCheckTimer = useCallback(() => {
    if (lowAudioCheckTimerRef.current !== null) return;
    lowAudioCheckTimerRef.current = window.setInterval(() => {
      const hist = audioLevelHistoryRef.current;
      // Esperamos a tener suficientes muestras para evitar disparar en el
      // primer segundo donde el RMS apenas inicia a estabilizarse.
      if (hist.length < LOW_AUDIO_MIN_SAMPLES) return;
      let peak = 0;
      for (const sample of hist) {
        if (sample.level > peak) peak = sample.level;
      }
      // Zona débil = produciendo sonido pero no audible. Fuera de zona =
      // voz normal (>=threshold) o silencio puro (<floor) — no alertamos.
      const enZonaDebil =
        peak >= LOW_AUDIO_SILENCE_FLOOR && peak < LOW_AUDIO_VOICE_THRESHOLD;
      setLowAudioWarning((prev) => (prev === enZonaDebil ? prev : enZonaDebil));
    }, LOW_AUDIO_CHECK_TICK_MS);
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
   * Asegura AudioContext + MediaStreamSource compartidos por consumers
   * (worklet PCM + analyser de level meter). El context se reusa entre starts
   * (iOS Safari overhead al crear uno nuevo); la source es per-stream.
   * Retorna null si el browser no soporta AudioContext.
   */
  const ensureAudioGraph = useCallback(
    (stream: MediaStream): { ctx: AudioContext; source: MediaStreamAudioSourceNode } | null => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        // `latencyHint: 'interactive'` reduce el buffer interno del pipeline
        // (vs 'balanced' default que prioriza throughput). Match sampleRate
        // con STT_AUDIO_CONSTRAINTS para que el browser no resamplee el
        // stream del mic antes de entregárnoslo (evita ~10-30ms extra). Si
        // el AudioCtx no soporta sampleRate exacto, el browser lo ignora
        // silenciosamente y cae al default (típico 48000 en Chrome).
        audioCtxRef.current = new AudioCtx({
          latencyHint: 'interactive',
          sampleRate: STT_SAMPLE_RATE,
        });
      }
      const ctx = audioCtxRef.current;
      // iOS / teardown suspenden el context — resume defensivo.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }
      if (!audioSourceRef.current) {
        audioSourceRef.current = ctx.createMediaStreamSource(stream);
      }
      return { ctx, source: audioSourceRef.current };
    },
    [],
  );

  /**
   * Carga el AudioWorklet `pcm-processor` (one-shot por AudioContext), crea
   * el node, conecta a la source compartida, sink a un GainNode(0) para que
   * el grafo se mantenga activo (sin generar audio audible). El node emite
   * frames PCM Int16 via port.onmessage → installWorkletHandler.
   */
  const setupPcmWorklet = useCallback(
    async (stream: MediaStream): Promise<void> => {
      const graph = ensureAudioGraph(stream);
      if (!graph) {
        throw new Error('AudioContext no soportado por este browser.');
      }
      const { ctx, source } = graph;
      if (!workletInstalledRef.current) {
        await ctx.audioWorklet.addModule('/stt/pcm-worklet.js');
        workletInstalledRef.current = true;
      }
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      workletNodeRef.current = worklet;
      installWorkletHandler(worklet);
      source.connect(worklet);
      // Sink silencioso para mantener activo el grafo cross-browser. Gain=0
      // garantiza zero audio audible (sin echo en headphones).
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      worklet.connect(silentGain);
      silentGain.connect(ctx.destination);
    },
    [ensureAudioGraph, installWorkletHandler],
  );

  /**
   * Tick del AudioContext analyser: lee RMS de la stream y publica audioLevel
   * en 0-1. Usa rAF para no saturar React renders. Solo corre mientras streaming.
   */
  const startAudioLevelMeter = useCallback(
    (stream: MediaStream) => {
      const graph = ensureAudioGraph(stream);
      if (!graph) return;
      const { ctx, source } = graph;
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
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
          const scaled = Math.min(1, rms * 3);
          setAudioLevel(scaled);
          // Push al rolling window del low-audio detector. Prune entries viejos
          // (más antiguos que LOW_AUDIO_WINDOW_MS). Mantener el array compacto
          // evita memory leak en sesiones largas (rAF a 60fps × 30min = 108K).
          const now = Date.now();
          const hist = audioLevelHistoryRef.current;
          hist.push({ t: now, level: scaled });
          const cutoff = now - LOW_AUDIO_WINDOW_MS;
          while (hist.length > 0 && hist[0].t < cutoff) hist.shift();
          levelRafRef.current = window.requestAnimationFrame(tick);
        };
        levelRafRef.current = window.requestAnimationFrame(tick);
      } catch {
        // Si AudioContext falla por cualquier razón, el meter queda en 0 — no
        // afecta la grabación. No-fail explícito.
      }
    },
    [ensureAudioGraph],
  );

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

  // boot acepta un tokenPromise pre-flying para elidir la latencia del
  // POST /api/stt/token detrás de getUserMedia (ver `start`). Si no se pasa,
  // mintea uno fresco — ese camino lo usan los retries de scheduleRetry, que
  // necesitan token nuevo porque el original (60s TTL) puede haber caducado.
  const boot = useCallback(async (tokenPromise?: Promise<string>): Promise<void> => {
    setStatus(retryCountRef.current === 0 ? 'connecting' : 'reconnecting');
    let token: string;
    try {
      token = await (tokenPromise ?? fetchEphemeralToken());
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
      // isFirstOpen: distinguir primer open exitoso vs reconnects para que
      // (a) telemetría solo registre time_to_open la primera vez y (b) el
      // chime de inicio NO se replay en cada reconnect.
      const isFirstOpen = firstOpenAtRef.current === 0;
      setStatus('streaming');
      setError(null);
      setErrorCode(null);
      // Telemetría: time to first open (solo en primer open, no retries).
      if (isFirstOpen && startedAtRef.current > 0) {
        firstOpenAtRef.current = Date.now();
        setMetrics((m) => ({
          ...m,
          timeToOpenMs: firstOpenAtRef.current - startedAtRef.current,
        }));
      }
      // Chime de inicio: el user lo oye cuando el mic está REALMENTE activo
      // (audio fluyendo a Deepgram), no al clickear el botón. Antes vivía en
      // recorder.start() abajo, que es ~300-700ms antes del open del WS y
      // generaba la sensación de "se activó pero no transcribe".
      if (isFirstOpen) playStartChime();
      // Drenar el buffer cold-start ANTES de marcar live. Preserva orden FIFO.
      const sock = socketRef.current;
      if (sock && bufferedChunksRef.current.length > 0) {
        drainBufferToSocket(bufferedChunksRef.current, sock);
      }
      socketOpenRef.current = true;
      startPauseTimer();
      startKeepAliveTimer();
      startLowAudioCheckTimer();
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
    startLowAudioCheckTimer,
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
    setLowAudioWarning(false);
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
    bufferedBytesRef.current = 0;
    socketOpenRef.current = false;
    firstOpenAtRef.current = 0;
    firstTranscriptAtRef.current = 0;
    startedAtRef.current = Date.now();

    setStatus('requesting_mic');

    // Token resolution:
    //   1. Si el RSC pre-minteó un token y aún tiene >5s de vida, usarlo
    //      directamente (saca ~200-400ms del path crítico — primer click).
    //   2. Si no, lanzar fetchEphemeralToken EN PARALELO con getUserMedia.
    // El POST /api/stt/token (CSRF + DB SELECT + Deepgram grant) cuesta
    // ~150-400ms; getUserMedia ~10-100ms con mic ya autorizado, o 500-3000ms
    // en el primer permission prompt. Correrlos serialmente sumaba toda esa
    // latencia al click → streaming; en paralelo, el token queda listo (o
    // muy cerca) cuando el mic resuelve. Si getUserMedia falla, el token
    // se descarta (60s TTL caduca sin uso); el .catch silencia
    // unhandled-rejection en ese path de abandono.
    let tokenPromise: Promise<string>;
    const initial = initialTokenRef.current;
    if (initial && Date.now() < initial.expiresAt - 5_000) {
      tokenPromise = Promise.resolve(initial.value);
      // Consumir: el siguiente start fetcheará uno fresco vía /api/stt/token.
      initialTokenRef.current = null;
    } else {
      tokenPromise = fetchEphemeralToken();
      tokenPromise.catch(() => undefined);
    }

    let stream: MediaStream;
    // Si el hook hizo prewarm en mount Y el stream sigue vivo, reusarlo
    // saltea el getUserMedia (~50-300ms shaved). El track puede haberse
    // muerto entremedio (BT disconnect, OS revoke) — validamos readyState
    // antes de confiar.
    const prewarmed = prewarmedStreamRef.current;
    if (
      prewarmed &&
      prewarmed.getAudioTracks().some((t) => t.readyState === 'live')
    ) {
      stream = prewarmed;
      prewarmedStreamRef.current = null;
    } else {
      if (prewarmed) {
        // Stream stale — limpiar tracks antes de soltar la ref.
        for (const t of prewarmed.getTracks()) t.stop();
        prewarmedStreamRef.current = null;
      }
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

    // FIX cold-start: arrancar el AudioWorklet AHORA, sin esperar al socket.
    // Los frames PCM dichos antes del socket.open caen al buffer in-memory
    // (bufferedChunksRef) y se drenan al abrir, en orden FIFO.
    try {
      await setupPcmWorklet(stream);
      // playStartChime() vive en socket.on('open') para que solo suene cuando
      // el mic está realmente conectado a Deepgram, no al iniciar la captura
      // local.
    } catch (err) {
      teardown();
      setStatus('error');
      setError(
        err instanceof Error
          ? `No pudimos iniciar la captura de audio: ${err.message}`
          : 'No pudimos iniciar la captura de audio.'
      );
      setErrorCode('codec_unsupported');
      return;
    }

    // Audio level meter (UX): no-fail si falla. Reusa el AudioContext + source
    // ya creados por setupPcmWorklet vía ensureAudioGraph.
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
      await boot(tokenPromise);
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
    setupPcmWorklet,
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
    playStopChime();
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

  // Pre-warm getUserMedia al MOUNT si el caller lo pide Y el browser reporta
  // permission='granted'. Acquired stream queda en prewarmedStreamRef, que
  // start() consume saltando getUserMedia (~100-300ms shaved en mic-ya-
  // autorizado, que es el caso típico durante una sesión).
  //
  // Si permission es 'prompt' o 'denied', no hacemos nada (no triggear el
  // permission UI sin gesture). Si el query API no existe (Safari < 16),
  // tampoco — el fallback es el camino normal del click.
  useEffect(() => {
    if (!opts.prewarmMicOnMount) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return;

    let cancelled = false;
    const acquireIfGranted = async (): Promise<void> => {
      try {
        // `microphone` no está en el tipado oficial de PermissionName pero
        // sí lo soportan todos los browsers que nos importan. Cast forzado.
        const result = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        if (cancelled || result.state !== 'granted') return;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: STT_AUDIO_CONSTRAINTS,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        prewarmedStreamRef.current = stream;
      } catch {
        // No-fail: cualquier error deja el flujo normal del click intacto.
      }
    };
    void acquireIfGranted();
    return () => {
      cancelled = true;
      // Si todavía no se consumió, liberar el stream al unmount/re-prewarm.
      const stream = prewarmedStreamRef.current;
      if (stream && !streamRef.current) {
        // streamRef.current existe solo si start() ya consumió el prewarmed —
        // en ese caso NO debemos cerrar tracks porque están vivos en streamRef.
        for (const t of stream.getTracks()) t.stop();
        prewarmedStreamRef.current = null;
      }
    };
  }, [opts.prewarmMicOnMount]);

  // Pause stream when tab loses focus; resume when it returns. iOS Safari
  // friendly: suspende AudioContext si está activo, resume al volver. Con
  // AudioWorklet, suspender el ctx pausa el process() del processor, los
  // frames PCM dejan de emitirse, y el socket WS sigue abierto vía KeepAlive.
  useEffect(() => {
    const onVisibilityChange = (): void => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (document.hidden) {
        if (ctx.state === 'running') {
          wasRunningOnHideRef.current = true;
          ctx.suspend().catch(() => undefined);
        }
      } else if (wasRunningOnHideRef.current) {
        wasRunningOnHideRef.current = false;
        ctx.resume()
          .then(() => {
            lastAudioAtRef.current = Date.now();
          })
          .catch(() => undefined);
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
    lowAudioWarning,
    longRecordingWarning,
    metrics,
    start,
    stop,
    editSegment,
  };
}
