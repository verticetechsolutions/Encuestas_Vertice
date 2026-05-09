'use client';

// HeroPregunta — Paleta A, Typeform-style (2026-05-09 refactor).
//   - Sin card wrapper. La pregunta vive directo en el canvas off-white.
//   - Sin glow de esquina ni línea lateral gold (decoración).
//   - "Tema: X · Y" inline debajo del título (lo que antes vivía en RightRail).
//   - Textarea bg blanco puro + hairline 1px solid, focus = gold border.
//   - Helper "Por ejemplo:" regular weight, no italic.
//   - Botones unificados: ghost dictar + filled marcar respondida, mismo h-11.
//
// STT: cuando `sttEnabled=true`, monta el flujo Deepgram. Cada segmento
// finalizado se concatena al texto vía onChangeTexto. En preview el botón se
// renderiza disabled con tooltip — /api/stt/token requiere cookie real.

import { useEffect, useRef, useState } from 'react';
import { Check, CircleDashed, Mic } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/stt/MicButton';
import { useDeepgramStream } from '@/lib/stt/use-deepgram-stream';
import { getFieldLabel } from '@/lib/cajas-labels';
import type { Pregunta, AutosaveStatus } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

interface Props {
  pregunta: Pregunta;
  numero: number;
  total: number;
  seccionLabel: string;
  /** Códigos de cajas que cubre esta pregunta (e.g. ['productos.ofrecidos']).
      Se renderiza inline como "Tema: Productos ofrecidos · Mercado objetivo". */
  cajasObjetivo: string[];
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

// Separa la pregunta canónica de su microcopy "Por ejemplo: ..." cuando existe.
// Solo divide si Sonnet (o el fixture) usa el separador exacto " Por ejemplo:" — no
// inventamos splits para preguntas con "Mencionar...", "Es decir..." u otras formas
// porque ahí el clarificador es parte legítima de la pregunta.
function splitPreguntaYEjemplo(texto: string): {
  pregunta: string;
  ejemplo: string | null;
} {
  const match = texto.match(/^(.+?)(\s+Por ejemplo:.*)$/);
  if (match) {
    return { pregunta: match[1].trim(), ejemplo: match[2].trim() };
  }
  return { pregunta: texto, ejemplo: null };
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
  seccionLabel,
  cajasObjetivo,
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

  // Cambio de pregunta: cierra el stream activo y resetea el tracker.
  useEffect(() => {
    if (stt.status === 'streaming' || stt.status === 'connecting') {
      stt.stop();
    }
    lastAppendedRef.current = stt.transcripts.history.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta.id]);

  // Append de segmentos finalizados nuevos al texto.
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

  const { pregunta: q, ejemplo } = splitPreguntaYEjemplo(pregunta.texto_pregunta);

  // Tema inline: cajasObjetivo → labels humanos, joined por " · ".
  const temaLabel =
    cajasObjetivo.length > 0
      ? cajasObjetivo.map((c) => getFieldLabel(c)).join(' · ')
      : null;

  return (
    <article
      key={pregunta.id}
      style={{ viewTransitionName: 'question-card' }}
      className="animate-fade-up"
    >
      {/* Eyebrow row — número + sección + chip respondida */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-eyebrow numeric text-gold-deep">
          P{numero.toString().padStart(2, '0')}
        </span>
        {seccionLabel && (
          <>
            <span aria-hidden className="size-1 rounded-full bg-[color:var(--ink)]/20" />
            <span className="text-eyebrow text-[color:var(--ink)]/45">
              {seccionLabel}
            </span>
          </>
        )}
        {marcada && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-eyebrow text-gold-deep animate-fade-up">
            <Check className="size-3" strokeWidth={3} />
            Respondida
          </span>
        )}
      </div>

      {/* Pregunta hero — tracking apretado, peso 600 */}
      <h2 className="mt-6 text-display text-[28px] leading-[1.08] tracking-[-0.025em] text-foreground md:text-[36px] xl:text-[40px]">
        {q}
      </h2>

      {/* Helper "Por ejemplo:" — sutil, no compite con la pregunta */}
      {ejemplo && (
        <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-foreground/40">
          {ejemplo}
        </p>
      )}

      {/* Tema inline — lo que esta pregunta cubre. Reemplaza al RightRail.
          Una sola línea, joined por bullet middle (·). */}
      {temaLabel && (
        <p className="mt-5 text-[13px] tracking-tight text-foreground/45">
          <span className="text-foreground/30">Tema:</span>{' '}
          <span className="text-foreground/60">{temaLabel}</span>
        </p>
      )}

      {/* Textarea — surface white pure + hairline 1px solid, focus gold */}
      <div className="mt-8">
        <Textarea
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          placeholder="Empieza a escribir tu respuesta o usa el micrófono…"
          rows={5}
          className={cn(
            'min-h-[180px] resize-none rounded-xl px-5 py-4 text-base leading-relaxed transition-all',
            'bg-survey-surface text-foreground placeholder:text-foreground/35',
            'border border-[color:var(--survey-hairline-strong)] shadow-none',
            'hover:border-[color:rgb(10_15_28_/_0.18)]',
            'focus-visible:border-[color:var(--gold)] focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/15 focus-visible:ring-offset-0'
          )}
          aria-label={`Respuesta a la pregunta ${numero}`}
        />
        {sttEnabled && stt.transcripts.interim && (
          <p
            className="mt-2 px-1 text-sm text-muted-foreground/70 animate-fade-up"
            aria-live="polite"
          >
            {stt.transcripts.interim}…
          </p>
        )}
        {sttEnabled && stt.error && stt.status === 'error' && (
          <p className="mt-2 px-1 text-xs text-destructive" role="alert">
            {stt.error}
          </p>
        )}
      </div>

      {/* Footer — autosave izq, botones der (ghost dictar + filled marcar) */}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div
          className={cn(
            'inline-flex items-center gap-2 text-xs font-medium numeric',
            meta.tone === 'success' && 'text-gold-deep',
            meta.tone === 'warn' && 'text-amber-700',
            meta.tone === 'muted' && 'text-foreground/55'
          )}
          aria-live="polite"
        >
          {meta.text ? (
            <>
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  meta.tone === 'success' && 'bg-gold-deep',
                  meta.tone === 'warn' && 'bg-amber-500',
                  meta.tone === 'muted' && 'bg-foreground/40',
                  meta.pulsing && 'animate-pulse-ring'
                )}
                aria-hidden
              />
              <span>{meta.text}</span>
            </>
          ) : (
            <span className="text-foreground/35">Borrador autoguardado</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sttEnabled ? (
            <MicButton
              status={stt.status}
              error={stt.error}
              onStart={stt.start}
              onStop={stt.stop}
              className="size-11 [&>svg]:size-4"
            />
          ) : (
            <div className="relative">
              <button
                type="button"
                disabled
                onMouseEnter={() => setShowMicTooltip(true)}
                onMouseLeave={() => setShowMicTooltip(false)}
                onFocus={() => setShowMicTooltip(true)}
                onBlur={() => setShowMicTooltip(false)}
                aria-describedby={`mic-tip-${pregunta.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--survey-hairline-strong)] bg-transparent px-4 text-sm font-medium tracking-tight text-foreground/55 transition-colors hover:bg-[color:var(--survey-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Mic className="size-4" />
                Dictar respuesta
              </button>
              {showMicTooltip && (
                <div
                  id={`mic-tip-${pregunta.id}`}
                  role="tooltip"
                  className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-ink px-3 py-2 text-xs text-cream-pure shadow-lg animate-fade-up"
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
              'h-11 rounded-full px-5 text-sm font-medium tracking-tight transition-all',
              'active:scale-[0.98]',
              marcada
                ? 'bg-survey-surface text-ink ring-1 ring-[color:var(--gold)]/45 hover:bg-survey-surface'
                : 'bg-ink text-cream-pure hover:bg-ink-raised'
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
    </article>
  );
}
