'use client';

// HeroLine — capa única. La palabra activa cambia de color (cream → gold)
// y crece levemente vía scale. Sin gradient, sin glow, sin halo.

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface BaseProps {
  n: 1 | 2 | 3;
  text: string;
  baseDelay?: number;
  className?: string;
  /** Color base de la línea cuando NO está activa. */
  baseColor?: string;
  /** Stagger por carácter (la línea final). */
  charStagger?: boolean;
  charStep?: number;
  style?: CSSProperties;
}

export function HeroLine({
  n,
  text,
  baseDelay = 0,
  charStagger = false,
  charStep = 42,
  className,
  baseColor = 'rgba(244,241,234,0.95)',
  style,
}: BaseProps) {
  const words = text.split(' ');
  const chars = Array.from(text);

  return (
    <span
      data-line-wrap={n}
      className={cn('block', className)}
      style={{ display: 'block', color: baseColor, ...style }}
    >
      {charStagger
        ? chars.map((c, i) => (
            <span
              key={`${i}`}
              aria-hidden={i > 0}
              className="ln-char"
              style={{ animationDelay: `${baseDelay + i * charStep}ms` }}
            >
              {/* NBSP en lugar de space — los chars en inline-block colapsan
                  espacios normales y desaparecen visualmente. */}
              {c === ' ' ? ' ' : c}
            </span>
          ))
        : words.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="ln-word-mask"
              style={{ marginRight: i === words.length - 1 ? 0 : '0.28em' }}
            >
              <span style={{ animationDelay: `${baseDelay + i * 90}ms` }}>{w}</span>
            </span>
          ))}
    </span>
  );
}
