// Motion tokens centralizados — tests sanity para que ningún componente
// hardcodee curves o duraciones. Si cambia un valor, todos los componentes
// que lo importen heredan el cambio.

import { describe, it, expect } from 'vitest';
import { ease, duration, stagger } from './motion-tokens';

describe('ease', () => {
  it('outExpo es la curva [0.16, 1, 0.3, 1]', () => {
    expect(ease.outExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('iosSheet es la curva [0.32, 0.72, 0, 1]', () => {
    expect(ease.iosSheet).toEqual([0.32, 0.72, 0, 1]);
  });

  it('outBack es la curva [0.34, 1.56, 0.64, 1]', () => {
    expect(ease.outBack).toEqual([0.34, 1.56, 0.64, 1]);
  });
});

describe('duration', () => {
  it('micro está entre 120-200ms (interacciones rápidas)', () => {
    expect(duration.micro).toBeGreaterThanOrEqual(0.12);
    expect(duration.micro).toBeLessThanOrEqual(0.2);
  });

  it('component está entre 250-300ms (transiciones de estado)', () => {
    expect(duration.component).toBeGreaterThanOrEqual(0.25);
    expect(duration.component).toBeLessThanOrEqual(0.3);
  });

  it('macro está entre 400-500ms (cambios de layout)', () => {
    expect(duration.macro).toBeGreaterThanOrEqual(0.4);
    expect(duration.macro).toBeLessThanOrEqual(0.5);
  });

  it('hero está entre 600-900ms (entradas dramáticas)', () => {
    expect(duration.hero).toBeGreaterThanOrEqual(0.6);
    expect(duration.hero).toBeLessThanOrEqual(0.9);
  });
});

describe('stagger', () => {
  it('tight, default y loose están en orden ascendente', () => {
    expect(stagger.tight).toBeLessThan(stagger.default);
    expect(stagger.default).toBeLessThan(stagger.loose);
  });

  it('default es 0.06s', () => {
    expect(stagger.default).toBe(0.06);
  });
});
