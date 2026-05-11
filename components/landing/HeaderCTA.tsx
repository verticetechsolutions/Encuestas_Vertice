'use client';

// CTA del header con spring physics — el chip dorado se expande hasta llenar
// todo el botón al hover; el texto cream invierte a navy; el arrow rota 45°.
// Diferentes springs por capa para que el resultado se sienta multi-layered.
// Click abre el modal con menú de selección (acceder / solicitar).

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { MouseEvent } from 'react';

import { springs } from '@/lib/design-system/motion/springs';

// Alias semánticos. SPRING_ARROW se queda inline porque damping=18 no
// matchea ningún preset y refactorearlo arriesga cambiar el feel.
// Wave 2 evalúa si agregar arrowSnap a springs.ts.
const SPRING_FILL = springs.elegant;
const SPRING_ARROW = { type: 'spring' as const, stiffness: 520, damping: 18, mass: 0.4 };
const SPRING_TEXT = { type: 'spring' as const, stiffness: 380, damping: 26 };

export function HeaderCTA({ onClick }: { onClick: (e: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap="tap"
      className="pointer-events-auto group/cta relative isolate inline-flex h-10 items-center overflow-hidden rounded-full border border-[#F4F1EA]/15 bg-[#0A0F1C]/55 backdrop-blur-xl"
    >
      <motion.span
        aria-hidden
        variants={{
          rest: { scaleX: 0, originX: 1 },
          hover: { scaleX: 1, originX: 1 },
          tap: { scaleX: 1, originX: 1 },
        }}
        transition={SPRING_FILL}
        className="absolute inset-0 -z-10 rounded-full bg-[#C8A864]"
        style={{ originX: 1 }}
      />

      <span className="relative flex h-full items-center gap-2 pl-3.5 pr-1.5 text-[12px] font-medium">
        <motion.span
          variants={{
            rest: { color: 'rgba(244,241,234,0.85)', x: 0 },
            hover: { color: '#0A0F1C', x: -1 },
            tap: { color: '#0A0F1C', x: -2 },
          }}
          transition={SPRING_TEXT}
          className="hidden sm:inline"
        >
          Acceder
        </motion.span>

        <motion.span
          aria-hidden
          variants={{
            rest: { rotate: 0, scale: 1, backgroundColor: '#C8A864', color: '#0A0F1C' },
            hover: { rotate: 45, scale: 1.06, backgroundColor: '#0A0F1C', color: '#F2D89C' },
            tap: { rotate: 45, scale: 0.92, backgroundColor: '#0A0F1C', color: '#F2D89C' },
          }}
          transition={SPRING_ARROW}
          className="inline-flex size-7 items-center justify-center rounded-full"
        >
          <ArrowUpRight className="size-3.5" strokeWidth={2.5} />
        </motion.span>
      </span>
    </motion.button>
  );
}
