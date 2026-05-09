import { describe, it, expect } from 'vitest';
import {
  sanitizeQuery,
  isUuidish,
  SEARCH_MIN_LEN,
  SEARCH_MAX_LEN,
} from './search-query';

describe('sanitizeQuery', () => {
  it('hace trim de whitespace', () => {
    expect(sanitizeQuery('  banco  ')).toBe('banco');
  });

  it('limita a SEARCH_MAX_LEN chars', () => {
    const long = 'a'.repeat(SEARCH_MAX_LEN + 50);
    expect(sanitizeQuery(long).length).toBe(SEARCH_MAX_LEN);
  });

  it('escapa wildcards % y _ y backslash', () => {
    expect(sanitizeQuery('50%_off\\day')).toBe('50\\%\\_off\\\\day');
  });

  it('devuelve cadena vacía cuando input es solo whitespace', () => {
    expect(sanitizeQuery('   ')).toBe('');
  });
});

describe('isUuidish', () => {
  it('acepta 4 hex chars', () => {
    expect(isUuidish('abcd')).toBe(true);
  });

  it('acepta 8 hex con dash', () => {
    expect(isUuidish('abcd-ef12')).toBe(true);
  });

  it('acepta UUID completo (36 chars)', () => {
    expect(isUuidish('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
  });

  it('rechaza menos de 4 chars', () => {
    expect(isUuidish('ab')).toBe(false);
    expect(isUuidish('abc')).toBe(false);
  });

  it('rechaza chars no-hex', () => {
    expect(isUuidish('xyz1')).toBe(false);
  });

  it('rechaza más de 36 chars', () => {
    expect(isUuidish('a'.repeat(37))).toBe(false);
  });

  it('rechaza vacío', () => {
    expect(isUuidish('')).toBe(false);
  });

  it('es case-insensitive', () => {
    expect(isUuidish('ABCDEF12')).toBe(true);
  });

  it('SEARCH_MIN_LEN es 2', () => {
    expect(SEARCH_MIN_LEN).toBe(2);
  });
});
