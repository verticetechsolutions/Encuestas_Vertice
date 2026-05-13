'use client';

// Stepper v5 — Icon Morph Timeline + Continuous Spine (2026-05-09).
// Refinement de v4: el spine pasa de segmentos individuales por <li> a UNA
// línea continua absoluta sobre la cual los iconos se posicionan. La línea
// tiene 2 capas:
//   - Background: hairline continuo de centro-first a centro-last (siempre)
//   - Foreground: fill gold con altura calculada por progreso, transitionado
//     con cubic-bezier(0.16,1,0.3,1) (out-expo) durante 700ms al cambiar el
//     active step.
//
// Los containers de iconos llevan bg SOLID (canvas off-white o navy según
// surface) para enmascarar la línea que pasa naturalmente por detrás. Active
// agrega un span overlay con tint gold/12. Done usa bg-gold solid directo.
//
// Resto se mantiene de v4: iconos semánticos por sección (Lucide), micro-anims
// (halo pulse en active, hover scale en pending, check badge en done).
//
// Sin nuevas deps. Performance: transition sobre height, no JS animation.

import { motion } from 'motion/react';
import {
  BarChart3,
  Check,
  CreditCard,
  Landmark,
  type LucideIcon,
  Send,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { CajasGrupoCount } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const GRUPO_LABEL: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos de crédito',
  numeros_del_negocio: 'Números del negocio',
  operacion: 'Operación y riesgo',
  pricing_y_criterio: 'Pricing y criterio',
  contacto_y_especificos: 'Contacto y específicos',
};

const GRUPO_OUTCOME: Record<GrupoUI, string> = {
  identificacion: 'Quién es tu institución',
  productos_y_mercado: 'Qué ofreces y a quién',
  numeros_del_negocio: 'Tu balance financiero',
  operacion: 'Cómo decides y operas',
  pricing_y_criterio: 'Tu modelo y criterio',
  contacto_y_especificos: 'Datos de seguimiento',
};

const GRUPO_ICON: Record<GrupoUI, LucideIcon> = {
  identificacion: Landmark,
  productos_y_mercado: CreditCard,
  numeros_del_negocio: BarChart3,
  operacion: ShieldCheck,
  pricing_y_criterio: Tag,
  contacto_y_especificos: Send,
};

type Surface = 'light' | 'dark';

interface Props {
  porGrupo: Record<GrupoUI, CajasGrupoCount>;
  activo: GrupoUI;
  surface?: Surface;
}

type Estado = 'done' | 'active' | 'pending';

const TOKENS: Record<Surface, {
  // Cover bg (opaque) — enmascara el spine que pasa detrás
  coverBg: string;
  // Containers
  doneContainerBg: string;
  doneIconColor: string;
  activeContainerTint: string;
  activeContainerRing: string;
  activeContainerHalo: string;
  activeIconColor: string;
  pendingContainerRing: string;
  pendingIconColor: string;
  // Hover
  pendingHoverTintRing: string;
  pendingHoverIcon: string;
  // Done check badge
  doneBadgeBg: string;
  doneBadgeFg: string;
  doneBadgeRing: string;
  // Labels
  labelDone: string;
  labelActive: string;
  labelPending: string;
  outcomeActive: string;
  // Spine continuous
  spineBg: string;
  spineFill: string;
  // Mobile
  mobileEyebrow: string;
  mobileCounter: string;
  mobileTitle: string;
  mobileBarBg: string;
  mobileBarFill: string;
}> = {
  light: {
    coverBg: 'bg-[color:var(--survey-bg)]',
    doneContainerBg: 'bg-[var(--gold-deep)]',
    doneIconColor: 'text-[color:var(--cream-pure)]',
    activeContainerTint: 'bg-[color:var(--gold)]/12',
    activeContainerRing: 'ring-1 ring-[color:var(--gold)]/55',
    activeContainerHalo:
      'after:absolute after:inset-0 after:rounded-xl after:ring-[5px] after:ring-[color:var(--gold)]/15 after:animate-pulse-ring after:pointer-events-none',
    activeIconColor: 'text-[color:var(--gold-deep)]',
    pendingContainerRing:
      'ring-1 ring-inset ring-[color:var(--survey-hairline-strong)]',
    pendingIconColor: 'text-[color:var(--ink)]/45',
    pendingHoverTintRing: 'group-hover:ring-[color:var(--ink)]/22',
    pendingHoverIcon: 'group-hover:text-[color:var(--ink)]/70',
    doneBadgeBg: 'bg-[color:var(--ink)]',
    doneBadgeFg: 'text-[color:var(--gold)]',
    doneBadgeRing: 'ring-2 ring-[color:var(--survey-bg)]',
    labelDone: 'text-[color:var(--ink)]/55',
    labelActive: 'text-[color:var(--ink)]',
    labelPending:
      'text-[color:var(--ink)]/40 group-hover:text-[color:var(--ink)]/70',
    outcomeActive: 'text-[color:var(--ink)]/70',
    spineBg: 'bg-[color:var(--survey-hairline-strong)]',
    spineFill: 'bg-[var(--gold-deep)]',
    mobileEyebrow: 'text-[color:var(--ink)]/45',
    mobileCounter: 'text-[color:var(--ink)]/55',
    mobileTitle: 'text-[color:var(--ink)]',
    mobileBarBg: 'bg-[color:var(--survey-hairline)]',
    mobileBarFill: 'bg-[color:var(--gold-deep)]',
  },
  dark: {
    coverBg: 'bg-[color:var(--survey-card-1)]',
    doneContainerBg: 'bg-[var(--gold)]',
    doneIconColor: 'text-[color:var(--ink)]',
    activeContainerTint: 'bg-[color:var(--gold)]/15',
    activeContainerRing: 'ring-1 ring-[color:var(--gold)]/65',
    activeContainerHalo:
      'after:absolute after:inset-0 after:rounded-xl after:ring-[5px] after:ring-[color:var(--gold)]/25 after:animate-pulse-ring after:pointer-events-none',
    activeIconColor: 'text-[color:var(--gold)]',
    pendingContainerRing:
      'ring-1 ring-inset ring-[color:var(--survey-card-1-hairline-strong)]',
    pendingIconColor: 'text-[color:var(--survey-card-1-fg-faint)]',
    pendingHoverTintRing: 'group-hover:ring-[color:var(--gold)]/35',
    pendingHoverIcon: 'group-hover:text-[color:var(--survey-card-1-fg-muted)]',
    doneBadgeBg: 'bg-[color:var(--ink)]',
    doneBadgeFg: 'text-[color:var(--gold)]',
    doneBadgeRing: 'ring-2 ring-[color:var(--survey-card-1)]',
    labelDone: 'text-[color:var(--survey-card-1-fg-muted)]',
    labelActive: 'text-[color:var(--survey-card-1-fg)]',
    labelPending:
      'text-[color:var(--survey-card-1-fg-faint)] group-hover:text-[color:var(--survey-card-1-fg-muted)]',
    outcomeActive: 'text-[color:var(--survey-card-1-fg)]/85',
    spineBg: 'bg-[color:var(--survey-card-1-hairline-strong)]',
    spineFill: 'bg-[var(--gold)]',
    mobileEyebrow: 'text-[color:var(--survey-card-1-fg-muted)]',
    mobileCounter: 'text-[color:var(--survey-card-1-fg-muted)]',
    mobileTitle: 'text-[color:var(--survey-card-1-fg)]',
    mobileBarBg: 'bg-[color:var(--survey-card-1-hairline)]',
    mobileBarFill: 'bg-[color:var(--gold)]',
  },
};

export function Stepper({ porGrupo, activo, surface = 'light' }: Props) {
  const grupos = GrupoUISchema.options;
  const idxActivo = grupos.indexOf(activo);
  const t = TOKENS[surface];

  const total = grupos.reduce((s, g) => s + porGrupo[g].total, 0);
  const llenas = grupos.reduce((s, g) => s + porGrupo[g].llenas, 0);
  const pct = total > 0 ? Math.round((llenas / total) * 100) : 0;
  const ActiveIcon = GRUPO_ICON[activo];

  // Progress fraction sobre el spine continuo. La línea va de centro-icon-0
  // a centro-icon-last; el fill cubre esa distancia hasta el centro del
  // active. ratio = idxActivo / (steps - 1).
  const progressRatio =
    grupos.length > 1 ? idxActivo / (grupos.length - 1) : 0;

  return (
    <>
      {/* Desktop / tablet: progress global widget + icon morph timeline.
          El widget de arriba muestra el progreso GLOBAL (cajas llenas vs
          total) — info distinta a la del spine (que muestra dónde estás
          en el flow de secciones). Barra animada con motion.div width via
          cubic-bezier out-expo. */}
      <div
        className="hidden md:block mb-6"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso global: ${llenas} de ${total} respuestas`}
      >
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.16em]',
              t.mobileEyebrow
            )}
          >
            Progreso
          </p>
          <p className={cn('text-[11px] font-semibold tabular-nums numeric', t.labelActive)}>
            {llenas}
            <span className={cn('font-normal', t.labelPending)}> / {total}</span>
            <span className={cn('ml-2 font-normal', t.labelPending)}>{pct}%</span>
          </p>
        </div>
        <div className={cn('h-[2px] w-full overflow-hidden rounded-full', t.mobileBarBg)}>
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={cn('h-full rounded-full', t.mobileBarFill)}
            aria-hidden
          />
        </div>
      </div>

      <nav aria-label="Progreso de la entrevista" className="hidden md:block">
        <ol className="relative flex flex-col">
          {/* Spine background — línea hairline continua. Top-4 / bottom-4
              alinea con centro de iconos size-8 (16px desde el borde). */}
          <span
            aria-hidden
            className={cn(
              'absolute left-4 top-4 bottom-4 w-px -translate-x-1/2',
              t.spineBg
            )}
          />
          {/* Spine fill — gold animado, altura calc(progress * available).
              transition-[height] con out-expo para sensación premium. */}
          <span
            aria-hidden
            className={cn(
              'absolute left-4 top-4 w-px -translate-x-1/2 transition-[height] duration-700',
              t.spineFill
            )}
            style={{
              height: `calc((100% - 2rem) * ${progressRatio})`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {grupos.map((g, i) => {
            const grupoCount = porGrupo[g];
            const completo =
              grupoCount.total > 0 && grupoCount.llenas >= grupoCount.total;
            const yaPasado = i < idxActivo;
            const esActivo = g === activo;

            const estado: Estado =
              completo || yaPasado ? 'done' : esActivo ? 'active' : 'pending';

            const isLast = i === grupos.length - 1;
            const Icon = GRUPO_ICON[g];

            return (
              <li
                key={g}
                className={cn(
                  'group relative flex items-start gap-3.5',
                  !isLast && (esActivo ? 'pb-7' : 'pb-5')
                )}
              >
                {/* Icon container — bg solid SIEMPRE (cover) para enmascarar
                    el spine que pasa naturalmente por detrás. Done sobreescribe
                    con gold solid; active agrega un overlay tint encima. */}
                <span
                  aria-current={esActivo ? 'step' : undefined}
                  className={cn(
                    'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ease-out',
                    t.coverBg,
                    estado === 'done' && t.doneContainerBg,
                    estado === 'active' && [
                      t.activeContainerRing,
                      t.activeContainerHalo,
                    ],
                    estado === 'pending' && [
                      t.pendingContainerRing,
                      t.pendingHoverTintRing,
                      'group-hover:scale-[1.04]',
                    ]
                  )}
                >
                  {/* Active tint overlay — sutil capa gold/12 encima del cover */}
                  {estado === 'active' && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-0 rounded-xl',
                        t.activeContainerTint
                      )}
                    />
                  )}

                  <Icon
                    className={cn(
                      'relative size-[15px] transition-colors duration-300',
                      estado === 'done' && t.doneIconColor,
                      estado === 'active' && t.activeIconColor,
                      estado === 'pending' && [
                        t.pendingIconColor,
                        t.pendingHoverIcon,
                      ]
                    )}
                    strokeWidth={
                      estado === 'active' ? 2.25 : estado === 'done' ? 2.25 : 1.75
                    }
                    aria-hidden
                  />

                  {/* Done check badge corner */}
                  {estado === 'done' && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -bottom-1 -right-1 inline-flex size-3.5 items-center justify-center rounded-full animate-fade-up',
                        t.doneBadgeBg,
                        t.doneBadgeRing
                      )}
                    >
                      <Check
                        className={cn('size-2', t.doneBadgeFg)}
                        strokeWidth={4}
                      />
                    </span>
                  )}
                </span>

                {/* Label column */}
                <div className="min-w-0 flex-1 pt-1.5">
                  <p
                    className={cn(
                      'leading-tight tracking-tight transition-all duration-300',
                      estado === 'done' && ['text-[13px] font-medium', t.labelDone],
                      estado === 'active' && [
                        'text-[14px] font-semibold',
                        t.labelActive,
                      ],
                      estado === 'pending' && ['text-[13px] font-medium', t.labelPending]
                    )}
                  >
                    {GRUPO_LABEL[g]}
                  </p>
                  {esActivo && (
                    <p
                      key={`outcome-${g}`}
                      className={cn(
                        'mt-1.5 text-[12.5px] leading-snug tracking-tight animate-fade-up',
                        t.outcomeActive
                      )}
                    >
                      {GRUPO_OUTCOME[g]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: icon container del active + label + outcome + barra lineal */}
      <div className="md:hidden">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
              t.coverBg,
              t.activeContainerRing
            )}
          >
            <span
              aria-hidden
              className={cn('absolute inset-0 rounded-xl', t.activeContainerTint)}
            />
            <ActiveIcon
              className={cn('relative size-4', t.activeIconColor)}
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className={cn('text-eyebrow', t.mobileEyebrow)}>
                Sección {idxActivo + 1} de {grupos.length}
              </p>
              <p className={cn('numeric text-xs', t.mobileCounter)}>
                {pct}% completado
              </p>
            </div>
            <h2 className={cn('mt-0.5 text-display text-base', t.mobileTitle)}>
              {GRUPO_LABEL[activo]}
            </h2>
          </div>
        </div>
        <p className={cn('mt-1.5 text-[12px] pl-12', t.outcomeActive)}>
          {GRUPO_OUTCOME[activo]}
        </p>
        <div className={cn('mt-3 h-px w-full', t.mobileBarBg)}>
          <div
            className={cn('h-full transition-all duration-500 ease-out', t.mobileBarFill)}
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </>
  );
}
