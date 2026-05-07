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
export const STT_LIVE_CONFIG = Object.freeze({
  model: 'nova-3-general',
  language: 'multi',
  diarize: 'true',
  smart_format: 'true',
  interim_results: 'true',
  punctuate: 'true',
  vad_events: 'true',
} as const);
export type SttLiveConfig = typeof STT_LIVE_CONFIG;

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
