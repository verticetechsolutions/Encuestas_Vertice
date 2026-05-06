'use client';

// Link de footer con chevron right tilted que aparece al hover.
// motion (framer-motion) maneja el spring; el chevron entra desde la izquierda,
// rota -45deg, y se asienta con bounce sutil.

import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode, MouseEvent } from 'react';

interface BaseProps {
  children: ReactNode;
  className?: string;
}

type FooterLinkProps = BaseProps &
  ({ href: string; onClick?: never } | { href?: never; onClick: (e: MouseEvent<HTMLButtonElement>) => void });

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 22, mass: 0.6 };

const variants = {
  rest: { opacity: 0, x: -10, rotate: 0, scale: 0.7 },
  hover: { opacity: 1, x: 0, rotate: -45, scale: 1 },
};

const labelVariants = {
  rest: { x: 0 },
  hover: { x: 4 },
};

function Chevron() {
  return (
    <motion.svg
      variants={variants}
      transition={SPRING}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="text-[#C8A864]"
      style={{ originX: 0.5, originY: 0.5 }}
    >
      <path
        d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export function FooterLink(props: FooterLinkProps) {
  const inner = (
    <motion.span
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      className={`group inline-flex items-center gap-1.5 ${props.className ?? ''}`}
    >
      <motion.span variants={labelVariants} transition={SPRING}>
        {props.children}
      </motion.span>
      <Chevron />
    </motion.span>
  );

  if ('href' in props && props.href) {
    return (
      <Link
        href={props.href}
        className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/55 transition-colors hover:text-[#F4F1EA]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#F4F1EA]/55 transition-colors hover:text-[#F4F1EA]"
    >
      {inner}
    </button>
  );
}
