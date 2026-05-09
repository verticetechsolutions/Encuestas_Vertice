'use client';

// Panel lateral derecho — fintech minimalist. Estilo:
//   - Card cream con esquinas rounded-3xl, sombra suave
//   - Header con número grande (display) + subtítulo
//   - Lista de 6 grupos con barra mini, conteo y % alineados a la derecha
//   - Highlight para el grupo activo (chip gold-bright tint + ring sutil)
//   - Microanimación: barras se animan con CSS transition cuando cambia llenas
//   - Celebración de cierre: cuando llenas_por_grupo[g] incrementa, el chip
//     del grupo dispara un pulse-ring gold-bright de 900ms (animate-cierre-caja).
//     Esto cierra el TODO de Fase 7 "animación de campos al cerrar caja".
//     Funciona contra el state real (Sonnet incrementa via tool result)
//     y contra el state simulado en /preview/ui.

import { useEffect, useRef, useState } from 'react';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import type { CajasGrupoCount } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const CIERRE_ANIM_MS = 900;

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

  // Trigger de celebración por grupo: cuando llenas[g] incrementa, marcamos
  // el grupo como "celebrando" durante CIERRE_ANIM_MS para que la animación
  // CSS corra una vez. Usamos timestamps en lugar de bool para que disparos
  // consecutivos (varios cierres seguidos) re-monten la animación.
  const prevLlenasRef = useRef<Record<GrupoUI, number>>(
    grupos.reduce((acc, g) => ({ ...acc, [g]: porGrupo[g].llenas }), {} as Record<GrupoUI, number>)
  );
  const [celebrandoTs, setCelebrandoTs] = useState<Partial<Record<GrupoUI, number>>>({});

  useEffect(() => {
    const incrementados: GrupoUI[] = [];
    for (const g of grupos) {
      const prev = prevLlenasRef.current[g];
      const curr = porGrupo[g].llenas;
      if (curr > prev) incrementados.push(g);
      prevLlenasRef.current[g] = curr;
    }
    if (incrementados.length === 0) return;
    const ts = Date.now();
    setCelebrandoTs((prev) => {
      const next = { ...prev };
      for (const g of incrementados) next[g] = ts;
      return next;
    });
    const timeout = setTimeout(() => {
      setCelebrandoTs((prev) => {
        const next = { ...prev };
        for (const g of incrementados) {
          if (next[g] === ts) delete next[g];
        }
        return next;
      });
    }, CIERRE_ANIM_MS + 50);
    return () => clearTimeout(timeout);
    // grupos viene de GrupoUISchema.options (frozen), no necesita estar en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porGrupo]);

  return (
    <aside className="overflow-hidden rounded-3xl bg-cream ring-1 ring-foreground/5 shadow-sm">
      <div className="border-b border-foreground/5 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Progreso
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-display text-[44px] numeric leading-none text-foreground">
            {pctTotal}
          </span>
          <span className="text-display text-2xl text-muted-foreground/70">%</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {totales.llenas} de {totales.total} cajas resueltas
        </p>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-gold-deep transition-all duration-700 ease-out"
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
          const celebrando = celebrandoTs[g];
          return (
            <div
              // key incluye timestamp del último cierre para forzar re-mount
              // del nodo y re-disparar la animación CSS en cierres consecutivos.
              key={celebrando ? `${g}-${celebrando}` : g}
              className={cn(
                'rounded-2xl px-3 py-2.5 transition-all duration-300',
                esActivo
                  ? 'bg-gold-bright/15 ring-1 ring-gold/40'
                  : 'hover:bg-ink/[0.04]',
                celebrando && 'animate-cierre-caja'
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
                <span className="numeric text-[10px] font-medium text-muted-foreground">
                  {llenas}/{total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={GRUPO_LABELS[g]}
                aria-valuemin={0}
                aria-valuemax={total > 0 ? total : 1}
                aria-valuenow={llenas}
                className="h-1 w-full overflow-hidden rounded-full bg-ink/8"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out',
                    esActivo ? 'bg-gold-deep' : 'bg-gold/55'
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
