'use client';

// Stepper minimalista (Paleta A, 2026-05-09 refactor).
//   - Sin outer pill wrapper. Vive directo en el canvas.
//   - Cada step = dot + label debajo. Hairlines 1px conectan dots.
//   - 3 estados claros: completed (filled gold + check), active (filled ink),
//     pending (outline hairline).
//   - Mobile: fallback a "Sección X de N" + barra lineal (sin scroll horizontal).
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

interface Props {
  porGrupo: Record<GrupoUI, CajasGrupoCount>;
  activo: GrupoUI;
}

type Estado = 'done' | 'active' | 'pending';

export function Stepper({ porGrupo, activo }: Props) {
  const grupos = GrupoUISchema.options;
  const idxActivo = grupos.indexOf(activo);

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
                      estado === 'done' &&
                        'bg-[var(--gold-deep)] text-[color:var(--survey-bg)]',
                      estado === 'active' &&
                        'bg-[color:var(--ink)] text-[color:var(--survey-bg)] ring-4 ring-[color:var(--gold)]/15',
                      estado === 'pending' &&
                        'bg-transparent ring-1 ring-inset ring-[color:var(--survey-hairline-strong)]'
                    )}
                  >
                    {estado === 'done' ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : estado === 'active' ? (
                      <span className="size-1.5 rounded-full bg-[color:var(--gold)]" aria-hidden />
                    ) : null}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-[11.5px] font-medium tracking-tight transition-colors',
                      estado === 'done' &&
                        'text-[color:var(--ink)]/55',
                      estado === 'active' &&
                        'text-[color:var(--ink)]',
                      estado === 'pending' &&
                        'text-[color:var(--ink)]/35'
                    )}
                  >
                    {GRUPO_LABEL[g]}
                  </span>
                </div>

                {/* Hairline conector entre dots — vive entre dot y siguiente li.
                    Gold para tramos ya completados, neutro para upcoming. */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      'mt-2.5 h-px flex-1 mx-2 transition-colors duration-300',
                      i < idxActivo
                        ? 'bg-[color:var(--gold)]/40'
                        : 'bg-[color:var(--survey-hairline)]'
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
          <p className="text-eyebrow text-[color:var(--ink)]/45">
            Sección {idxActivo + 1} de {grupos.length}
          </p>
          <p className="numeric text-xs text-[color:var(--ink)]/55">
            {pct}% completado
          </p>
        </div>
        <h2 className="mt-1 text-display text-lg text-[color:var(--ink)]">
          {GRUPO_LABEL[activo]}
        </h2>
        <div className="mt-3 h-px w-full bg-[color:var(--survey-hairline)]">
          <div
            className="h-full bg-[color:var(--gold-deep)] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </>
  );
}
