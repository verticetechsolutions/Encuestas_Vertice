// Unit tests para app/actions/adminAuth.ts.
//
// loginAdmin y logoutAdmin no tocan DB — solo cookies, rate-limit y env vars.
// Por eso son unit tests (no integration). Mockeamos next/navigation,
// next/headers, lib/auth/admin, lib/security/rate-limit y lib/observability/axiom.
//
// Patrón redirect: Next.js redirect() lanza NEXT_REDIRECT en runtime real.
// Aquí mockeamos con throw de un Error custom para que el control flow del
// action pare al primer redirect (sin esto, los paths de error caerían en
// cascada y el test no podría aislar el comportamiento).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const headersMock = vi.hoisted(() => ({
  get: vi.fn(
    (k: string): string | null =>
      ({
        'x-forwarded-for': '203.0.113.42, 10.0.0.1',
        'user-agent': 'Mozilla/5.0 (test)',
      })[k.toLowerCase()] ?? null
  ),
}));

vi.mock('next/headers', () => ({
  headers: async () => headersMock,
}));

const adminAuthMock = vi.hoisted(() => ({
  setAdminCookie: vi.fn(async (_t: string) => {}),
  clearAdminCookie: vi.fn(async () => {}),
  validateAdminTokenInput: vi.fn((_t: string) => true),
  getAdminPanelToken: vi.fn((): string | null => 'admin-test-token-123456'),
}));

vi.mock('@/lib/auth/admin', () => adminAuthMock);

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 4,
    retryAfterSeconds: 0,
  })),
  RATE_LIMITS: {
    adminLoginPerIp: { capacity: 5, refillPerSecond: 5 / 900 },
  },
}));

vi.mock('@/lib/security/rate-limit', () => rateLimitMock);

const loggerMock = vi.hoisted(() => ({
  admin: {
    login: vi.fn(),
    loginFallido: vi.fn(),
  },
}));

vi.mock('@/lib/observability/axiom', () => ({ logger: loggerMock }));

import { loginAdmin, logoutAdmin } from './adminAuth';

function makeForm(token: string, next?: string): FormData {
  const fd = new FormData();
  fd.set('token', token);
  if (next !== undefined) fd.set('next', next);
  return fd;
}

async function captureRedirect(fn: () => Promise<void>): Promise<string> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TestRedirectError) return e.path;
    throw e;
  }
  throw new Error('Expected redirect, but function returned normally');
}

describe('loginAdmin (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminAuthMock.setAdminCookie.mockResolvedValue(undefined);
    adminAuthMock.clearAdminCookie.mockResolvedValue(undefined);
    adminAuthMock.validateAdminTokenInput.mockReturnValue(true);
    adminAuthMock.getAdminPanelToken.mockReturnValue('admin-test-token-123456');
    rateLimitMock.checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: redirige a /admin por default tras setear cookie', async () => {
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456'))
    );
    expect(path).toBe('/admin');
    expect(adminAuthMock.setAdminCookie).toHaveBeenCalledWith(
      'admin-test-token-123456'
    );
    expect(loggerMock.admin.login).toHaveBeenCalledWith({
      ip: '203.0.113.42',
      user_agent: 'Mozilla/5.0 (test)',
    });
    expect(loggerMock.admin.loginFallido).not.toHaveBeenCalled();
  });

  it('happy path: respeta `next` cuando empieza con /admin', async () => {
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456', '/admin/instituciones'))
    );
    expect(path).toBe('/admin/instituciones');
    expect(adminAuthMock.setAdminCookie).toHaveBeenCalledWith(
      'admin-test-token-123456'
    );
  });

  it('security: `next` con prefijo arbitrario se fuerza a /admin', async () => {
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456', 'https://evil.com/steal'))
    );
    expect(path).toBe('/admin');
    expect(adminAuthMock.setAdminCookie).toHaveBeenCalled();
  });

  it('rate-limit alcanzado: redirige a admin_rate_limited y NO setea cookie', async () => {
    rateLimitMock.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
    });
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456'))
    );
    expect(path).toMatch(/^\/admin\/login\?error=admin_rate_limited&next=/);
    expect(adminAuthMock.setAdminCookie).not.toHaveBeenCalled();
    expect(loggerMock.admin.loginFallido).toHaveBeenCalledWith({
      ip: '203.0.113.42',
      user_agent: 'Mozilla/5.0 (test)',
      razon: 'rate_limited',
    });
  });

  it('admin disabled (env vacia): redirige a admin_disabled', async () => {
    adminAuthMock.getAdminPanelToken.mockReturnValueOnce(null);
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456'))
    );
    expect(path).toMatch(/^\/admin\/login\?error=admin_disabled&next=/);
    expect(adminAuthMock.setAdminCookie).not.toHaveBeenCalled();
    expect(loggerMock.admin.loginFallido).toHaveBeenCalledWith({
      ip: '203.0.113.42',
      user_agent: 'Mozilla/5.0 (test)',
      razon: 'admin_disabled',
    });
  });

  it('token invalido: redirige a admin_invalid_token', async () => {
    adminAuthMock.validateAdminTokenInput.mockReturnValueOnce(false);
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('zzz'))
    );
    expect(path).toMatch(/^\/admin\/login\?error=admin_invalid_token&next=/);
    expect(adminAuthMock.setAdminCookie).not.toHaveBeenCalled();
    expect(loggerMock.admin.loginFallido).toHaveBeenCalledWith({
      ip: '203.0.113.42',
      user_agent: 'Mozilla/5.0 (test)',
      razon: 'admin_invalid_token',
    });
  });

  it('IP fallback a x-real-ip cuando x-forwarded-for no esta', async () => {
    headersMock.get.mockImplementationOnce((k: string) =>
      k.toLowerCase() === 'x-forwarded-for' ? null : 'fallback'
    );
    headersMock.get.mockImplementationOnce((k: string) =>
      k.toLowerCase() === 'x-real-ip' ? '198.51.100.7' : null
    );
    headersMock.get.mockImplementationOnce((k: string) =>
      k.toLowerCase() === 'user-agent' ? 'agent-2' : null
    );
    const path = await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456'))
    );
    expect(path).toBe('/admin');
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      'admin-login:ip:198.51.100.7',
      expect.any(Object)
    );
  });

  it('user-agent largo se trunca a 200 chars en el log', async () => {
    const longUa = 'x'.repeat(500);
    headersMock.get.mockImplementation((k: string) =>
      ({
        'x-forwarded-for': '203.0.113.42',
        'user-agent': longUa,
      })[k.toLowerCase()] ?? null
    );
    await captureRedirect(() =>
      loginAdmin(makeForm('admin-test-token-123456'))
    );
    expect(loggerMock.admin.login).toHaveBeenCalledWith({
      ip: '203.0.113.42',
      user_agent: 'x'.repeat(200),
    });
  });
});

describe('logoutAdmin (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limpia cookie admin y redirige a /admin/login', async () => {
    const path = await captureRedirect(() => logoutAdmin());
    expect(path).toBe('/admin/login');
    expect(adminAuthMock.clearAdminCookie).toHaveBeenCalledOnce();
  });
});
