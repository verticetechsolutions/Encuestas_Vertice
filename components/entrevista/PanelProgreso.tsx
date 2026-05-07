'use client';

// Panel lateral derecho — fintech minimalist. Estilo:
//   - Card cream con esquinas rounded-3xl, sombra suave
//   - Header con número grande (display) + subtítulo
//   - Lista de 6 grupos con barra mini, conteo y % alineados a la derecha
//   - Highlight para el grupo activo (chip lime + ring sutil)
//   - Microanimación: barras se animan con CSS transition cuando cambia llenas

import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { CajasGrupoCount } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const GRUPO_LABELS: Record<GrupoUI, string> = {
  identificacion: 'Identificación',
  productos_y_mercado: 'Productos y mercado',
  numeros_del_negocio: 'Números del negocio',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing y criterio',
  contacto_y_especificos: 'Contacto y específicos',
};

interface Props {
  porGrupo: Record<GrupoUI, CajasGrupoCount>;
  grupoActivo: GrupoUI;
}

export function PanelProgreso({ porGrupo, grupoActivo }: Props) {
  const grupos = GrupoUISchema.options;
  const totales = grupos.reduce(
    (acc, g) => {
      acc.llenas += porGrupo[g].llenas;
      acc.total += porGrupo[g].total;
      return acc;
    },
    { llenas: 0, total: 0 }
  );
  const pctTotal =
    totales.total > 0 ? Math.round((totales.llenas / totales.total) * 100) : 0;

  return (
    <aside className="overflow-hidden rounded-3xl bg-cream ring-1 ring-foreground/5 shadow-sm">
      <div className="border-b border-foreground/5 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Progreso
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-display text-[44px] tabular-nums leading-none text-foreground">
            {pctTotal}
          </span>
          <span className="text-display text-2xl text-muted-foreground/70">%</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {totales.llenas} de {totales.total} cajas resueltas
        </p>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-forest transition-all duration-700 ease-out"
            style={{ width: `${pctTotal}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {grupos.map((g) => {
          const { llenas, total } = porGrupo[g];
          const pct = total > 0 ? Math.round((llenas / total) * 100) : 0;
          const esActivo = g === grupoActivo;
          return (
            <div
              key={g}
              className={cn(
                'rounded-2xl px-3 py-2.5 transition-all duration-300',
                esActivo
                  ? 'bg-lime/35 ring-1 ring-lime/40'
                  : 'hover:bg-muted/40'
              )}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'text-[13px] font-medium tracking-tight',
                    esActivo ? 'text-foreground' : 'text-foreground/85'
                  )}
                >
                  {GRUPO_LABELS[g]}
                </span>
                <span className="text-[10px] tabular-nums font-medium text-muted-foreground">
                  {llenas}/{total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={GRUPO_LABELS[g]}
                aria-valuemin={0}
                aria-valuemax={total > 0 ? total : 1}
                aria-valuenow={llenas}
                className="h-1 w-full overflow-hidden rounded-full bg-foreground/8"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out',
                    esActivo ? 'bg-forest' : 'bg-forest/55'
                  )}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-foreground/5 px-6 py-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Por privacidad solo mostramos las 6 secciones agregadas, no cada caja
          individual.
        </p>
      </div>
    </aside>
  );
}
