'use client';

// AnimatedArrow — flecha SVG con efecto de "draw" en hover. Las dos paths
// (línea horizontal + chevron arrowhead) se trazan secuencialmente cuando el
// parent motion element entra en estado "hover".
//
// El componente DEPENDE de un parent motion element con variants "rest" y
// "hover" para activarse — la propagación de variants de motion baja por el
// árbol hasta las motion.path internas. Si se usa fuera de un parent motion,
// queda en "rest" (fully drawn) sin animar.
//
// Mantiene proporciones y stroke de Lucide ArrowRight para consistencia
// visual con los demás iconos del admin.

import { motion, type Variants } from 'motion/react';

interface Props {
  className?: string;
}

// Línea horizontal — se traza primero, 500ms ease-out-expo.
const lineVariants: Variants = {
  rest: { pathLength: 1, transition: { duration: 0 } },
  hover: {
    pathLength: [0, 1],
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

// Chevron arrowhead — entra con delay 150ms después de la línea (lectura
// natural: primero el cuerpo de la flecha, luego la punta).
const headVariants: Variants = {
  rest: { pathLength: 1, transition: { duration: 0 } },
  hover: {
    pathLength: [0, 1],
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.15 },
  },
};

export function AnimatedArrow({ className }: Props) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Línea horizontal del cuerpo de la flecha */}
      <motion.path d="M5 12h14" variants={lineVariants} />
      {/* Chevron arrowhead */}
      <motion.path d="m12 5 7 7-7 7" variants={headVariants} />
    </motion.svg>
  );
}
