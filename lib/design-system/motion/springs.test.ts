// lib/design-system/motion/springs.test.ts
import { describe, expect, it } from 'vitest';
import { springs } from './springs';

describe('springs', () => {
  it('elegant matches the HeaderCTA SPRING_FILL inline values', () => {
    expect(springs.elegant).toEqual({
      type: 'spring',
      stiffness: 320,
      damping: 22,
      mass: 0.55,
    });
  });

  it('snap matches the HeaderCTA SPRING_ARROW inline values', () => {
    expect(springs.snap).toEqual({
      type: 'spring',
      stiffness: 520,
      damping: 28,
      mass: 0.4,
    });
  });

  it('soft matches the HeaderCTA SPRING_TEXT inline values', () => {
    expect(springs.soft).toEqual({
      type: 'spring',
      stiffness: 380,
      damping: 26,
      mass: 0.6,
    });
  });

  it('indicator matches SectionIndicator SPRING inline values', () => {
    expect(springs.indicator).toEqual({
      type: 'spring',
      stiffness: 360,
      damping: 26,
      mass: 0.55,
    });
  });

  it('exports 5 presets', () => {
    expect(Object.keys(springs)).toHaveLength(5);
  });
});
