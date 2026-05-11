// lib/design-system/motion/easings.ts
//
// Easings centralizados — matchean exactamente las CSS vars en
// app/design-system/motion.css. Úsalos en framer-motion como
// `ease: easings.outExpo` o como string en `transition`.

/** Tuple form for framer-motion `ease` prop. */
export const easings = {
  outExpo:  [0.16, 1, 0.3, 1],
  iosSheet: [0.32, 0.72, 0, 1],
  back:     [0.34, 1.4, 0.64, 1],
  backOut:  [0.34, 1.35, 0.64, 1],
  backIn:   [0.36, 0, 0.66, -0.35],
  inOut:    [0.65, 0, 0.35, 1],
  soft:     [0.2, 0.85, 0.25, 1],
} as const;

/** CSS string form for inline style / template literals. */
export const easingsCss = {
  outExpo:  'cubic-bezier(0.16, 1, 0.3, 1)',
  iosSheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
  back:     'cubic-bezier(0.34, 1.4, 0.64, 1)',
  backOut:  'cubic-bezier(0.34, 1.35, 0.64, 1)',
  backIn:   'cubic-bezier(0.36, 0, 0.66, -0.35)',
  inOut:    'cubic-bezier(0.65, 0, 0.35, 1)',
  soft:     'cubic-bezier(0.2, 0.85, 0.25, 1)',
} as const;

export type EasingPreset = keyof typeof easings;
