// In-memory rate limiter (token bucket). Pure function al núcleo + helpers
// para extraer la key (IP, sesion_id, email). API estable para que post-deploy
// se pueda swappear a Upstash/Redis cambiando solo la implementación de
// `checkRateLimit` — los call sites quedan idénticos.
//
// Token bucket: cada key tiene un bucket con `capacity` tokens. Cada request
// consume 1 token. El bucket se refilla a `refillPerSecond`. Cuando el bucket
// está vacío, devolvemos `allowed=false` con `retryAfterSeconds` calculado.
// Refilling es lazy (calculamos en cada `checkRateLimit`, no con setInterval).
//
// Memoria: Map cap a 10K keys con eviction LRU-aproximada (eliminar el más
// antiguo por insertion order). Para Vercel serverless el state vive solo
// durante la invocación-warm; en cold start el limiter arranca limpio. Ese
// trade-off es aceptable para MVP (peor caso un atacante puede hacer N reqs
// hasta que el cold start "olvide" — Upstash lo arregla).
//
// Single-process assumption: por instancia. Si Vercel escala a múltiples
// instances simultáneas, cada una mantiene su propio bucket (efectivamente
// el límite real es N×capacity por minuto). En MVP con 1 piloto a la vez
// es no-issue. Documentar para post-deploy reset a Upstash.

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

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Eviction LRU-aproximada: el primer key en insertion order es el más
      // antiguo en haber sido creado o re-tocado por delete+set. Suficiente
      // para evitar que un atacante con miles de IPs distintas haga OOM.
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

  // Cuántos segundos hasta que tengamos 1 token. tokensFaltantes = 1 - actuales.
  const tokensFaltantes = 1 - bucket.tokens;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(tokensFaltantes / config.refillPerSecond)
  );
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

/**
 * Solo para tests — limpia el state global del limiter. NO usar en prod.
 */
export function _resetRateLimitState(): void {
  buckets.clear();
}

/**
 * Extrae la IP del cliente. Vercel y la mayoría de proxies setean
 * `x-forwarded-for`; algunos `x-real-ip`. Default a 'unknown' para nunca
 * fallar el limiter por falta de headers (peor caso: todos los unknowns
 * comparten el mismo bucket — degrada a "límite global", pero limita).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // Primer IP de la cadena = cliente real. Demás son proxies.
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Configs por endpoint. Capacities y refill rates derivados de uso esperado:
 * - turn: una entrevista típica son ~30 turnos en 30-60 min. Cap 30/min/sesión
 *   tolera bursts de retries; cap 100/min/IP catch-all para abuse cross-sesión.
 * - acceso: 10/min/IP da 5-10 reintentos genuinos antes de bloquear; los magic
 *   tokens son base64url 24 bytes = 192 bits, brute force computacionalmente
 *   imposible incluso a 10/min, pero el cap evita amplificación.
 * - magicLink: 5/hora/IP frena spam masivo de emisión (protege Resend $$).
 * - adminLogin: 5/15min/IP. Bcrypt de un token corto se rompe en O(s); el
 *   throttle hace infeasible incluso con leakage parcial del ADMIN_PANEL_TOKEN.
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
