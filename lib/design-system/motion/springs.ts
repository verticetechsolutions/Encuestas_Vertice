// lib/design-system/motion/springs.ts
//
// Spring physics presets para framer-motion. Centralizados — antes
// vivían inline en HeaderCTA, SectionIndicator, etc. Cada preset tiene
// un feel documentado para que el resto del equipo (y futuro tú) sepa
// cuándo usar cuál.
//
// Uso:
//   import { springs } from '@/lib/design-system/motion/springs';
//   <motion.div transition={springs.elegant} ... />

export const springs = {
  /** Snap. UI inputs, toggles, micro-interactions. */
  snap:      { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.4 },
  /** Elegant. Hero CTAs, important reveals, navigation. */
  elegant:   { type: 'spring' as const, stiffness: 320, damping: 22, mass: 0.55 },
  /** Soft. Text, opacity, gentle layout shifts. */
  soft:      { type: 'spring' as const, stiffness: 380, damping: 26, mass: 0.6 },
  /** Bounce. Overshoot reveals (success, celebration). */
  bounce:    { type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.5 },
  /** Indicator. Scroll-driven section indicator. */
  indicator: { type: 'spring' as const, stiffness: 360, damping: 26, mass: 0.55 },
} as const;

export type SpringPreset = keyof typeof springs;
