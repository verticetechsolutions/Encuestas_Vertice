'use client';

// Right-side panel showing aggregate caja completion by grupo_ui (6 groups).
// Per IMPLEMENTATION.md §8.2: NO mostrar las cajas individuales — solo agregados.
// On móvil colapsa a un disclosure (details/summary) para no comer espacio.

import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { CajasGrupoCount } from '@/lib/state/entrevista';

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
}

export function PanelProgreso({ porGrupo }: Props) {
  const totales = GrupoUISchema.options.reduce(
    (acc, g) => {
      acc.llenas += porGrupo[g].llenas;
      acc.total += porGrupo[g].total;
      return acc;
    },
    { llenas: 0, total: 0 }
  );
  const pctTotal = totales.total > 0 ? Math.round((totales.llenas / totales.total) * 100) : 0;

  return (
    <aside className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-heading text-base font-medium">Progreso</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {totales.llenas} / {totales.total}
        </span>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pctTotal}%` }}
          aria-hidden
        />
      </div>
      <p className="mb-6 text-xs text-muted-foreground">
        Cajas llenas: {pctTotal}% del total aplicable a tu institución.
      </p>

      <div className="space-y-4">
        {GrupoUISchema.options.map((g) => {
          const { llenas, total } = porGrupo[g];
          const pct = total > 0 ? Math.round((llenas / total) * 100) : 0;
          // We render a plain DIV-based bar instead of @base-ui Progress
          // because the panel summary needs both label and value side-by-side
          // (ProgressValue only accepts a render function for `children`).
          return (
            <div key={g}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm">{GRUPO_LABELS[g]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {llenas}/{total} ({pct}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={GRUPO_LABELS[g]}
                aria-valuemin={0}
                aria-valuemax={total > 0 ? total : 1}
                aria-valuenow={llenas}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Por privacidad solo mostramos las 6 secciones agregadas, no cada caja
        individual.
      </p>
    </aside>
  );
}
