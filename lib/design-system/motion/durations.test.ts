// lib/design-system/motion/durations.test.ts
import { describe, expect, it } from 'vitest';
import { dur, durMs } from './durations';

describe('durations', () => {
  it('exposes seconds form for framer-motion (multiply by 1)', () => {
    expect(dur.micro).toBe(0.16);
    expect(dur.fast).toBe(0.24);
    expect(dur.layout).toBe(0.38);
    expect(dur.hero).toBe(0.72);
    expect(dur.epic).toBe(1.2);
  });

  it('exposes ms form matching CSS var values', () => {
    expect(durMs.micro).toBe(160);
    expect(durMs.fast).toBe(240);
    expect(durMs.layout).toBe(380);
    expect(durMs.hero).toBe(720);
    expect(durMs.epic).toBe(1200);
  });

  it('dur and durMs have the same 5 keys', () => {
    expect(Object.keys(dur).sort()).toEqual(Object.keys(durMs).sort());
  });
});
