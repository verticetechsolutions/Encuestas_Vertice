'use client';

// Form de consent para el preview v2 — paridad funcional con
// `ConsentimientoForm` original (checkbox + CTA con transition), pero
// estilado al Design System admin (cream-pure card, ink CTA pill, gold-deep
// accent). En preview el server action falla silenciosamente porque
// sesion_id es dummy; eso es esperado, el objetivo aquí es visual.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { registrarConsentimiento } from '@/app/actions/sesiones';

export function ConsentFormV2({ sesion_id }: { sesion_id: string }) {
  const [aceptado, setAceptado] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onContinuar = () => {
    startTransition(async () => {
      await registrarConsentimiento(sesion_id);
      router.push(`/entrevista/${sesion_id}`);
    });
  };

  const canContinue = aceptado && !isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* Checkbox custom — pill row, hover affordance, check draw on toggle */}
      <label
        className="group/checkbox flex cursor-pointer items-start gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-foreground/[0.025] focus-within:bg-foreground/[0.03]"
      >
        <input
          type="checkbox"
          checked={aceptado}
          onChange={(e) => setAceptado(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`squircle relative mt-[2px] flex size-[22px] shrink-0 items-center justify-center rounded-md ring-1 transition-all ${
            aceptado
              ? 'bg-ink ring-ink'
              : 'bg-cream-pure ring-foreground/20 group-hover/checkbox:ring-foreground/35'
          }`}
        >
          {aceptado && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 460, damping: 24 }}
              className="flex"
            >
              <Check
                className="size-[14px] text-cream-pure"
                strokeWidth={3}
              />
            </motion.span>
          )}
        </span>
        <span className="text-[14px] leading-relaxed text-foreground/85">
          He leído el aviso de privacidad y otorgo mi consentimiento para
          el tratamiento de los datos de esta entrevista bajo los términos
          descritos.
        </span>
      </label>

      {/* CTA — pill ink minimalista. Una sola microanimación: la flecha
          se REDIBUJA via SVG `pathLength` keyframes [0,1] al entrar el hover
          (mismo patrón que `ChevronDrawIcon` del admin SectionCard). Stagger
          de 50ms entre el shaft y el arrowhead, duration 280ms cada uno
          (~330ms total) con ease-out-quart [0.22,1,0.36,1] para que sienta
          snappy, no perezoso. Idle se mantiene `pathLength: 1` para que en
          reposo la flecha esté completa. Bg pasa de ink a ink-raised en
          hover (color shift sutil), scale 0.985 en press. Sin lift, sin
          sweep, sin glow expandido — el SVG draw es el único punto focal y
          referencia el lenguaje del resto del producto. */}
      <motion.button
        type="button"
        disabled={!canContinue}
        onClick={onContinuar}
        initial="idle"
        whileHover={canContinue ? 'hover' : undefined}
        whileTap={canContinue ? 'tap' : undefined}
        variants={{
          idle: { scale: 1 },
          hover: { scale: 1 },
          tap: { scale: 0.985 },
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={`squircle group/cta inline-flex h-12 items-center justify-center gap-2.5 self-stretch rounded-full px-6 text-[14px] font-semibold tracking-tight transition-colors duration-300 ${
          canContinue
            ? 'bg-ink text-cream-pure shadow-[0_0_0_1px_rgb(10_15_28/0.04),0_18px_44px_-22px_rgb(200_168_100/0.40)] hover:bg-[var(--ink-raised)]'
            : 'cursor-not-allowed bg-foreground/[0.06] text-foreground/40'
        }`}
      >
        <span>{isPending ? 'Iniciando…' : 'Iniciar entrevista'}</span>

        {canContinue && !isPending && (
          <ArrowDrawIcon />
        )}
      </motion.button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ArrowDrawIcon — flecha SVG con animación `pathLength` draw.
//
// Hereda el variant del padre `motion.button` (idle | hover | tap). En `idle`
// las dos paths quedan completas (pathLength: 1). En `hover` arranca un
// keyframe [0, 1] que redibuja primero el shaft horizontal y, con 80ms de
// delay, el arrowhead — la flecha se siente como si "avanzara" cuando el
// cursor entra. Easing cubic-bezier(0.65, 0, 0.35, 1) — el mismo del
// ChevronDrawIcon del admin SectionCard para mantener coherencia kinética.
// ────────────────────────────────────────────────────────────────────────────
function ArrowDrawIcon() {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M5 12h14"
        variants={{
          idle: { pathLength: 1, transition: { duration: 0 } },
          hover: {
            pathLength: [0, 1],
            transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
          },
          tap: { pathLength: 1, transition: { duration: 0 } },
        }}
      />
      <motion.path
        d="m13 5 7 7-7 7"
        variants={{
          idle: { pathLength: 1, transition: { duration: 0 } },
          hover: {
            pathLength: [0, 1],
            transition: {
              duration: 0.28,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            },
          },
          tap: { pathLength: 1, transition: { duration: 0 } },
        }}
      />
    </motion.svg>
  );
}
