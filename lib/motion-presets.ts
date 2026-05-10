// Motion + Spring presets para interacciones de botones — design system
// alineado con el HeaderCTA del landing (multi-layered springs).
//
// Uso:
//   <motion.button
//     initial="rest"
//     whileHover="hover"
//     whileTap="tap"
//     variants={buttonVariants.solid}
//     transition={SPRING_BUTTON}
//   />
//
// Tres familias de springs según contexto:
//   - SPRING_BUTTON: hover/lift de containers (medio-snappy)
//   - SPRING_TAP: tap squeeze (rápido, más reactivo)
//   - SPRING_ICON: rotaciones/translaciones de iconos dentro de botones
//                  (snappy, mass baja para feel inmediato)

import type { Transition, Variants } from 'motion/react';

export const SPRING_BUTTON: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 22,
  mass: 0.6,
};

export const SPRING_TAP: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 18,
  mass: 0.4,
};

export const SPRING_ICON: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 18,
  mass: 0.4,
};

// Variants estándar para botones SOLID (con bg fill, ej. CTA primario):
//   - hover: lift sutil (+ y:-1) + scale 1.02
//   - tap: squeeze a 0.97 + push down (y:1)
export const solidButtonVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -1 },
  tap: { scale: 0.97, y: 1 },
};

// Variants para botones GHOST/OUTLINE (sin bg fill, ej. Dictar):
//   - hover: lift sin scale (preserva edges)
//   - tap: squeeze suave
export const ghostButtonVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.015, y: -0.5 },
  tap: { scale: 0.98, y: 0.5 },
};

// Variants para LINKS / text-buttons (Anterior/Siguiente):
//   - hover: NO scale (no movimiento del texto), x bias direccional aplicado
//     por el caller via whileHover={{ x: 2 }} para Siguiente, {x:-2} Anterior
//   - tap: tiny squeeze de opacity/x
export const linkButtonVariants: Variants = {
  rest: { x: 0, opacity: 1 },
  hover: { x: 0, opacity: 1 },
  tap: { x: 0, opacity: 0.85 },
};

// Variants para iconos dentro de botones (chevron, check, etc):
//   Usado en composición con el motion.button outer.
export const iconShiftRightVariants: Variants = {
  rest: { x: 0 },
  hover: { x: 2 },
  tap: { x: 3 },
};

export const iconShiftLeftVariants: Variants = {
  rest: { x: 0 },
  hover: { x: -2 },
  tap: { x: -3 },
};

export const iconScaleVariants: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: { scale: 1.1, rotate: 0 },
  tap: { scale: 0.9, rotate: 0 },
};
