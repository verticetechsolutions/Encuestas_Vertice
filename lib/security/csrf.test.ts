// Tests del CSRF same-origin check.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSameOrigin } from './csrf';

describe('checkSameOrigin', () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    // Default test setup: NEXT_PUBLIC_APP_URL set, NODE_ENV != production
    // (para activar el fallback dev).
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.vertice.test');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // Solo restauramos NEXT_PUBLIC_APP_URL — NODE_ENV es read-only en TS y
    // vi.stubEnv lo maneja por dentro vía Object.defineProperty + restore.
    if (ORIGINAL_ENV !== undefined) process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV;
  });

  function makeReq(headers: Record<string, string>, url = 'https://app.vertice.test/api/turn'): Request {
    return new Request(url, { method: 'POST', headers });
  }

  it('acepta Origin que matchea NEXT_PUBLIC_APP_URL', () => {
    const req = makeReq({ origin: 'https://app.vertice.test' });
    expect(checkSameOrigin(req)).toEqual({ ok: true });
  });

  it('acepta Origin que matchea el origin del request URL', () => {
    const req = makeReq({ origin: 'https://app.vertice.test' }, 'https://app.vertice.test/api/turn');
    expect(checkSameOrigin(req)).toEqual({ ok: true });
  });

  it('rechaza Origin de otro dominio', () => {
    const req = makeReq({ origin: 'https://malicious.example' });
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('origin_not_allowed');
  });

  it('rechaza request sin Origin ni Referer', () => {
    const req = makeReq({});
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('missing_origin_and_referer');
  });

  it('cae a Referer cuando Origin ausente', () => {
    const req = makeReq({ referer: 'https://app.vertice.test/entrevista/abc' });
    expect(checkSameOrigin(req)).toEqual({ ok: true });
  });

  it('rechaza Referer de otro dominio', () => {
    const req = makeReq({ referer: 'https://malicious.example/path' });
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('referer_not_allowed');
  });

  it('rechaza Referer malformado', () => {
    const req = makeReq({ referer: 'not-a-url' });
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('referer_malformed');
  });

  it('en dev acepta localhost:3000 como fallback', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = makeReq({ origin: 'http://localhost:3000' }, 'http://localhost:3000/api/turn');
    expect(checkSameOrigin(req)).toEqual({ ok: true });
  });

  it('en prod NO acepta localhost:3000', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = makeReq({ origin: 'http://localhost:3000' });
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
  });

  it('Origin gana sobre Referer si ambos presentes', () => {
    // Origin malicioso, Referer ok — debe rechazar (Origin es más restrictivo).
    const req = makeReq({
      origin: 'https://malicious.example',
      referer: 'https://app.vertice.test/page',
    });
    const res = checkSameOrigin(req);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('origin_not_allowed');
  });
});
