'use client';

// HeroPregunta — pregunta como protagonista absoluto de la pantalla.
// Estilo:
//   - Card cream rounded-[32px], generosísimo padding (md:p-12)
//   - Eyebrow chip "P01 · Sección Productos" (meta pequeña arriba)
//   - Pregunta gigante (text-3xl → 5xl), display tracking apretado
//   - Cajas objetivo como chips inline (forest/8 ring forest/10)
//   - Textarea sin bordes visibles, min-h grande, focus ring lime
//   - Footer ancho: autosave indicator izq + mic + Marcar respondida der
//   - Microanimación: cambia con animate-fade-up (key={pregunta.id} en wrapper)
//
// STT (Fase 6): cuando `sttEnabled=true`, monta el flujo Deepgram (idle hasta
// que el usuario pulsa el mic). Cada segmento finalizado se concatena al texto
// vía onChangeTexto; el interim se muestra como preview gris debajo del
// textarea. Cambio de pregunta (pregunta.id) detiene el stream y resetea el
// tracker de append. En preview (`sttEnabled=false`) el botón se renderiza
// disabled con tooltip — /api/stt/token requiere cookie real, no funciona en
// /preview/ui.

import { useEffect, useRef, useState } from 'react';
import { Check, CircleDashed, Mic, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/stt/MicButton';
import { useDeepgramStream } from '@/lib/stt/use-deepgram-stream';
import type { Pregunta, AutosaveStatus } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

interface Props {
  pregunta: Pregunta;
  numero: number;
  total: number;
  seccionLabel: string;
  texto: string;
  marcada: boolean;
  autosave: AutosaveStatus;
  onChangeTexto: (texto: string) => void;
  onToggleMarcada: (marcada: boolean) => void;
  /** STT live wiring. False en preview/dev (sin cookie de sesión). */
  sttEnabled?: boolean;
}

interface AutosaveMeta {
  text: string;
  tone: 'muted' | 'success' | 'warn';
  pulsing: boolean;
}

function autosaveMeta(status: AutosaveStatus): AutosaveMeta {
  switch (status) {
    case 'pending':
      return { text: 'Por guardar', tone: 'muted', pulsing: true };
    case 'saving':
      return { text: 'Guardando', tone: 'muted', pulsing: true };
    case 'saved':
      return { text: 'Guardado', tone: 'success', pulsing: false };
    case 'error':
      return { text: 'Reintentando…', tone: 'warn', pulsing: true };
    case 'idle':
    default:
      return { text: '', tone: 'muted', pulsing: false };
  }
}

export function HeroPregunta({
  pregunta,
  numero,
  total,
  seccionLabel,
  texto,
  marcada,
  autosave,
  onChangeTexto,
  onToggleMarcada,
  sttEnabled = false,
}: Props) {
  const [showMicTooltip, setShowMicTooltip] = useState(false);
  const meta = autosaveMeta(autosave);

  const stt = useDeepgramStream();
  const lastAppendedRef = useRef(0);
  const textoRef = useRef(texto);
  textoRef.current = texto;

  // Cambio de pregunta: cierra el stream activo y resetea el tracker para que
  // segmentos previos no se vuelvan a inyectar en el siguiente textarea.
  useEffect(() => {
    if (stt.status === 'streaming' || stt.status === 'connecting') {
      stt.stop();
    }
    lastAppendedRef.current = stt.transcripts.history.length;
    // Solo dependemos de pregunta.id — stop/reset solo se debe disparar al cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta.id]);

  // Append de segmentos finalizados nuevos al texto. Usamos textoRef para leer
  // el último valor sin re-disparar el effect a cada keystroke; eso lo
  // colapsaría a "anexar siempre todo el historial".
  useEffect(() => {
    const len = stt.transcripts.history.length;
    if (len === lastAppendedRef.current) return;
    const nuevos = stt.transcripts.history.slice(lastAppendedRef.current);
    const fragmento = nuevos
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(' ');
    lastAppendedRef.current = len;
    if (!fragmento) return;
    const previo = textoRef.current;
    const sep = previo.length === 0 || /\s$/.test(previo) ? '' : ' ';
    onChangeTexto(previo + sep + fragmento);
  }, [stt.transcripts.history.length, onChangeTexto]);

  return (
    <article
      key={pregunta.id}
      className={cn(
        'group/hero relative overflow-hidden rounded-[32px] bg-cream shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 animate-fade-up',
        marcada && 'ring-lime/50'
      )}
    >
      {/* Glow esquina sutil cuando marcada — celebración visual */}
      {marcada && (
        <div
          className="absolute -right-24 -top-24 size-72 rounded-full bg-lime/20 blur-3xl"
          aria-hidden
        />
      )}

      {/* Línea lateral lime cuando marcada */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-[3px] bg-lime transition-all duration-500',
          marcada ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden
      />

      <div className="relative px-6 py-8 md:px-12 md:py-12">
        {/* Eyebrow — meta context: número, sección, cajas */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-mono tabular-nums text-forest">
            P{numero.toString().padStart(2, '0')}
          </span>
          <span className="size-1 rounded-full bg-foreground/25" aria-hidden />
          <span>{seccionLabel}</span>
          {marcada && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-lime-foreground animate-fade-up">
              <Check className="size-3" strokeWidth={2.5} />
              Respondida
            </span>
          )}
        </div>

        {/* Pregunta hero */}
        <h2 className="mt-6 text-display text-[28px] leading-[1.08] text-foreground md:text-[40px] xl:text-[44px]">
          {pregunta.texto_pregunta}
        </h2>

        {/* Cajas objetivo como chips minimal */}
        {pregunta.cajas_objetivo.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/6 px-2.5 py-1 text-[11px] font-medium text-forest/85">
              <Sparkles className="size-3" />
              Cubre
            </span>
            {pregunta.cajas_objetivo.map((c) => (
              <code
                key={c}
                className="rounded-full bg-foreground/4 px-2.5 py-1 font-mono text-[11px] tracking-tight text-foreground/70 ring-1 ring-foreground/8"
              >
                {c}
              </code>
            ))}
          </div>
        )}

        {/* Textarea grande */}
        <div className="mt-8 md:mt-10">
          <Textarea
            value={texto}
            onChange={(e) => onChangeTexto(e.target.value)}
            placeholder="Empieza a escribir tu respuesta o usa el micrófono…"
            rows={5}
            className={cn(
              'min-h-[180px] resize-none rounded-2xl border-0 px-5 py-4 text-base leading-relaxed shadow-none transition-all md:text-lg',
              'bg-muted/40 placeholder:text-muted-foreground/70',
              'focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-forest/40'
            )}
            aria-label={`Respuesta a la pregunta ${numero}`}
          />
          {/* Interim STT — preview en gris claro mientras Deepgram aún no
              finaliza el segmento. Al finalizar, el texto se anexa al textarea
              y este preview se vacía. */}
          {sttEnabled && stt.transcripts.interim && (
            <p
              className="mt-2 px-5 text-sm italic text-muted-foreground/70 animate-fade-up"
              aria-live="polite"
            >
              {stt.transcripts.interim}…
            </p>
          )}
          {sttEnabled && stt.error && stt.status === 'error' && (
            <p className="mt-2 px-5 text-xs text-destructive" role="alert">
              {stt.error}
            </p>
          )}
        </div>

        {/* Footer del card */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div
            className={cn(
              'inline-flex items-center gap-2 text-xs font-medium tabular-nums',
              meta.tone === 'success' && 'text-forest',
              meta.tone === 'warn' && 'text-amber-700',
              meta.tone === 'muted' && 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {meta.text ? (
              <>
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    meta.tone === 'success' && 'bg-forest',
                    meta.tone === 'warn' && 'bg-amber-500',
                    meta.tone === 'muted' && 'bg-muted-foreground/60',
                    meta.pulsing && 'animate-pulse-ring'
                  )}
                  aria-hidden
                />
                <span>{meta.text}</span>
              </>
            ) : (
              <span className="text-muted-foreground/70">
                Pregunta {numero} de {total} · escribe para guardar borrador.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sttEnabled ? (
              // STT activo (sesión real). MicButton vive su propio lifecycle:
              // el hook arriba lo alimenta vía start/stop y los transcripts
              // se anexan al textarea por el useEffect.
              <MicButton
                status={stt.status}
                error={stt.error}
                onStart={stt.start}
                onStop={stt.stop}
                className="size-11 [&>svg]:size-4"
              />
            ) : (
              // Preview / dev (sin cookie). /api/stt/token devolvería 401 —
              // mejor mostrar disabled con tooltip claro.
              <div className="relative">
                <button
                  type="button"
                  disabled
                  onMouseEnter={() => setShowMicTooltip(true)}
                  onMouseLeave={() => setShowMicTooltip(false)}
                  onFocus={() => setShowMicTooltip(true)}
                  onBlur={() => setShowMicTooltip(false)}
                  aria-describedby={`mic-tip-${pregunta.id}`}
                  className="inline-flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70 ring-1 ring-foreground/10 transition-all cursor-not-allowed opacity-60"
                >
                  <Mic className="size-4" />
                  <span className="sr-only">Activar micrófono</span>
                </button>
                {showMicTooltip && (
                  <div
                    id={`mic-tip-${pregunta.id}`}
                    role="tooltip"
                    className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-forest-deep px-3 py-2 text-xs text-primary-foreground shadow-lg animate-fade-up"
                  >
                    Disponible solo en sesión real (preview lo desactiva).
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              onClick={() => onToggleMarcada(!marcada)}
              className={cn(
                'h-11 rounded-full px-5 text-sm font-semibold tracking-tight transition-all',
                'active:scale-[0.98]',
                marcada
                  ? 'bg-cream text-forest ring-1 ring-forest/20 hover:bg-cream'
                  : 'bg-forest text-primary-foreground hover:bg-forest-soft'
              )}
            >
              {marcada ? (
                <>
                  <CircleDashed className="size-4" />
                  Desmarcar
                </>
              ) : (
                <>
                  <Check className="size-4" strokeWidth={2.5} />
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
