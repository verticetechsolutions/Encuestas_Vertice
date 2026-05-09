import { describe, it, expect } from 'vitest';
import { parseMagicStatusFilter } from './parse-magic-status-filter';

const DEFAULT = ['vigente', 'consumido'];

describe('parseMagicStatusFilter', () => {
  it('undefined → default [vigente, consumido]', () => {
    expect(parseMagicStatusFilter(undefined)).toEqual(DEFAULT);
  });

  it('cadena vacía → default', () => {
    expect(parseMagicStatusFilter('')).toEqual(DEFAULT);
  });

  it('un valor válido', () => {
    expect(parseMagicStatusFilter('revocado')).toEqual(['revocado']);
  });

  it('múltiples valores válidos', () => {
    expect(parseMagicStatusFilter('vigente,expirado')).toEqual([
      'vigente',
      'expirado',
    ]);
  });

  it('filtra inválidos manteniendo válidos', () => {
    expect(parseMagicStatusFilter('garbage,vigente')).toEqual(['vigente']);
  });

  it('todo inválido → default', () => {
    expect(parseMagicStatusFilter('garbage,otro')).toEqual(DEFAULT);
  });

  it('whitespace tolerado', () => {
    expect(parseMagicStatusFilter(' vigente , revocado ')).toEqual([
      'vigente',
      'revocado',
    ]);
  });
});
