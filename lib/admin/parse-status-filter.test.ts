import { describe, it, expect } from 'vitest';
import { parseStatusFilter } from './parse-status-filter';

describe('parseStatusFilter', () => {
  it('devuelve default cuando raw es undefined', () => {
    expect(parseStatusFilter(undefined)).toEqual(['abierta', 'sintetizando']);
  });

  it('devuelve default cuando raw es cadena vacía', () => {
    expect(parseStatusFilter('')).toEqual(['abierta', 'sintetizando']);
  });

  it('acepta un solo status válido', () => {
    expect(parseStatusFilter('completa')).toEqual(['completa']);
  });

  it('acepta múltiples válidos separados por coma', () => {
    expect(parseStatusFilter('completa,abandonada')).toEqual([
      'completa',
      'abandonada',
    ]);
  });

  it('filtra valores inválidos y conserva los válidos', () => {
    expect(parseStatusFilter('garbage,abierta')).toEqual(['abierta']);
  });

  it('devuelve default cuando todos son inválidos', () => {
    expect(parseStatusFilter('garbage,otra')).toEqual([
      'abierta',
      'sintetizando',
    ]);
  });

  it('hace trim de whitespace alrededor de cada valor', () => {
    expect(parseStatusFilter(' completa , abandonada ')).toEqual([
      'completa',
      'abandonada',
    ]);
  });

  it('descarta segmentos vacíos por comas dobles', () => {
    expect(parseStatusFilter('completa,,abandonada')).toEqual([
      'completa',
      'abandonada',
    ]);
  });
});
