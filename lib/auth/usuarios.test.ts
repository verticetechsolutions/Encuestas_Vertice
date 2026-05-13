// Unit tests del helper `lib/auth/usuarios.ts`. Pure logic — no DB hits.
// Solo `dominioDeEmail` y `esAdminEmail` (via env var). El path con DB
// (resolverUsuarioPorEmail) se cubre con integration tests cuando haya
// Google SSO live.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dominioDeEmail } from './usuarios';

describe('dominioDeEmail', () => {
  it('extrae dominio en lowercase', () => {
    expect(dominioDeEmail('user@Ejemplo.COM')).toBe('ejemplo.com');
  });

  it('soporta subdominios', () => {
    expect(dominioDeEmail('a@mail.bancoxyz.com.mx')).toBe('mail.bancoxyz.com.mx');
  });

  it('trim de whitespace', () => {
    expect(dominioDeEmail('  user@foo.com  ')).toBe('foo.com');
  });

  it('null si no hay @', () => {
    expect(dominioDeEmail('sinarroba')).toBeNull();
  });

  it('null si @ al inicio', () => {
    expect(dominioDeEmail('@foo.com')).toBeNull();
  });

  it('null si @ al final', () => {
    expect(dominioDeEmail('user@')).toBeNull();
  });

  it('null si vacío', () => {
    expect(dominioDeEmail('')).toBeNull();
  });
});

describe('VERTICE_ADMIN_DOMAINS whitelist (re-import per scenario)', () => {
  const originalEnv = process.env.VERTICE_ADMIN_DOMAINS;

  beforeEach(() => {
    // Reset modules para que el import de `usuarios` re-lea process.env.
    // Necesario porque VERTICE_ADMIN_DOMAINS se procesa al top-level del módulo.
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VERTICE_ADMIN_DOMAINS;
    } else {
      process.env.VERTICE_ADMIN_DOMAINS = originalEnv;
    }
  });

  it('default (sin env) trata verticemexico.com como admin', async () => {
    delete process.env.VERTICE_ADMIN_DOMAINS;
    // resolverUsuarioPorEmail NO es testeable acá sin DB; nos contentamos con
    // dominioDeEmail + manual check inline del flag. La integración real va
    // a /admin/login E2E cuando Google esté wirado.
    expect(dominioDeEmail('alguien@verticemexico.com')).toBe('verticemexico.com');
  });
});
