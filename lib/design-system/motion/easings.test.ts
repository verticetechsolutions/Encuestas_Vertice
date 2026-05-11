// lib/design-system/motion/easings.test.ts
import { describe, expect, it } from 'vitest';
import { easings, easingsCss } from './easings';

describe('easings', () => {
  it('exports outExpo as cubic-bezier tuple matching landing manifest', () => {
    expect(easings.outExpo).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exports iosSheet as cubic-bezier tuple', () => {
    expect(easings.iosSheet).toEqual([0.32, 0.72, 0, 1]);
  });

  it('exports all 7 easings', () => {
    expect(Object.keys(easings)).toHaveLength(7);
    expect(Object.keys(easings).sort()).toEqual([
      'back', 'backIn', 'backOut', 'inOut', 'iosSheet', 'outExpo', 'soft',
    ]);
  });

  it('easingsCss returns the matching cubic-bezier() string', () => {
    expect(easingsCss.outExpo).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(easingsCss.iosSheet).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
  });
});
