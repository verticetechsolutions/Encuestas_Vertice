'use client';

// Stepper minimalista (Paleta A, 2026-05-09 refactor + F5.2 dark surface).
//   - Sin outer pill wrapper. Vive directo dentro de card-1.
//   - Cada step = dot + label debajo. Hairlines 1px conectan dots.
//   - 3 estados claros: completed (filled gold + check), active (filled
//     contextual + halo), pending (outline hairline).
//   - Mobile: fallback a "Sección X de N" + barra lineal.
//   - `surface` prop adapta colores al fondo (light = ink/cream sobre canvas
//     off-white, dark = cream-pure sobre navy ink).
//
// Decisión: este stepper es la ÚNICA fuente de progreso en pantalla. La lista
// de progreso por sección del antiguo RightRail fue eliminada (info duplicada).

import { Check } from 'lucide-react';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { CajasGrupoCount } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const GRUPO_LABEL: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos',
  numeros_del_negocio: 'Números',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing',
  contacto_y_especificos: 'Contacto',
};

type Surface = 'light' | 'dark';

interface Props {
  porGrupo: Record<GrupoUI, CajasGrupoCount>;
  activo: GrupoUI;
  /** Surface contextual del contenedor: 'light' (canvas off-white) o
      'dark' (navy ink). Default 'light'. */
  surface?: Surface;
}

type Estado = 'done' | 'active' | 'pending';

// Token bundles por surface — evita conditional cn() spaghetti en el JSX.
const TOKENS: Record<Surface, {
  doneDotBg: string;
  doneDotFg: string;
  activeDotBg: string;
  activeDotInner: string;
  activeDotHalo: string;
  pendingRing: string;
  labelDone: string;
  labelActive: string;
  labelPending: string;
  connectorDone: string;
  connectorPending: string;
  // Mobile
  mobileEyebrow: string;
  mobileCounter: string;
  mobileTitle: string;
  mobileBarBg: string;
  mobileBarFill: string;
}> = {
  light: {
    doneDotBg: 'bg-[var(--gold-deep)]',
    doneDotFg: 'text-[color:var(--survey-bg)]',
    activeDotBg: 'bg-[color:var(--ink)]',
    activeDotInner: 'bg-[color:var(--gold)]',
    activeDotHalo: 'ring-4 ring-[color:var(--gold)]/15',
    pendingRing: 'ring-1 ring-inset ring-[color:var(--survey-hairline-strong)]',
    labelDone: 'text-[color:var(--ink)]/55',
    labelActive: 'text-[color:var(--ink)]',
    labelPending: 'text-[color:var(--ink)]/35',
    connectorDone: 'bg-[color:var(--gold)]/40',
    connectorPending: 'bg-[color:var(--survey-hairline)]',
    mobileEyebrow: 'text-[color:var(--ink)]/45',
    mobileCounter: 'text-[color:var(--ink)]/55',
    mobileTitle: 'text-[color:var(--ink)]',
    mobileBarBg: 'bg-[color:var(--survey-hairline)]',
    mobileBarFill: 'bg-[color:var(--gold-deep)]',
  },
  dark: {
    doneDotBg: 'bg-[var(--gold)]',
    doneDotFg: 'text-[color:var(--ink)]',
    activeDotBg: 'bg-[color:var(--gold)]',
    activeDotInner: 'bg-[color:var(--ink)]',
    activeDotHalo: 'ring-4 ring-[color:var(--gold)]/25',
    pendingRing: 'ring-1 ring-inset ring-[color:var(--survey-card-1-hairline-strong)]',
    labelDone: 'text-[color:var(--survey-card-1-fg-muted)]',
    labelActive: 'text-[color:var(--survey-card-1-fg)]',
    labelPending: 'text-[color:var(--survey-card-1-fg-faint)]',
    connectorDone: 'bg-[color:var(--gold)]/55',
    connectorPending: 'bg-[color:var(--survey-card-1-hairline)]',
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

  return (
    <>
      {/* Desktop / tablet: dots + hairlines + labels debajo */}
      <nav aria-label="Progreso de la entrevista" className="hidden md:block">
        <ol className="flex items-start">
          {grupos.map((g, i) => {
            const grupoCount = porGrupo[g];
            const completo =
              grupoCount.total > 0 && grupoCount.llenas >= grupoCount.total;
            const yaPasado = i < idxActivo;
            const esActivo = g === activo;

            const estado: Estado =
              completo || yaPasado ? 'done' : esActivo ? 'active' : 'pending';

            const isLast = i === grupos.length - 1;

            return (
              <li
                key={g}
                className={cn('flex items-start', !isLast && 'flex-1')}
              >
                <div className="flex flex-col items-center gap-2.5">
                  {/* Dot */}
                  <span
                    aria-current={esActivo ? 'step' : undefined}
                    className={cn(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out',
                      estado === 'done' && [t.doneDotBg, t.doneDotFg],
                      estado === 'active' && [t.activeDotBg, t.activeDotHalo],
                      estado === 'pending' && ['bg-transparent', t.pendingRing]
                    )}
                  >
                    {estado === 'done' ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : estado === 'active' ? (
                      <span
                        className={cn('size-1.5 rounded-full', t.activeDotInner)}
                        aria-hidden
                      />
                    ) : null}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-[11.5px] font-medium tracking-tight transition-colors',
                      estado === 'done' && t.labelDone,
                      estado === 'active' && t.labelActive,
                      estado === 'pending' && t.labelPending
                    )}
                  >
                    {GRUPO_LABEL[g]}
                  </span>
                </div>

                {/* Hairline conector entre dots — gold/contextual para tramos
                    ya completados, neutro contextual para upcoming. */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      'mt-2.5 h-px flex-1 mx-2 transition-colors duration-300',
                      i < idxActivo ? t.connectorDone : t.connectorPending
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: label + barra lineal */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn('text-eyebrow', t.mobileEyebrow)}>
            Sección {idxActivo + 1} de {grupos.length}
          </p>
          <p className={cn('numeric text-xs', t.mobileCounter)}>
            {pct}% completado
          </p>
        </div>
        <h2 className={cn('mt-1 text-display text-lg', t.mobileTitle)}>
          {GRUPO_LABEL[activo]}
        </h2>
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
