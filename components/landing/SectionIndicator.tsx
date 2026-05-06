'use client';

// Indicador vertical de secciones — vive fixed en el margen DERECHO a media
// altura. Orden de derecha a izquierda: número → línea → label. La línea se
// extiende y el label fade-in cuando la sección está activa. Spring physics
// en cada transición vía motion. Scroll % discreto al pie.
//
// Detección por scroll % (no IntersectionObserver — el pin del hero rompe
// el observer manteniendo hero siempre intersecting).

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const SECTIONS = [
  { id: 'hero', num: '01', label: 'Producto' },
  { id: 'brief', num: '02', label: 'Brief' },
  { id: 'cierre', num: '03', label: 'Cierre' },
] as const;

const SPRING = { type: 'spring' as const, stiffness: 360, damping: 26 };
const SPRING_LINE = { type: 'spring' as const, stiffness: 300, damping: 24 };

export function SectionIndicator() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const v = total > 0 ? window.scrollY / total : 0;
      setPct(Math.max(0, Math.min(100, Math.round(v * 100))));
      // Hero ~0–38% del scroll (pin +110%), brief ~38–78%, cierre 78%+
      setActiveIdx(v < 0.38 ? 0 : v < 0.78 ? 1 : 2);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <aside
      className="pointer-events-none fixed right-6 top-1/2 z-20 hidden -translate-y-1/2 lg:block"
      style={{ animation: 'ln-fade-in 1s 0.8s both' }}
      aria-label="Navegación de secciones"
    >
      <ol className="flex flex-col items-end gap-6">
        {SECTIONS.map((s, i) => {
          const isActive = i === activeIdx;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="pointer-events-auto group flex items-center justify-end gap-3"
                aria-current={isActive ? 'true' : undefined}
              >
                {/* Label primero (a la izquierda) */}
                <motion.span
                  className="font-mono text-[10px] uppercase tracking-[0.26em] whitespace-nowrap"
                  initial={false}
                  animate={{
                    opacity: isActive ? 1 : 0,
                    x: isActive ? 0 : 6,
                    color: isActive
                      ? 'rgba(244,241,234,0.85)'
                      : 'rgba(244,241,234,0)',
                  }}
                  transition={SPRING}
                >
                  {s.label}
                </motion.span>

                {/* Línea horizontal — crece desde el número hacia la izquierda */}
                <motion.span
                  aria-hidden
                  className="block h-px"
                  initial={false}
                  animate={{
                    width: isActive ? 40 : 14,
                    backgroundColor: isActive
                      ? '#C8A864'
                      : 'rgba(244,241,234,0.18)',
                  }}
                  transition={SPRING_LINE}
                />

                {/* Número en el extremo derecho */}
                <motion.span
                  className="font-mono text-[10px] uppercase tracking-[0.26em] tabular-nums"
                  animate={{
                    color: isActive ? '#C8A864' : 'rgba(244,241,234,0.32)',
                  }}
                  transition={SPRING}
                >
                  {s.num}
                </motion.span>
              </a>
            </li>
          );
        })}
      </ol>

      {/* Scroll progress al pie del strip — alineado a la derecha */}
      <div className="mt-10 flex items-center justify-end gap-2.5 pr-1">
        <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-[#F4F1EA]/45">
          {pct.toString().padStart(2, '0')}
          <span className="text-[#F4F1EA]/25">%</span>
        </span>
        <motion.span
          className="inline-block h-1 w-1 rounded-full bg-[#C8A864]"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </aside>
  );
}
