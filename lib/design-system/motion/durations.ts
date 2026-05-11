// lib/design-system/motion/durations.ts
//
// Durations centralizadas — matchean --dur-* en motion.css.
// `dur` en seconds para framer-motion `transition.duration`.
// `durMs` en ms para Date.now() arithmetic o CSS template literals.

export const dur = {
  micro:  0.16,
  fast:   0.24,
  layout: 0.38,
  hero:   0.72,
  epic:   1.2,
} as const;

export const durMs = {
  micro:  160,
  fast:   240,
  layout: 380,
  hero:   720,
  epic:   1200,
} as const;

export type DurationPreset = keyof typeof dur;
