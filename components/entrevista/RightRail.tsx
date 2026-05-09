'use client';

// RightRail — sidebar derecho unificado de la encuesta. 2 secciones tipográficas
// separadas por hairline: Turno actual (con Tema + CTA) y Progreso (% global +
// % por sección con barras mini). Pattern editorial 2026: hairlines > shadows,
// bloques semánticos en lugar de containers visuales.
//
// Vocabulario user-facing: NUNCA mencionar "cajas" (término interno del motor).
// Decisiones 2026-05-09 con founder:
//   - Progreso global y por sección como % + barras, sin counts absolutos.
//   - "Esta pregunta cubre" → "Tema" para evitar sugerir "campos a llenar".
//   - CTA "Enviar turno (X de N)" en lugar de "X/N" (claridad cero ambigüedad).
//   - "X pendientes" como framing positivo (vs "X sin marcar" anterior).

import { ArrowUpRight, Loader2 } from 'lucide-react';
import { GrupoUISchema, type GrupoUI } from '@/lib/schemas/cajas';
import { getFieldLabel } from '@/lib/cajas-labels';
import type { CajasGrupoCount, EntrevistaStatus } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

const GRUPO_LABELS: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos y mercado',
  numeros_del_negocio: 'Números del negocio',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing y criterio',
  contacto_y_especificos: 'Contacto y específicos',
};

interface Props {
  pendientes: number;
  total: number;
  todasMarcadas: boolean;
  enviando: boolean;
  enError: boolean;
  status: EntrevistaStatus;
  cajasObjetivo: string[];
  cajasGlobal: { llenas: number; total: number };
  cajasPorGrupo: Record<GrupoUI, CajasGrupoCount>;
  grupoActivo: GrupoUI;
  onEnviarBatch: () => void;
}

export function RightRail({
  pendientes,
  total,
  todasMarcadas,
  enviando,
  enError,
  status,
  cajasObjetivo,
  cajasGlobal,
  cajasPorGrupo,
  grupoActivo,
  onEnviarBatch,
}: Props) {
  const grupos = GrupoUISchema.options;
  const respondidas = total - pendientes;

  // Progreso global como porcentaje. Internamente cajasGlobal trackea cajas
  // (term dev), pero al usuario solo le mostramos el %.
  const pctGlobal =
    cajasGlobal.total > 0
      ? Math.round((cajasGlobal.llenas / cajasGlobal.total) * 100)
      : 0;

  return (
    <aside className="sticky top-24 space-y-10">
      {/* Sección 1 — Turno actual + cajas que cubre + CTA Enviar */}
      <section className="border-t border-ink/8 pt-6">
        <p className="text-eyebrow text-foreground/45">Turno actual</p>
        <p className="mt-3 text-display text-[36px] leading-[1.0] tracking-[-0.025em] text-foreground numeric">
          {todasMarcadas ? '¡Listo!' : `${pendientes} pendientes`}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-foreground/65 italic">
          {todasMarcadas
            ? 'La IA generará las próximas preguntas con base en tus respuestas.'
            : 'Marca cada respuesta para habilitar el envío.'}
        </p>

        {cajasObjetivo.length > 0 && (
          <>
            <p className="mt-8 text-eyebrow text-foreground/45">Tema</p>
            <ul className="mt-3 space-y-1.5">
              {cajasObjetivo.map((c) => (
                <li key={c} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-gold"
                  />
                  <span className="text-[14px] leading-snug text-foreground/75">
                    {getFieldLabel(c)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={onEnviarBatch}
          disabled={!todasMarcadas || enviando}
          className={cn(
            'group/send relative mt-8 inline-flex h-12 w-full items-center justify-between gap-2 rounded-full pl-6 pr-2 text-[13.5px] font-medium tracking-tight',
            // Hover/press alineados al landing: micro lift + brightness en
            // hover (160ms outExpo), scale 0.97 en active (100ms iosSheet).
            'transition-all duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            'hover:not-disabled:-translate-y-px hover:not-disabled:brightness-[1.04]',
            'active:not-disabled:scale-[0.97] active:not-disabled:duration-[100ms] active:not-disabled:ease-[cubic-bezier(0.32,0.72,0,1)]',
            'will-change-transform disabled:cursor-not-allowed',
            todasMarcadas && !enError
              ? [
                  'bg-cream-pure text-ink ring-1 ring-ink/8',
                  'shadow-[0_30px_70px_-20px_rgb(200_168_100_/_0.45)]',
                  'hover:bg-white',
                  !enviando && 'animate-pulse-ring',
                ]
              : ['bg-ink text-cream-pure hover:bg-ink-raised disabled:opacity-50']
          )}
        >
          {enviando ? (
            <>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {status === 'enviando' ? 'Enviando…' : 'Procesando…'}
              </span>
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-full bg-gold/20 text-gold-bright"
              >
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          ) : enError ? (
            <>
              Reintentar envío
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-gold transition-transform group-hover/send:rotate-45"
              >
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-2">
                Enviar turno
                <span
                  className={cn(
                    'numeric text-[12.5px]',
                    todasMarcadas ? 'text-ink/55' : 'text-cream-pure/55'
                  )}
                >
                  {respondidas} de {total}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full transition-transform group-hover/send:rotate-45',
                  todasMarcadas ? 'bg-ink text-gold' : 'bg-cream-pure/15 text-cream-pure/55'
                )}
              >
                <ArrowUpRight className="size-4" strokeWidth={2.5} />
              </span>
            </>
          )}
        </button>
      </section>

      {/* Sección 2 — Progreso global y por sección como % + barras.
          User-facing: NUNCA mostrar counts absolutos (que son cajas, term dev). */}
      <section className="border-t border-ink/8 pt-6">
        <p className="text-eyebrow text-foreground/45">Progreso</p>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-display text-[36px] leading-none tracking-[-0.025em] text-foreground numeric">
            {pctGlobal}
          </span>
          <span className="text-display text-[20px] leading-none text-foreground/45">
            %
          </span>
          <span className="ml-1 text-[13px] text-foreground/55">
            completado
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso global de la entrevista"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pctGlobal}
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/8"
        >
          <div
            className="h-full rounded-full bg-gold-deep transition-all duration-700 ease-out"
            style={{ width: `${pctGlobal}%` }}
            aria-hidden
          />
        </div>

        <ul className="mt-6 space-y-4">
          {grupos.map((g) => {
            const { llenas, total: tot } = cajasPorGrupo[g];
            const pctGrupo = tot > 0 ? Math.round((llenas / tot) * 100) : 0;
            const esActivo = g === grupoActivo;
            return (
              <li key={g}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'text-[14px] tracking-tight transition-colors',
                      esActivo
                        ? 'font-medium text-foreground'
                        : 'text-foreground/72'
                    )}
                  >
                    {GRUPO_LABELS[g]}
                  </span>
                  <span
                    className={cn(
                      'numeric text-[12px]',
                      esActivo ? 'text-foreground/75' : 'text-foreground/45'
                    )}
                  >
                    {pctGrupo}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progreso de ${GRUPO_LABELS[g]}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pctGrupo}
                  className="h-1 w-full overflow-hidden rounded-full bg-ink/8"
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      esActivo ? 'bg-gold-deep' : 'bg-gold/55'
                    )}
                    style={{ width: `${pctGrupo}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
