// Tests están wrappeados en `describe.skip` — smoke tests aspiracionales que
// no corren hasta que la integración manual en /demo/stt los promueva a run
// real (deuda técnica #12: tests STT hook completos con jsdom + RTL).
//
// Coverage intent (smoke only):
//   1. POST without a session cookie → 401 with error 'sin_sesion'.
//   2. POST with a cookie pointing at a non-existent sesion → 401.
//   3. POST with a cookie pointing at a closed sesion → 401.
//   4. POST with a valid open sesion → 200 with access_token + expires_in,
//      and grantEphemeralToken is called with ttl_seconds <= 120.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieStore = new Map<string, string>();
vi.mock('@/lib/auth/cookie', () => ({
  SESSION_COOKIE: 'vertice_session',
  readSessionCookie: vi.fn(async () => cookieStore.get('vertice_session')),
}));

const dbState = {
  rows: [] as Array<{ id: string; status: string }>,
};
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbState.rows,
        }),
      }),
    }),
  },
}));

const grantSpy = vi.fn(async (ttl: number) => ({
  access_token: 'jwt-test',
  expires_in: ttl,
}));
vi.mock('@/lib/stt/client', () => ({
  grantEphemeralToken: grantSpy,
}));

import { POST } from './route';

beforeEach(() => {
  cookieStore.clear();
  dbState.rows = [];
  grantSpy.mockClear();
});

describe.skip('POST /api/stt/token', () => {
  it('returns 401 when no session cookie is present', async () => {
    const res = await POST(new Request('http://localhost:3000/api/stt/token', { method: 'POST' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('sin_sesion');
  });

  it('returns 401 when cookie points at a non-existent session', async () => {
    cookieStore.set('vertice_session', 'sesion-fantasma');
    const res = await POST(new Request('http://localhost:3000/api/stt/token', { method: 'POST' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('sesion_no_encontrada');
  });

  it('returns 401 when cookie points at a closed session', async () => {
    cookieStore.set('vertice_session', 'sesion-1');
    dbState.rows = [{ id: 'sesion-1', status: 'completa' }];
    const res = await POST(new Request('http://localhost:3000/api/stt/token', { method: 'POST' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('sesion_cerrada');
  });

  it('returns a token with TTL <= 120s for a valid open session', async () => {
    cookieStore.set('vertice_session', 'sesion-1');
    dbState.rows = [{ id: 'sesion-1', status: 'abierta' }];
    const res = await POST(new Request('http://localhost:3000/api/stt/token', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe('jwt-test');
    expect(body.expires_in).toBeLessThanOrEqual(120);
    expect(grantSpy).toHaveBeenCalledTimes(1);
    expect(grantSpy.mock.calls[0][0]).toBeLessThanOrEqual(120);
  });
});
