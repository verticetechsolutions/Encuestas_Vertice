'use client';

// useTicker — animated number with ease-out-expo, reduced-motion aware.
//
// Devuelve un MotionValue<string> que se renderiza vía <motion.span>{ticker}</motion.span>
// El update del texto pasa direct al DOM (sin re-render de React) gracias a
// useTransform, así que es performante incluso con varios tickers simultáneos.
//
// Spec final del dashboard: ease-out-expo 1.4s, NO spring (springs sobreshootean
// y para dinero/percentajes leen mal). Reduced motion → set inmediato del valor.

import { useEffect } from 'react';
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';

interface TickerOptions {
  /** Duración del ease en segundos. Default 1.4. */
  duration?: number;
  /** Formatter del number antes de renderizar. Default toString integer. */
  format?: (n: number) => string;
  /** Valor inicial. Default 0. */
  from?: number;
}

export function useTicker(
  to: number,
  options: TickerOptions = {}
): MotionValue<string> {
  const {
    duration = 1.4,
    format = (n: number) => Math.round(n).toString(),
    from = 0,
  } = options;

  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(from);
  const text = useTransform(motionValue, (v) => format(v));

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(to);
      return;
    }
    const controls = animate(motionValue, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [to, duration, reduceMotion, motionValue]);

  return text;
}
