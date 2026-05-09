// withViewTransition — wrapper sobre document.startViewTransition con fallback.
// Cuando el browser no soporta View Transitions API (Firefox antes de 2026,
// Safari ≤17), llama al callback inmediatamente sin envoltorio. Mantiene la
// misma firma para que el caller no tenga que ramificar.
//
// Tests corren en environment: 'node' (vitest config), entonces stubeamos
// globalThis.document manualmente. No necesitamos jsdom completo para esto.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withViewTransition } from './view-transitions';

describe('withViewTransition', () => {
  beforeEach(() => {
    // Cada test arma su escenario sobre globalThis.document.
    (globalThis as unknown as { document?: unknown }).document = {};
  });

  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('llama al callback inmediatamente cuando la API no existe (fallback)', () => {
    const cb = vi.fn();
    withViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('llama a startViewTransition cuando existe', () => {
    const startVT = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (globalThis as unknown as { document: { startViewTransition?: unknown } }).document.startViewTransition = startVT;
    const cb = vi.fn();
    withViewTransition(cb);
    expect(startVT).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('no rompe si typeof document es undefined (SSR safety)', () => {
    delete (globalThis as unknown as { document?: unknown }).document;
    const cb = vi.fn();
    expect(() => withViewTransition(cb)).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
