'use client';

// RightRail — sidebar derecho unificado de la encuesta. Reemplaza las 3 cards
// apiladas (Estado del turno + Esta pregunta cubre + Progreso por sección) con
// 2 secciones tipográficas separadas por hairline. Pattern editorial 2026:
// hairlines > shadows, bloques semánticos en lugar de containers visuales.
//
// Decisión 2026-05-09: el spec de refactor cementa "X pendientes" como framing
// positivo (vs "X sin marcar" anterior). Counter "(respondidas/total)" inline
// en el CTA "Enviar turno" para feedback contextual sin rebrand.

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
            <p className="mt-8 text-eyebrow text-foreground/45">
              Esta pregunta cubre
            </p>
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
            'group/send relative mt-8 inline-flex h-12 w-full items-center justify-between gap-2 rounded-full pl-6 pr-2 text-[13.5px] font-medium tracking-tight transition-all',
            'will-change-transform active:scale-[0.99] disabled:cursor-not-allowed',
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
                <span className={cn('numeric', todasMarcadas ? 'text-ink/55' : 'text-cream-pure/55')}>
                  {respondidas}/{total}
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

      {/* Sección 2 — Progreso por sección con divisores hairline + número-display Pitchfork */}
      <section className="border-t border-ink/8 pt-6">
        <p className="text-eyebrow text-foreground/45">Progreso</p>
        <p className="mt-3 text-display text-[36px] leading-[1.0] tracking-[-0.025em] text-foreground numeric">
          {cajasGlobal.llenas}
          <span className="text-foreground/42">/{cajasGlobal.total}</span>
        </p>
        <ul className="mt-6 divide-y divide-ink/8">
          {grupos.map((g) => {
            const { llenas, total: tot } = cajasPorGrupo[g];
            const esActivo = g === grupoActivo;
            return (
              <li
                key={g}
                className={cn(
                  'flex items-center justify-between py-3 text-[14.5px] tracking-tight transition-colors',
                  esActivo
                    ? 'font-medium text-foreground'
                    : 'text-foreground/72'
                )}
              >
                <span>{GRUPO_LABELS[g]}</span>
                <span
                  className={cn(
                    'numeric text-[13px]',
                    esActivo ? 'text-foreground/85' : 'text-foreground/55'
                  )}
                >
                  {llenas}
                  <span className="text-foreground/35">/{tot}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
