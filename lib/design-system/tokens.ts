// lib/design-system/tokens.ts
//
// TS export de brand primitives para uso en JS (gradients programáticos,
// canvas, server components que generan inline styles). El source of
// truth es app/design-system/tokens.css; estos valores DEBEN matchear.

export const brand = {
  ink:        '#0A0F1C',
  inkRaised:  '#1A2236',
  creamPure:  '#F4F1EA',
  gold:       '#C8A864',
  goldDeep:   '#866D38',
  goldBright: '#F2D89C',
  goldLight:  '#E0BE7C',
  burgundy:   '#8B3A3A',
} as const;

export const fonts = {
  display: "'General Sans', 'Satoshi', ui-sans-serif, system-ui, sans-serif",
  sans:    "'Satoshi', ui-sans-serif, system-ui, sans-serif",
} as const;

export type BrandColor = keyof typeof brand;
