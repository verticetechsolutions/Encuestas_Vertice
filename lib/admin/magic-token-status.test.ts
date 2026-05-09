import { describe, it, expect } from 'vitest';
import { magicTokenStatus, VALID_MAGIC_STATUSES } from './magic-token-status';

const NOW = new Date('2026-05-08T12:00:00Z');
const PAST = new Date('2026-05-01T12:00:00Z');
const FUTURE = new Date('2026-05-15T12:00:00Z');

describe('magicTokenStatus', () => {
  it('vigente cuando no consumed/revoked y expires_at futuro', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: null, expires_at: FUTURE },
        NOW
      )
    ).toBe('vigente');
  });

  it('expirado cuando expires_at en el pasado y nada más', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: null, expires_at: PAST },
        NOW
      )
    ).toBe('expirado');
  });

  it('consumido cuando consumed_at presente', () => {
    expect(
      magicTokenStatus(
        { consumed_at: PAST, revoked_at: null, expires_at: FUTURE },
        NOW
      )
    ).toBe('consumido');
  });

  it('revocado cuando revoked_at presente y no consumido', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: PAST, expires_at: FUTURE },
        NOW
      )
    ).toBe('revocado');
  });

  it('consumido gana sobre revocado (precedencia documentada)', () => {
    expect(
      magicTokenStatus(
        { consumed_at: PAST, revoked_at: PAST, expires_at: FUTURE },
        NOW
      )
    ).toBe('consumido');
  });

  it('revocado gana sobre expirado', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: PAST, expires_at: PAST },
        NOW
      )
    ).toBe('revocado');
  });

  it('VALID_MAGIC_STATUSES contiene los 4 estados', () => {
    expect(VALID_MAGIC_STATUSES).toEqual([
      'vigente',
      'consumido',
      'expirado',
      'revocado',
    ]);
  });
});
