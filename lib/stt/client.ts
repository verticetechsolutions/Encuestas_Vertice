// Server-side Deepgram client. Wraps `@deepgram/sdk` v5 so the rest of the app
// imports a single function and never touches the SDK constructor directly.
//
// Two responsibilities only:
//   1. Build a Deepgram client authenticated with the server-side API key.
//   2. Expose the cemented Nova-3 streaming config used by browser sockets.
//
// Audio NEVER touches this server. The browser opens a WebSocket directly to
// Deepgram using a short-lived JWT; raw audio never persists on our side.

import { DeepgramClient } from '@deepgram/sdk';

// ---------------------------------------------------------------------------
// Cemented streaming config (founder + IMPLEMENTATION.md §4).
//
// `language: 'multi'` — Nova-3's true multilingual mode, code-switching ES↔EN
// in real time. Required because Mexican subdirectores routinely drop English
// finance jargon mid-sentence ("equity", "leverage", "covenant", "DSCR",
// "stress test"). Pure `es-419` would degrade WER on those terms; the founder
// ratified `multi` after seeing the trade-off.
//
// Re-exported as a frozen const so the browser hook sends the same params the
// server expects to bill — no drift between client and server views.
//
// Deepgram's HTTP/WS API takes booleans as `"true"`/`"false"` query strings,
// and the v5 SDK types reflect that — booleans here would fail typecheck.
// ---------------------------------------------------------------------------
// Keyterms regulatorios MX + léxico crediticio para Nova-3. Mejora WER en
// transposiciones comunes (e.g. CNBV → CNVB, "Vértice" → "Bértice",
// "factoraje" → "facturaje") que observamos en smokes 2026-05-12. Lista
// cerrada — agregar nuevos términos requiere PR. Nova-3 acepta keyterms como
// hint (no hard-bias) que sesga el modelo a estos tokens en context regulatorio.
//
// Cobertura intencional:
//   - Marca: Vértice (V→B confusion en Latam Spanish).
//   - Reguladores federales: CNBV, CONDUSEF, CNSF, IPAB, UIF, SHCP, BANXICO.
//   - Tipos institucionales: SOFOM (ER/ENR), SOFIPO, SOCAP, IFC, IFPE.
//   - Métricas financieras: DSCR, CETES, TIIE, UDIS.
//   - Procesos clave: SAT, RESICO, RFC, INDAVAL.
//   - Compliance MX: PLD (prevención lavado dinero), KYC, AML.
//   - Productos de crédito por garantía: quirografario, prendario,
//     refaccionario, hipotecario, avío, habilitación.
//   - Operaciones financieras: factoraje, leasing, arrendamiento, confirming,
//     descuento.
export const STT_KEYTERMS = Object.freeze([
  // Marca
  'Vértice',
  // Reguladores federales MX
  'CNBV',
  'CONDUSEF',
  'CNSF',
  'IPAB',
  'UIF',
  'SHCP',
  'BANXICO',
  // Tipos institucionales MX
  'SOFOM',
  'SOFIPO',
  'SOCAP',
  'IFC',
  'IFPE',
  // Métricas financieras
  'DSCR',
  'CETES',
  'TIIE',
  'UDIS',
  // Procesos clave
  'SAT',
  'RESICO',
  'RFC',
  'INDAVAL',
  // Compliance MX
  'PLD',
  'KYC',
  'AML',
  // Productos de crédito por garantía
  'quirografario',
  'prendario',
  'refaccionario',
  'hipotecario',
  'avío',
  'habilitación',
  // Operaciones financieras
  'factoraje',
  'leasing',
  'arrendamiento',
  'confirming',
  'descuento',
] as const);
export type SttKeyterm = (typeof STT_KEYTERMS)[number];

export const STT_LIVE_CONFIG = Object.freeze({
  model: 'nova-3-general',
  language: 'multi',
  diarize: 'true',
  // smart_format OMITIDO a propósito (no `'false'` — Deepgram rechaza el
  // handshake con `'false'` cerrando code 1006). Sin smart_format el modelo
  // aplica title-case agresivo a preposiciones españolas ("De", "Del", "Con")
  // interpretando "X de Y de Z" como nombres propios multi-palabra (sesgo
  // del modelo entrenado sobre todo en EN). Acrónimos como SOFOM o DSCR los
  // conserva el lenguaje `multi` sin necesitar smart_format. Mantenemos
  // `punctuate: 'true'` por separado para puntos y comas.
  interim_results: 'true',
  punctuate: 'true',
  vad_events: 'true',
  // utterance_end_ms: Deepgram emite UtteranceEnd después de N ms de silencio
  // tras un final. Útil para detectar fin de turno preciso (mejor que VAD raw).
  // 1000ms = 1s de silencio post-final → considera turn terminado.
  utterance_end_ms: '1000',
  // encoding + sample_rate: indican a Deepgram que el browser le envía Int16
  // PCM crudo (linear16) a 16kHz, NO un container WebM/Opus. El AudioWorklet
  // del lado del cliente (`public/stt/pcm-worklet.js`) downsample y empaqueta
  // a Int16 directo, eliminando el buffering interno del MediaRecorder
  // (~100-300ms de latencia) + el costo de muxing del container. Bandwidth
  // sube ~8x (~256kbps vs 32kbps de Opus) — irrelevante en WiFi/4G, irrelevante
  // para billing Deepgram (cobra por minutos, no bytes).
  encoding: 'linear16',
  sample_rate: '16000',
  channels: '1',
  // Keyterm: sesga el reconocedor hacia acrónimos regulatorios MX. Deepgram
  // acepta lista coma-separada como query param. Lista cementada en
  // `STT_KEYTERMS` arriba.
  keyterm: STT_KEYTERMS.join(','),
} as const);
export type SttLiveConfig = typeof STT_LIVE_CONFIG;

// ---------------------------------------------------------------------------
// MediaRecorder + getUserMedia constraints — calidad profesional.
// ---------------------------------------------------------------------------
// echoCancellation: elimina eco del speaker (importante si user usa speakers).
// noiseSuppression: filtra ruido ambiente (AC, tráfico) — Deepgram lo agradece.
// autoGainControl: normaliza volumen (mic lejano vs cercano).
// channelCount: mono — STT no necesita stereo, ahorra 50% bandwidth.
// sampleRate: 16000 es óptimo para speech (Deepgram default upsamplea de ahí).
// Nota: browsers pueden ignorar sampleRate; lo intentamos pero no fallamos.
export const STT_AUDIO_CONSTRAINTS: MediaTrackConstraints = Object.freeze({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 16000,
});

// KeepAlive: Deepgram cierra el WS tras ~10-12s sin audio. Si el usuario
// está pensando entre dictados, hay que pingear. Cada 8s da 4s de margen.
// Doc: https://developers.deepgram.com/docs/keepalive
export const STT_KEEPALIVE_INTERVAL_MS = 8_000;

// Finalize grace: tras stop() llamamos sendFinalize y esperamos un poco
// para que Deepgram emita el último is_final pendiente antes de close.
// 600ms cubre el roundtrip típico + procesamiento del modelo (~200-400ms).
export const STT_FINALIZE_GRACE_MS = 600;

// Hard cap de sesión continua: 30 minutos. Después de eso, auto-stop con
// warning. Previene escenario "user olvidó cerrar mic, sigue grabando todo el día".
export const STT_MAX_RECORDING_MS = 30 * 60 * 1000;
// Warning a los 25 min: mostrar banner "5 minutos para auto-pausa".
export const STT_WARN_LONG_RECORDING_MS = 25 * 60 * 1000;

// ---------------------------------------------------------------------------
// Server client factory.
// ---------------------------------------------------------------------------
export function getDeepgramServerClient(): DeepgramClient {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY no configurada');
  return new DeepgramClient({ apiKey });
}

// ---------------------------------------------------------------------------
// Ephemeral token grant.
// Returns a short-lived JWT scoped to streaming use. Default 60s TTL — enough
// for the browser to open the websocket; Deepgram keeps the websocket open
// after auth even if the JWT expires mid-stream.
// ---------------------------------------------------------------------------
export interface EphemeralToken {
  access_token: string;
  expires_in: number;
}

export async function grantEphemeralToken(ttlSeconds = 60): Promise<EphemeralToken> {
  const client = getDeepgramServerClient();
  const response = await client.auth.v1.tokens.grant({ ttl_seconds: ttlSeconds });
  return {
    access_token: response.access_token,
    expires_in: response.expires_in ?? ttlSeconds,
  };
}
