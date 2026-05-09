'use client';

// HeroPregunta — pregunta como protagonista absoluto de la pantalla.
// Estilo:
//   - Card cream rounded-[32px], generosísimo padding (md:p-12)
//   - Eyebrow chip "P01" (meta pequeña arriba) — sección vive en el shell
//   - Pregunta gigante (text-3xl → 5xl), display tracking apretado
//   - Cajas objetivo NO inline aquí — viven en el right rail con label humano
//   - Textarea filled inset, min-h grande, focus shadow gold
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
import { Check, CircleDashed, Mic } from 'lucide-react';
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

// Separa la pregunta canónica de su microcopy "Por ejemplo: ..." cuando existe.
// Solo divide si Sonnet (o el fixture) usa el separador exacto " Por ejemplo:" — no
// inventamos splits para preguntas con "Mencionar...", "Es decir..." u otras formas
// porque ahí el clarificador es parte legítima de la pregunta. Conservador por
// diseño: si el fixture cambia, sigue renderizando completo, no se rompe nada.
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
        'group/hero relative overflow-hidden rounded-[32px] bg-cream-pure shadow-xl shadow-ink/5 ring-1 ring-ink/8 animate-fade-up',
        marcada && 'ring-gold/40'
      )}
    >
      {/* Glow esquina sutil cuando marcada — celebración visual */}
      {marcada && (
        <div
          className="absolute -right-24 -top-24 size-72 rounded-full bg-gold/20 blur-3xl"
          aria-hidden
        />
      )}

      {/* Línea lateral gold cuando marcada */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-[3px] bg-gold transition-all duration-500',
          marcada ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden
      />

      <div className="relative px-6 py-8 md:px-10 md:py-10">
        {/* Top row — número de pregunta + sección actual (eyebrow secundario
            sutil) + chip respondida. La sección vive aquí ahora (no en eyebrow
            duplicado del shell), reduciendo ruido visual. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-eyebrow tabular-nums text-gold-deep">
            P{numero.toString().padStart(2, '0')}
          </span>
          {seccionLabel && (
            <>
              <span aria-hidden className="size-1 rounded-full bg-foreground/25" />
              <span className="text-eyebrow text-foreground/45">
                {seccionLabel}
              </span>
            </>
          )}
          {marcada && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-eyebrow text-gold-deep ring-1 ring-gold/40 animate-fade-up">
              <Check className="size-3" strokeWidth={2.5} />
              Respondida
            </span>
          )}
        </div>

        {(() => {
          const { pregunta: q, ejemplo } = splitPreguntaYEjemplo(
            pregunta.texto_pregunta
          );
          return (
            <>
              {/* Pregunta hero — display tracking apretado, ritmo landing */}
              <h2 className="mt-5 text-display text-[28px] leading-[1.05] tracking-[-0.025em] text-foreground md:text-[36px] xl:text-[40px]">
                {q}
              </h2>

              {/* Microcopy "Por ejemplo:..." — italic más pequeño debajo,
                  jerarquía clara vs título. Solo cuando el fixture/IA lo trae. */}
              {ejemplo && (
                <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-foreground/55 italic md:text-base">
                  {ejemplo}
                </p>
              )}

              {/* Hairline gold — sello editorial debajo del título */}
              <span aria-hidden className="gold-hairline mt-6 block w-12" />
            </>
          );
        })()}

        {/* Textarea grande — filled inset estilo landing FormField, focus gold */}
        <div className="mt-8 md:mt-10">
          <Textarea
            value={texto}
            onChange={(e) => onChangeTexto(e.target.value)}
            placeholder="Empieza a escribir tu respuesta o usa el micrófono…"
            rows={5}
            className={cn(
              'min-h-[180px] resize-none rounded-2xl border-0 px-5 py-4 text-base leading-relaxed transition-all md:text-lg',
              'bg-ink/[0.04] text-foreground placeholder:text-foreground/35',
              'shadow-[inset_0_0_0_1px_rgb(10_15_28_/_0.06)]',
              'hover:bg-ink/[0.055] hover:shadow-[inset_0_0_0_1px_rgb(10_15_28_/_0.10)]',
              'focus-visible:bg-ink/[0.06] focus-visible:shadow-[inset_0_0_0_1.5px_rgb(200_168_100_/_0.55),0_0_0_4px_rgb(200_168_100_/_0.10)] focus-visible:ring-0'
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
              // mejor mostrar disabled con tooltip claro. Pill inline (no
              // circle) para alinear con el lenguaje de pares Mic + Marcar
              // respondida del footer (ambos rounded-full pill, no shape mismatch).
              <div className="relative">
                <button
                  type="button"
                  disabled
                  onMouseEnter={() => setShowMicTooltip(true)}
                  onMouseLeave={() => setShowMicTooltip(false)}
                  onFocus={() => setShowMicTooltip(true)}
                  onBlur={() => setShowMicTooltip(false)}
                  aria-describedby={`mic-tip-${pregunta.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium tracking-tight text-foreground/55 ring-1 ring-ink/10 transition-colors hover:text-foreground hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-70"
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
                  ? 'bg-cream-pure text-ink ring-1 ring-gold/45 hover:bg-cream-pure'
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
      </div>
    </article>
  );
}
