// Motion tokens centralizados — single source of truth para curves, durations
// y stagger en toda la encuesta. Importar desde aquí en lugar de hardcodear.
//
// Curves elegidas (CLAUDE.md easing guidance):
//   outExpo   — entradas suaves, releases naturales (la default).
//   iosSheet  — fade-out + transitions de salida (cubic-bezier(0.32, 0.72, 0, 1)).
//   outBack   — overshoot pequeño para CTAs y celebraciones (gentle, no goofy).
//
// Durations en segundos (compatible con Framer Motion + CSS transition).
// Stagger en segundos entre hijos (compatible con motion children).

export const ease = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  iosSheet: [0.32, 0.72, 0, 1] as const,
  outBack: [0.34, 1.56, 0.64, 1] as const,
} as const;

export const duration = {
  micro: 0.18,
  component: 0.28,
  macro: 0.48,
  hero: 0.72,
} as const;

export const stagger = {
  tight: 0.04,
  default: 0.06,
  loose: 0.08,
} as const;

export type Ease = typeof ease;
export type Duration = typeof duration;
export type Stagger = typeof stagger;
