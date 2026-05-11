// lib/design-system/tokens.test.ts
import { describe, expect, it } from 'vitest';
import { brand, fonts } from './tokens';

describe('brand tokens', () => {
  it('exports the 8 brand colors', () => {
    expect(brand.ink).toBe('#0A0F1C');
    expect(brand.inkRaised).toBe('#1A2236');
    expect(brand.creamPure).toBe('#F4F1EA');
    expect(brand.gold).toBe('#C8A864');
    expect(brand.goldDeep).toBe('#866D38');
    expect(brand.goldBright).toBe('#F2D89C');
    expect(brand.goldLight).toBe('#E0BE7C');
    expect(brand.burgundy).toBe('#8B3A3A');
  });
});

describe('fonts', () => {
  it('exports display + sans family strings', () => {
    expect(fonts.display).toContain('General Sans');
    expect(fonts.sans).toContain('Satoshi');
  });
});
