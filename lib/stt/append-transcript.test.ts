import { describe, it, expect } from 'vitest';
import {
  appendTranscriptSegments,
  type AppendResult,
} from './append-transcript';
import type { TranscriptSegment } from './use-deepgram-stream';

function seg(id: string, text: string): TranscriptSegment {
  return {
    id,
    text,
    speaker: null,
    start_sec: 0,
    end_sec: 0,
    confidence: 0.95,
    corregida_manualmente: false,
  };
}

describe('appendTranscriptSegments', () => {
  it('no-op cuando history.length === lastAppendedIndex', () => {
    const r: AppendResult = appendTranscriptSegments('hola', [], 0);
    expect(r).toEqual({ nextTexto: 'hola', consumidos: 0 });
  });

  it('avanza el cursor pero no toca el texto cuando los segmentos nuevos están todos vacíos', () => {
    const history = [seg('s-1', '   '), seg('s-2', '\n')];
    const r = appendTranscriptSegments('texto previo', history, 0);
    expect(r.nextTexto).toBe('texto previo');
    expect(r.consumidos).toBe(2);
  });

  it('agrega un único segmento con espacio separador cuando el texto previo no termina en whitespace', () => {
    const history = [seg('s-1', 'somos un banco múltiple')];
    const r = appendTranscriptSegments('Hola,', history, 0);
    expect(r.nextTexto).toBe('Hola, somos un banco múltiple');
    expect(r.consumidos).toBe(1);
  });

  it('NO inserta espacio extra si el texto previo termina en whitespace', () => {
    const history = [seg('s-1', 'continuación.')];
    const r = appendTranscriptSegments('Una frase. ', history, 0);
    expect(r.nextTexto).toBe('Una frase. continuación.');
    expect(r.consumidos).toBe(1);
  });

  it('NO inserta espacio inicial si el texto previo está vacío', () => {
    const history = [seg('s-1', 'arrancamos desde cero')];
    const r = appendTranscriptSegments('', history, 0);
    expect(r.nextTexto).toBe('arrancamos desde cero');
    expect(r.consumidos).toBe(1);
  });

  it('concatena múltiples segmentos nuevos con un espacio entre ellos', () => {
    const history = [
      seg('s-1', 'somos banco'),
      seg('s-2', 'regulado por CNBV'),
      seg('s-3', 'desde 2012'),
    ];
    const r = appendTranscriptSegments('', history, 0);
    expect(r.nextTexto).toBe('somos banco regulado por CNBV desde 2012');
    expect(r.consumidos).toBe(3);
  });

  it('solo procesa el slice nuevo (history.slice(lastAppendedIndex))', () => {
    const history = [
      seg('s-1', 'ya fue agregado'),
      seg('s-2', 'esto es nuevo'),
    ];
    const r = appendTranscriptSegments('ya fue agregado', history, 1);
    expect(r.nextTexto).toBe('ya fue agregado esto es nuevo');
    expect(r.consumidos).toBe(2);
  });

  it('trimea espacios internos de cada segmento antes de unirlos', () => {
    const history = [seg('s-1', '   somos un banco   '), seg('s-2', '   con 14 años   ')];
    const r = appendTranscriptSegments('', history, 0);
    expect(r.nextTexto).toBe('somos un banco con 14 años');
    expect(r.consumidos).toBe(2);
  });

  it('mezcla de segmentos vacíos y con contenido — solo concatena los con contenido', () => {
    const history = [
      seg('s-1', '   '),
      seg('s-2', 'con texto real'),
      seg('s-3', ''),
      seg('s-4', 'final'),
    ];
    const r = appendTranscriptSegments('previo', history, 0);
    expect(r.nextTexto).toBe('previo con texto real final');
    expect(r.consumidos).toBe(4);
  });

  it('idempotencia: llamar dos veces con el mismo lastAppendedIndex avanzado produce no-op', () => {
    const history = [seg('s-1', 'hola')];
    const r1 = appendTranscriptSegments('', history, 0);
    expect(r1.nextTexto).toBe('hola');
    const r2 = appendTranscriptSegments(r1.nextTexto, history, r1.consumidos);
    expect(r2.nextTexto).toBe('hola');
    expect(r2.consumidos).toBe(1);
  });
});
