'use client';

// Stepper horizontal de los 6 grupos UI. Cada chip es un pill que cambia
// según estado: pendiente (cream/outline), activo (cream-pure + ring gold),
// completado (ink sólido + checkmark gold). Microanimación: hover scale leve,
// focus ring gold, chip activo pulsa una vez al cambiar.
//
// Decisión: en móvil colapsa a "Sección X de 6 — <nombre>" con barra
// progress lineal abajo, no scroll horizontal de chips (genera fricción
// para ver dónde estás).

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

export function Stepper({ porGrupo, activo }: Props) {
  const grupos = GrupoUISchema.options;
  const idxActivo = grupos.indexOf(activo);

  // Total y completados para la barra móvil.
  const total = grupos.reduce((s, g) => s + porGrupo[g].total, 0);
  const llenas = grupos.reduce((s, g) => s + porGrupo[g].llenas, 0);
  const pct = total > 0 ? Math.round((llenas / total) * 100) : 0;

  return (
    <>
      {/* Desktop / tablet: chips horizontales con paleta ink/gold landing. */}
      <nav aria-label="Progreso de la entrevista" className="hidden md:block">
        <ol className="flex items-center gap-1 rounded-full bg-cream-pure p-1.5 ring-1 ring-ink/8 shadow-sm">
          {grupos.map((g, i) => {
            const grupoCount = porGrupo[g];
            const completo =
              grupoCount.total > 0 && grupoCount.llenas >= grupoCount.total;
            const esActivo = g === activo;
            const yaPasado = i < idxActivo;

            const estado =
              completo || yaPasado ? 'done' : esActivo ? 'active' : 'pending';

            return (
              <li key={g} className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium tracking-tight transition-all duration-300 ease-out lg:px-3 lg:text-sm',
                    estado === 'done' && 'bg-ink text-cream-pure shadow-sm',
                    estado === 'active' &&
                      'bg-cream-pure text-ink shadow-sm ring-1 ring-gold/40 scale-[1.02]',
                    estado === 'pending' && 'text-foreground/45 hover:text-foreground'
                  )}
                  aria-current={esActivo ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition-colors',
                      estado === 'done' && 'bg-gold text-ink',
                      estado === 'active' && 'bg-ink text-gold',
                      estado === 'pending' &&
                        'bg-ink/[0.04] text-foreground/55 ring-1 ring-ink/10'
                    )}
                  >
                    {estado === 'done' ? <Check className="size-3" /> : i + 1}
                  </span>
                  {/* Label visible en lg+ siempre. En md sólo el activo
                      muestra label para conservar contexto sin desbordar. */}
                  <span
                    className={cn(
                      'whitespace-nowrap',
                      esActivo ? 'inline' : 'hidden lg:inline'
                    )}
                  >
                    {GRUPO_LABEL[g]}
                  </span>
                </div>
                {i < grupos.length - 1 && (
                  <span
                    className={cn(
                      'h-px w-2 transition-colors duration-300 lg:w-3',
                      i < idxActivo ? 'bg-gold/45' : 'bg-ink/12'
                    )}
                    aria-hidden
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
          <p className="text-eyebrow text-foreground/45">
            Sección {idxActivo + 1} de {grupos.length}
          </p>
          <p className="text-xs tabular-nums text-foreground/55">
            {pct}% completado
          </p>
        </div>
        <h2 className="mt-1 text-display text-lg">{GRUPO_LABEL[activo]}</h2>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full bg-gold transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </>
  );
}
