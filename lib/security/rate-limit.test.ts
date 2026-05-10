// Tests del rate limiter. Pure function — no mocks, no fakes de tiempo más
// allá de avanzar Date.now via vi.useFakeTimers().

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  _resetRateLimitState,
  getClientIp,
  RATE_LIMITS,
} from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite hasta `capacity` requests consecutivos', () => {
    const cfg = { capacity: 3, refillPerSecond: 1 };
    expect(checkRateLimit('k', cfg).allowed).toBe(true);
    expect(checkRateLimit('k', cfg).allowed).toBe(true);
    expect(checkRateLimit('k', cfg).allowed).toBe(true);
    expect(checkRateLimit('k', cfg).allowed).toBe(false);
  });

  it('reporta remaining decreciente y retryAfter cuando se agota', () => {
    const cfg = { capacity: 2, refillPerSecond: 0.5 }; // 0.5 token/s = 1 cada 2s
    const a = checkRateLimit('k', cfg);
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(1);
    const b = checkRateLimit('k', cfg);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(0);
    const c = checkRateLimit('k', cfg);
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('refilla tokens con el paso del tiempo', () => {
    const cfg = { capacity: 2, refillPerSecond: 1 };
    checkRateLimit('k', cfg);
    checkRateLimit('k', cfg);
    expect(checkRateLimit('k', cfg).allowed).toBe(false);

    // Avanzar 2s — debería refillar 2 tokens (cap=2).
    vi.advanceTimersByTime(2000);

    expect(checkRateLimit('k', cfg).allowed).toBe(true);
    expect(checkRateLimit('k', cfg).allowed).toBe(true);
    expect(checkRateLimit('k', cfg).allowed).toBe(false);
  });

  it('aísla buckets por key', () => {
    const cfg = { capacity: 1, refillPerSecond: 0.1 };
    expect(checkRateLimit('a', cfg).allowed).toBe(true);
    expect(checkRateLimit('b', cfg).allowed).toBe(true);
    expect(checkRateLimit('a', cfg).allowed).toBe(false);
    expect(checkRateLimit('b', cfg).allowed).toBe(false);
  });

  it('cap de capacity al refillar (no excede)', () => {
    const cfg = { capacity: 3, refillPerSecond: 100 };
    checkRateLimit('k', cfg); // consume 1 → 2 left
    vi.advanceTimersByTime(60_000); // refill grande → debería capear a 3
    expect(checkRateLimit('k', cfg).allowed).toBe(true); // 1 consumido → 2 left
    expect(checkRateLimit('k', cfg).allowed).toBe(true); // 1 consumido → 1 left
    expect(checkRateLimit('k', cfg).allowed).toBe(true); // 1 consumido → 0 left
    expect(checkRateLimit('k', cfg).allowed).toBe(false); // empty
  });

  it('RATE_LIMITS presets son consistentes (capacity > 0, refill > 0)', () => {
    for (const [name, cfg] of Object.entries(RATE_LIMITS)) {
      expect(cfg.capacity, `${name} capacity`).toBeGreaterThan(0);
      expect(cfg.refillPerSecond, `${name} refillPerSecond`).toBeGreaterThan(0);
    }
  });
});

describe('getClientIp', () => {
  function makeReq(headers: Record<string, string>): Request {
    return new Request('http://localhost/x', { headers });
  }

  it('extrae primera IP de x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('cae a x-real-ip si x-forwarded-for ausente', () => {
    const req = makeReq({ 'x-real-ip': '4.3.2.1' });
    expect(getClientIp(req)).toBe('4.3.2.1');
  });

  it('default unknown sin headers', () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('trim whitespace en x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '  10.0.0.1  ' });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });
});
