'use client';

// MotionConfig provider para el admin scope. Single-source-of-truth para:
// - reducedMotion: respeta prefers-reduced-motion del OS automáticamente
//   (disables transform + layout, preserva opacity/color). Más confiable
//   que pedir a cada componente que use useReducedMotion individualmente.
// - Default transition: spring elegant (380/26/0.5) — se aplica a cualquier
//   motion.* component que no especifique su propia transition. Asegura
//   consistencia visual entre microinteractions sin tener que recordarlo.

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function AdminMotionProvider({ children }: Props) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        mass: 0.5,
      }}
    >
      {children}
    </MotionConfig>
  );
}
