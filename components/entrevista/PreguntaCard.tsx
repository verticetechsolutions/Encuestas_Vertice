'use client';

// Single pregunta card — fintech minimalist. Estilo:
//   - Card cream con borde sutil, esquinas rounded-2xl
//   - Numerador "P{N}" tabular en bold pequeño + chip de cajas objetivo
//   - Texto pregunta en display (semi-bold, tracking apretado)
//   - Textarea sin borde visible al reposo, ring lime al focus
//   - Footer: autosave indicator (chip con dot animado) + botón Mic + botón
//     "Marcar respondida" pill
//   - Microanimación: chip Respondida hace fade-up con un leve pulse-ring
//     una vez al activarse.

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, Mic, CircleDashed } from 'lucide-react';
import type { Pregunta, AutosaveStatus } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

interface Props {
  pregunta: Pregunta;
  numero: number;
  total: number;
  texto: string;
  marcada: boolean;
  autosave: AutosaveStatus;
  onChangeTexto: (texto: string) => void;
  onToggleMarcada: (marcada: boolean) => void;
}

interface AutosaveLabel {
  text: string;
  tone: 'muted' | 'success' | 'warn';
  pulsing: boolean;
}

function autosaveLabel(status: AutosaveStatus): AutosaveLabel {
  switch (status) {
    case 'pending':
      return { text: 'Por guardar', tone: 'muted', pulsing: true };
    case 'saving':
      return { text: 'Guardando', tone: 'muted', pulsing: true };
    case 'saved':
      return { text: 'Guardado', tone: 'success', pulsing: false };
    case 'error':
      return {
        text: 'Reintentando…',
        tone: 'warn',
        pulsing: true,
      };
    case 'idle':
    default:
      return { text: '', tone: 'muted', pulsing: false };
  }
}

export function PreguntaCard({
  pregunta,
  numero,
  total,
  texto,
  marcada,
  autosave,
  onChangeTexto,
  onToggleMarcada,
}: Props) {
  const [showMicTooltip, setShowMicTooltip] = useState(false);
  const label = autosaveLabel(autosave);

  return (
    <article
      className={cn(
        'group/card relative overflow-hidden rounded-3xl bg-cream ring-1 ring-foreground/5 shadow-sm transition-all duration-300',
        'hover:shadow-md',
        marcada && 'ring-lime/60'
      )}
    >
      {/* Línea lateral lime cuando está marcada — accent visual de progreso */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-1 bg-lime transition-all duration-300 ease-out',
          marcada ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden
      />

      <div className="p-6 md:p-7">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground tabular-nums">
              P{numero.toString().padStart(2, '0')} / {total.toString().padStart(2, '0')}
            </span>
            {pregunta.cajas_objetivo.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2 py-0.5 text-[10px] font-medium tracking-wide text-forest/80">
                {pregunta.cajas_objetivo.length} caja{pregunta.cajas_objetivo.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {marcada && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-lime-foreground',
                'animate-fade-up'
              )}
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              Respondida
            </span>
          )}
        </header>

        <h3 className="text-display text-xl text-foreground md:text-[22px]">
          {pregunta.texto_pregunta}
        </h3>

        <div className="mt-5">
          <Textarea
            value={texto}
            onChange={(e) => onChangeTexto(e.target.value)}
            placeholder="Empieza a escribir o usa el micrófono…"
            rows={4}
            className="min-h-[110px] resize-none rounded-2xl border-0 bg-muted/50 px-4 py-3 text-[15px] leading-relaxed shadow-none transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-forest/40"
            aria-label={`Respuesta a la pregunta ${numero}`}
          />
        </div>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums',
              label.tone === 'success' && 'text-forest',
              label.tone === 'warn' && 'text-amber-700',
              label.tone === 'muted' && 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {label.text && (
              <>
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    label.tone === 'success' && 'bg-forest',
                    label.tone === 'warn' && 'bg-amber-500',
                    label.tone === 'muted' && 'bg-muted-foreground/60',
                    label.pulsing && 'animate-pulse-ring'
                  )}
                  aria-hidden
                />
                <span>{label.text}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mic placeholder — tooltip explica que viene en Fase 6 wiring */}
            <div className="relative">
              <button
                type="button"
                disabled
                onMouseEnter={() => setShowMicTooltip(true)}
                onMouseLeave={() => setShowMicTooltip(false)}
                onFocus={() => setShowMicTooltip(true)}
                onBlur={() => setShowMicTooltip(false)}
                aria-describedby={`mic-tooltip-${pregunta.id}`}
                className={cn(
                  'inline-flex items-center justify-center rounded-full size-9 bg-muted/60 text-muted-foreground/70 ring-1 ring-foreground/10 transition-all',
                  'cursor-not-allowed opacity-60'
                )}
              >
                <Mic className="size-4" />
                <span className="sr-only">Activar micrófono</span>
              </button>
              {showMicTooltip && (
                <div
                  id={`mic-tooltip-${pregunta.id}`}
                  role="tooltip"
                  className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl bg-forest-deep px-3 py-2 text-xs text-primary-foreground shadow-lg animate-fade-up"
                >
                  Disponible al integrar voz (Fase 6).
                </div>
              )}
            </div>

            <Button
              type="button"
              variant={marcada ? 'secondary' : 'default'}
              size="sm"
              onClick={() => onToggleMarcada(!marcada)}
              className={cn(
                'rounded-full px-4 h-9 text-xs font-semibold tracking-tight transition-all',
                marcada
                  ? 'bg-cream text-forest ring-1 ring-forest/20 hover:bg-cream'
                  : 'bg-forest text-primary-foreground hover:bg-forest-soft'
              )}
            >
              {marcada ? (
                <>
                  <CircleDashed className="size-3.5" />
                  Desmarcar
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Marcar respondida
                </>
              )}
            </Button>
          </div>
        </footer>
      </div>
    </article>
  );
}
