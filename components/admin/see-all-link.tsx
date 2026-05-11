'use client';

// SeeAllLink — CTA inline para "Ver todas/todos" con flecha que se traza
// (draw animation) al hacer hover. Encapsula Link + motion + AnimatedArrow.
//
// Uso:
//   <SeeAllLink href="/admin/sesiones" className="text-gold-deep">
//     Ver todas
//   </SeeAllLink>
//
// El styling del texto se pasa vía className (color, font-size, font-family,
// etc.) para que cada zona del dashboard pueda usar su propio tono — el
// component solo se encarga del comportamiento interactivo + flecha animada.

import Link from 'next/link';
import { motion } from 'motion/react';
import { AnimatedArrow } from './animated-arrow';

// MotionLink — Next Link convertido en motion element para que whileHover /
// whileFocus disparen variant propagation hacia AnimatedArrow.
const MotionLink = motion.create(Link);

interface Props {
  href: string;
  /** Estilo del texto del CTA (color, font, size). */
  className?: string;
  /** Estilo de la flecha (default size-3 = 12×12px). */
  arrowClassName?: string;
  children: React.ReactNode;
}

export function SeeAllLink({
  href,
  className = '',
  arrowClassName = 'size-3',
  children,
}: Props) {
  return (
    <MotionLink
      href={href}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      className={`inline-flex items-center gap-1 outline-none ${className}`}
    >
      <span>{children}</span>
      <AnimatedArrow className={arrowClassName} />
    </MotionLink>
  );
}
