// Rate limiter unificado: Upstash Redis (distribuido) cuando hay credenciales,
// fallback in-memory token bucket cuando no.
//
// Sprint 2 security audit 2026-05-12: el modo in-memory tiene un problema
// en Vercel serverless multi-instance — cada instance mantiene su propio
// bucket y un atacante puede multiplicar el cap real por N instances + cold
// starts. Upstash Redis comparte estado entre todas las instances vía REST.
//
// Modo decisión:
//   - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN están set en env,
//     usar Upstash. Production-correct.
//   - Sino, fallback in-memory token bucket. Para dev local y tests sin
//     dependencia de Redis. Trade-off documentado: degrada a "por-instance"
//     en Vercel multi-instance, suficiente para MVP.
//
// API:
//   - `checkRateLimit(key, config)` es **async** ahora (Upstash es over-REST).
//     Los call sites estaban en handlers/server actions async, así que el
//     cambio es agregar `await`.
//   - `getClientIp`, `_resetRateLimitState`, `RATE_LIMITS` siguen igual.
//
// Algoritmo: token bucket en ambos modos (Upstash tiene `tokenBucket` builtin).
// Las configs `{capacity, refillPerSecond}` mapean a Upstash via:
//   capacity = maxTokens
//   refillRate, interval = tokens_por_intervalo, intervalo_en_ms
// Eligo intervalo=1s con refillRate=Math.ceil(refillPerSecond) — mantiene
// la semántica original con resolución de 1s (perdemos sub-second precision
// pero no afecta uso real porque todos nuestros caps son ≥ 1 token/min).

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const MAX_KEYS = 10_000;

interface Bucket {
  tokens: number;
  lastRefill: number; // ms epoch
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Max tokens que caben en el bucket. */
  capacity: number;
  /** Tokens añadidos por segundo (rate de refill). */
  refillPerSecond: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens restantes tras esta petición (0 si no allowed). */
  remaining: number;
  /** Segundos sugeridos para reintentar (0 si allowed). */
  retryAfterSeconds: number;
}

// =============================================================================
// Upstash mode
// =============================================================================

let upstashRedis: Redis | null = null;
function getUpstashRedis(): Redis | null {
  if (upstashRedis) return upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  upstashRedis = new Redis({ url, token });
  return upstashRedis;
}

/** Cache de Ratelimit instances. Upstash docs recomienda reusar la misma
 *  instance por (config, prefix). El key acá es un hash determinístico de
 *  la config (capacity + refillPerSecond) — todos los call sites con la
 *  misma config comparten Ratelimit instance, lo cual es óptimo. */
const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(config: RateLimitConfig): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  // refill por segundo → tokens por intervalo. Usamos intervalo de 1s con
  // refillRate = capacity / (capacity / refillPerSecond) = refillPerSecond.
  // Resolución de 1s; nuestros caps mínimos son 5/15min = 0.0055/s, así que
  // multiplicamos por 60 (intervalo de 1m) para evitar rate=0.
  // En general: intervalo = max(1s, ceil(1 / refillPerSecond) s).
  const intervalSec = Math.max(1, Math.ceil(1 / config.refillPerSecond));
  const refillRate = Math.max(1, Math.round(config.refillPerSecond * intervalSec));
  const cacheKey = `${config.capacity}:${refillRate}:${intervalSec}`;
  const existing = ratelimitCache.get(cacheKey);
  if (existing) return existing;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(
      refillRate,
      `${intervalSec} s`,
      config.capacity
    ),
    analytics: false,
    prefix: 'vertice/rl',
  });
  ratelimitCache.set(cacheKey, rl);
  return rl;
}

// =============================================================================
// Public API
// =============================================================================

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ratelimit = getRatelimit(config);
  if (ratelimit) {
    try {
      const res = await ratelimit.limit(key);
      const retryAfterSeconds = res.success
        ? 0
        : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
      return {
        allowed: res.success,
        remaining: Math.max(0, res.remaining),
        retryAfterSeconds,
      };
    } catch (err) {
      // Upstash inaccesible (red caída, token rotado). Degradar a in-memory
      // antes que rechazar todas las requests (availability > strict limit).
      // Loguear vía console; el route handler logueará vía Axiom si quiere.
      console.warn(
        '[rate-limit] Upstash fallido, fallback in-memory:',
        err instanceof Error ? err.message : String(err)
      );
      // fallthrough al in-memory
    }
  }
  return checkRateLimitInMemory(key, config);
}

// =============================================================================
// In-memory fallback (dev + tests + Upstash outage)
// =============================================================================

function checkRateLimitInMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Eviction LRU-aproximada: el primer key en insertion order es el más
      // antiguo en haber sido creado o re-tocado por delete+set.
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    bucket = { tokens: config.capacity, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill lazy basado en elapsed * rate, capped a capacity.
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  const refilled = Math.min(
    config.capacity,
    bucket.tokens + elapsedSec * config.refillPerSecond
  );
  bucket.tokens = refilled;
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  const tokensFaltantes = 1 - bucket.tokens;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(tokensFaltantes / config.refillPerSecond)
  );
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/**
 * Solo para tests — limpia el state in-memory + cache de Ratelimit instances.
 * NO usar en prod.
 */
export function _resetRateLimitState(): void {
  buckets.clear();
  ratelimitCache.clear();
  upstashRedis = null;
}

/**
 * Extrae la IP del cliente. Vercel y la mayoría de proxies setean
 * `x-forwarded-for`; algunos `x-real-ip`. Default a 'unknown' para nunca
 * fallar el limiter por falta de headers.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Configs por endpoint. Capacities y refill rates derivados de uso esperado:
 * - turn: ~30 turnos en 30-60 min. Cap 30/min/sesión tolera bursts de retries;
 *   cap 100/min/IP catch-all para abuse cross-sesión.
 * - acceso: 10/min/IP da 5-10 reintentos genuinos. Magic tokens son base64url
 *   24 bytes = 192 bits, brute force computacionalmente imposible incluso a
 *   10/min, pero el cap evita amplificación.
 * - magicLink: 5/hora/IP frena spam masivo de emisión (protege Resend $$).
 * - adminLogin: 5/15min/IP. Bcrypt de un token corto se rompe en O(s); el
 *   throttle hace infeasible incluso con leakage parcial del token.
 * - stt: 20/min/sesión. Cada turno necesita 1 token efímero; 20 da margen
 *   para reconexiones.
 */
export const RATE_LIMITS = {
  turnPerSesion: { capacity: 30, refillPerSecond: 30 / 60 },
  turnPerIp: { capacity: 100, refillPerSecond: 100 / 60 },
  accesoPerIp: { capacity: 10, refillPerSecond: 10 / 60 },
  magicLinkPerIp: { capacity: 5, refillPerSecond: 5 / 3600 },
  adminLoginPerIp: { capacity: 5, refillPerSecond: 5 / 900 },
  sttPerSesion: { capacity: 20, refillPerSecond: 20 / 60 },
} as const satisfies Record<string, RateLimitConfig>;
