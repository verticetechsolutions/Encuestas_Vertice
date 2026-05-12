'use client';

// SectionCard — contenedor colapsable del admin con animaciones spring.
//
// Reemplaza el patrón native <details>/<summary> con state controlado para
// poder animar suavemente el expand/collapse (height + opacity con spring).
// El native details snap-toggles sin transición; aquí buscamos sensación
// premium: chevron rota 180° con spring, contenido se desliza con un height
// spring "weighty" (mass 0.9, damping 32) y opacity con leve delay para que
// el contenido aparezca DESPUÉS de que la altura empieza a expandirse
// (opening) y desaparezca ANTES en el collapse.
//
// Hover affordance:
// - Container del chevron: tinte gold-bright + color gold-deep (group-hover)
// - Chevron icon: micro bounce direction-aware — cuando está cerrado y
//   hover → y +2 (sugiere "tirar hacia abajo / abrir"); cuando está abierto
//   y hover → y -2 (sugiere "subir / cerrar").

import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';

interface Props {
  /** Eyebrow microcap arriba del título. */
  eyebrow?: string;
  /** Título de la sección. */
  title: string;
  /** Conteo numérico mostrado a la derecha (alternativa a rightHint). */
  count?: number;
  /** Hint custom a la derecha (overrideea count). */
  rightHint?: string;
  /** Estado inicial. Default open. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionCard({
  eyebrow,
  title,
  count,
  rightHint,
  defaultOpen = true,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHovered, setIsHovered] = useState(false);
  const hint =
    rightHint ?? (typeof count === 'number' ? `${count}` : undefined);

  return (
    <section className="squircle shadow-card-elevated relative isolate overflow-hidden rounded-3xl bg-cream-pure ring-1 ring-foreground/[0.04]">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-expanded={isOpen}
        aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="group/section flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-foreground/[0.02] focus-visible:bg-foreground/[0.025] focus-visible:outline-none md:px-6 md:py-5"
      >
        <div className="flex flex-col gap-1">
          {eyebrow && (
            <span className="text-eyebrow text-foreground/45">{eyebrow}</span>
          )}
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {hint && (
            <motion.span
              animate={{ opacity: isHovered ? 0.85 : 0.55 }}
              transition={{ duration: 0.15 }}
              className="font-mono text-[12px] tabular-nums text-foreground"
            >
              {hint}
            </motion.span>
          )}
          {/* Chevron container — bg/color shift on hover via Tailwind. Spring
              animation on the inner motion para rotate + bounce y direction-
              aware. El SVG path se "redibuja" en cada hover entry (pathLength
              0→1) para reforzar la affordance de interactividad. */}
          <span
            className="flex size-8 items-center justify-center rounded-full bg-transparent text-foreground/55 transition-colors duration-200 group-hover/section:bg-[color-mix(in_srgb,var(--gold-bright)_18%,transparent)] group-hover/section:text-gold-deep"
            aria-hidden
          >
            <motion.span
              animate={{
                rotate: isOpen ? 180 : 0,
                y: isHovered ? (isOpen ? -2 : 2) : 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 22,
                mass: 0.6,
              }}
              className="flex"
            >
              <ChevronDrawIcon isHovered={isHovered} />
            </motion.span>
          </span>
        </div>
      </button>

      {/* Contenido — height + opacity spring. Mantenemos el children montado
          (initial={false}) para preservar estado interno de nested details. */}
      <motion.div
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{
          height: {
            type: 'spring',
            stiffness: 280,
            damping: 32,
            mass: 0.9,
          },
          opacity: {
            duration: isOpen ? 0.25 : 0.12,
            delay: isOpen ? 0.08 : 0,
          },
        }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-3 pb-3 md:px-4 md:pb-4">{children}</div>
      </motion.div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ChevronDrawIcon — chevron SVG inline con animación de "draw" en hover.
// pathLength keyframes [0, 1] al entrar el hover; al salir, vuelve a pathLength
// 1 sin transición (snap a estado completo) para no dejar el path a medio
// dibujar. Stroke con linecap/linejoin round para que el trazo se vea suave
// durante el draw.
// ────────────────────────────────────────────────────────────────────────────
function ChevronDrawIcon({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="idle"
      animate={isHovered ? 'hover' : 'idle'}
    >
      <motion.path
        d="M6 9 L12 15 L18 9"
        variants={{
          idle: { pathLength: 1, transition: { duration: 0 } },
          hover: {
            pathLength: [0, 1],
            transition: { duration: 0.55, ease: [0.65, 0, 0.35, 1] },
          },
        }}
      />
    </motion.svg>
  );
}
