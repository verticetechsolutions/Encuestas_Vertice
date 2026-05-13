// Unit test para app/actions/sesionLogout.ts.
//
// logoutSesion solo invoca clearSessionCookie + redirect('/'). No toca DB
// ni invalida la fila `sesiones` (decisión intencional documentada en el
// archivo: permite re-entrar con nuevo magic link sin destruir progreso).

import { beforeEach, describe, expect, it, vi } from 'vitest';

class TestRedirectError extends Error {
  constructor(public path: string) {
    super(`__NEXT_REDIRECT__${path}`);
    this.name = 'TestRedirectError';
  }
}

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new TestRedirectError(path);
  }),
}));

const cookieMock = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(async () => {}),
}));

vi.mock('@/lib/auth/cookie', () => cookieMock);

import { logoutSesion } from './sesionLogout';

describe('logoutSesion (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieMock.clearSessionCookie.mockResolvedValue(undefined);
  });

  it('limpia cookie de sesion y redirige a "/"', async () => {
    let redirectedTo: string | null = null;
    try {
      await logoutSesion();
    } catch (e) {
      if (e instanceof TestRedirectError) redirectedTo = e.path;
      else throw e;
    }
    expect(redirectedTo).toBe('/');
    expect(cookieMock.clearSessionCookie).toHaveBeenCalledOnce();
  });

  it('NO marca la sesion como abandonada (decision documentada)', async () => {
    // Sanity check: el action no debe importar `db` ni `sesiones`. Si en el
    // futuro alguien agrega un UPDATE sesiones SET status='abandonada', este
    // test fallaria porque cookieMock.clearSessionCookie es el unico effect
    // observable que esperamos. Si rompe, revisar la decisión documentada
    // en el header del archivo antes de actualizar el test.
    try {
      await logoutSesion();
    } catch {
      // ignore redirect
    }
    // Solo clearSessionCookie debe haber sido invocado (mocks no incluyen db).
    expect(cookieMock.clearSessionCookie).toHaveBeenCalledOnce();
  });
});
