'use client';

// HeroPregunta — workspace de la pregunta activa (rewrite limpio 2026-05-10).
//
// Estructura (flex-col gap-6 — spacing predecible y uniforme):
//   1. Question: h2 hero + auxiliar (split por "Por ejemplo:" o composición).
//   2. Textarea + banner Lock (ghost slot bajo el textarea).
//   3. Footer: autosave indicator + buttons (Dictar ghost + Marcar/Desmarcar CTA).
//
// Counter "Pregunta XX de YY" + chip RESPONDIDA viven en `entrevista-shell.tsx`
// FUERA del AnimatePresence (fix O2 bug doc bugs-encontrados-2026-05-11-e2e.md
// §O2) — durante la transición de 120ms entre preguntas, esos elementos no se
// quedan stuck con el valor del HeroPregunta saliente.
//
// Anti-shift por construcción:
//   - Banner min-h reservado (toggle no mueve el footer).
//   - Textarea max-h + scroll interno (no crece el card si user escribe largo).
//   - CTA min-w fijo (alterna "Marcar respondida" ↔ "Desmarcar" sin shift).
//   - Ghost slots = visibility+opacity (CSS), nunca mount/unmount.
//
// STT (preview lo desactiva):
//   - useEffect 1: cierra stream cuando cambia la pregunta + resetea tracker.
//   - useEffect 2: cuando llega un segmento nuevo, lo concatena al texto.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Lock, Mic, RotateCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { MicButton } from '@/components/stt/MicButton';
import {
  useDeepgramStream,
  type InitialSttToken,
} from '@/lib/stt/use-deepgram-stream';
import { appendTranscriptSegments } from '@/lib/stt/append-transcript';
import {
  SPRING_BUTTON,
  SPRING_ICON,
  ghostButtonVariants,
  solidButtonVariants,
} from '@/lib/motion-presets';
import type { AutosaveStatus, Pregunta } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

interface Props {
  pregunta: Pregunta;
  texto: string;
  marcada: boolean;
  autosave: AutosaveStatus;
  onChangeTexto: (texto: string) => void;
  /** Toggle atómico — el caller delega al store sin pasar el valor target. Evita
   * el closure stale del prop `marcada` durante navegación sub-segundo entre
   * preguntas del batch (deuda #2 race condition O3). */
  onToggleMarcada: () => void;
  /** STT live wiring. False en preview/dev (sin cookie). */
  sttEnabled?: boolean;
  /** Notifica al store que esta pregunta recibió input desde STT (voz). Idempotente;
   * el caller hace guard interno. Cierra deuda #8 (`fuente: 'usuario_tipea'`
   * discriminator real). */
  onSttAppend?: () => void;
  /** Token Deepgram pre-minteado por el RSC. Se pasa al hook STT para saltarse
   * el POST /api/stt/token en el primer click (~200-400ms shaved). null si
   * el grant server-side falló — el hook fallback al fetch normal. */
  initialSttToken?: InitialSttToken | null;
}

// Resuelve { pregunta, auxiliar } a renderizar. Si la Pregunta trae `auxiliar`
// explícito (formato nuevo emitido por Sonnet desde el bloque <formato_pregunta>
// del system prompt), úsalo directo. Si no, cae al heurístico legacy para
// soportar batches viejos de DB que pudieran tener "...pregunta? Por ejemplo:..."
// o pregunta compuesta "...? Y/Si/¿...?" embebida en el texto.
function resolverPreguntaYAuxiliar(pregunta: Pregunta): {
  pregunta: string;
  auxiliar: string | null;
} {
  if (pregunta.auxiliar && pregunta.auxiliar.trim().length > 0) {
    return { pregunta: pregunta.texto_pregunta, auxiliar: pregunta.auxiliar };
  }
  const texto = pregunta.texto_pregunta;
  const m1 = texto.match(/^(.+?)(\s+Por ejemplo:.*)$/);
  if (m1) return { pregunta: m1[1].trim(), auxiliar: m1[2].trim() };
  const m2 = texto.match(/^(.+?\?)\s+([YS¿].+\?)\s*$/);
  if (m2) return { pregunta: m2[1].trim(), auxiliar: m2[2].trim() };
  return { pregunta: texto, auxiliar: null };
}

const AUTOSAVE_META: Record<
  AutosaveStatus,
  { text: string; tone: 'muted' | 'success' | 'warn'; pulsing: boolean }
> = {
  pending: { text: 'Por guardar', tone: 'muted', pulsing: true },
  saving: { text: 'Guardando', tone: 'muted', pulsing: true },
  saved: { text: 'Guardado', tone: 'success', pulsing: false },
  error: { text: 'Reintentando…', tone: 'warn', pulsing: true },
  idle: { text: '', tone: 'muted', pulsing: false },
};

export function HeroPregunta({
  pregunta,
  texto,
  marcada,
  autosave,
  onChangeTexto,
  onToggleMarcada,
  sttEnabled = false,
  onSttAppend,
  initialSttToken = null,
}: Props) {
  const [showMicTooltip, setShowMicTooltip] = useState(false);
  const meta = AUTOSAVE_META[autosave];
  const { pregunta: q, auxiliar } = resolverPreguntaYAuxiliar(pregunta);

  // STT wiring. initialToken viene del RSC (pre-mint) y se consume una sola
  // vez en el primer start() — siguientes clicks fetchean normal.
  // prewarmMicOnMount: solo si STT está habilitado para esta pregunta. El
  // hook valida internamente que el browser reporte permission='granted'
  // antes de adquirir el mic; en cold-first-visit (permission='prompt') no
  // hace nada (no quema el prompt sin gesture).
  const stt = useDeepgramStream({
    initialToken: initialSttToken,
    prewarmMicOnMount: sttEnabled,
  });
  const lastAppendedRef = useRef(0);
  const textoRef = useRef(texto);
  textoRef.current = texto;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Si el textarea NO tiene overflow interno (texto cabe en el viewport del
  // control), `data-lenis-prevent` hace que Lenis salga sin actualizar
  // targetScroll y el browser scrollea el documento natively. La siguiente
  // tick del RAF loop de Lenis hace `window.scrollTo(targetScroll)` con un
  // valor stale y revierte → bounce arriba/abajo perceptible. Aplicamos el
  // attr solo cuando hay overflow real (scrollHeight > clientHeight).
  const [textareaTieneOverflow, setTextareaTieneOverflow] = useState(false);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setTextareaTieneOverflow(ta.scrollHeight > ta.clientHeight);
  }, [texto]);

  // Auto-focus al textarea cuando el user activa el mic. Sin esto, el cursor
  // visible se queda en el botón, lo cual genera la sensación de que "no se
  // está escribiendo" hasta que el WS de Deepgram abre (~400-800ms más tarde).
  // Mover el caret al textarea hace que el placeholder/draft sea el foco visual
  // desde el primer click + permite mixed input (mic + tecleo simultáneo).
  const handleMicStart = useCallback(() => {
    if (!marcada) {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus({ preventScroll: true });
        // Posicionar caret al final del texto existente para que lo dictado
        // se concatene visualmente donde el user lo espera.
        const end = ta.value.length;
        ta.setSelectionRange(end, end);
      }
    }
    void stt.start();
  }, [marcada, stt]);

  const handleMicStop = useCallback(() => {
    void stt.stop();
  }, [stt]);

  // Keyboard shortcut: Space toggle mic (Wispr-style). Solo cuando:
  //   - STT habilitado
  //   - pregunta no marcada como definitiva
  //   - el target no es un input/textarea/contenteditable (no robar Space al
  //     typear espacios) — excepto el textarea de la propia respuesta cuando
  //     ya hay mic activo (Space para detener vale aunque tipees).
  // Ctrl/Cmd-modificado se ignora para no chocar con shortcuts del sistema.
  useEffect(() => {
    if (!sttEnabled || marcada) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const target = ev.target as HTMLElement | null;
      const isFormInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      // Si estoy tipiando en el textarea, NO secuestrar Space (usuario escribe
      // espacios naturales). Solo permitir el toggle si el foco está fuera de
      // cualquier input. Esto da el shortcut útil para "iniciar mic" cuando
      // el foco está en el body o en el button container.
      if (isFormInput) return;
      ev.preventDefault();
      if (stt.status === 'streaming') {
        void stt.stop();
      } else if (stt.status === 'idle' || stt.status === 'error') {
        handleMicStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMicStart, marcada, stt, sttEnabled]);

  // Reset STT cuando cambia la pregunta.
  useEffect(() => {
    if (
      stt.status === 'streaming' ||
      stt.status === 'connecting' ||
      stt.status === 'reconnecting'
    ) {
      void stt.stop();
    }
    lastAppendedRef.current = stt.transcripts.history.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta.id]);

  // Append de segmentos finalizados nuevos al texto. Lógica pura aislada en
  // lib/stt/append-transcript.ts para que sea unit-testable sin jsdom/RTL.
  useEffect(() => {
    const { nextTexto, consumidos } = appendTranscriptSegments(
      textoRef.current,
      stt.transcripts.history,
      lastAppendedRef.current
    );
    if (consumidos === lastAppendedRef.current) return;
    lastAppendedRef.current = consumidos;
    if (nextTexto !== textoRef.current) {
      onChangeTexto(nextTexto);
      // Marca la pregunta como STT-source para el discriminator de fuente
      // (deuda #8). El handler es idempotente; no hace falta guard adicional.
      onSttAppend?.();
    }
  }, [stt.transcripts.history, onChangeTexto, onSttAppend]);

  return (
    <article className="flex flex-col gap-6 animate-fade-up">
      {/* ─── 1. QUESTION — h2 hero + auxiliar opcional ─── */}
      <div>
        <h2 className="text-display text-[28px] leading-[1.08] tracking-[-0.025em] text-foreground md:text-[36px] xl:text-[40px]">
          {q}
        </h2>
        {auxiliar && (
          <p className="mt-4 max-w-[60ch] text-[14.5px] leading-relaxed text-foreground/70">
            {auxiliar}
          </p>
        )}
      </div>

      {/* ─── 2. TEXTAREA + banner Lock (ghost slot debajo) ─── */}
      <div className="flex flex-col gap-3">
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          placeholder={
            marcada
              ? 'Respuesta bloqueada. Desmarcá para editar.'
              : 'Empieza a escribir tu respuesta o usa el micrófono…'
          }
          rows={5}
          readOnly={marcada}
          aria-readonly={marcada}
          aria-label="Tu respuesta a la pregunta actual"
          // El smooth-scroll global de Lenis intercepta wheel a nivel window.
          // En respuestas largas que activan overflow-auto del textarea, este
          // attr hace que Lenis no robe el wheel y se scrollee el textarea.
          // Lo aplicamos SOLO cuando hay overflow real: si no, Lenis se desyncroniza
          // contra el scroll nativo y produce un bounce arriba/abajo.
          {...(textareaTieneOverflow ? { 'data-lenis-prevent': '' } : {})}
          className={cn(
            'min-h-[180px] max-h-[360px] resize-none overflow-auto rounded-xl px-5 py-4 text-base leading-relaxed transition-all',
            'placeholder:text-foreground/35 border shadow-none',
            marcada
              ? [
                  'cursor-not-allowed select-text',
                  'bg-[color:var(--gold)]/[0.05] text-foreground/90',
                  'border-[color:var(--gold)]/30',
                  'focus-visible:border-[color:var(--gold)]/40 focus-visible:ring-0',
                ]
              : [
                  'bg-survey-surface text-foreground',
                  'border-[color:var(--survey-hairline-strong)]',
                  'hover:border-[color:rgb(10_15_28_/_0.18)]',
                  'focus-visible:border-[color:var(--gold)] focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/15 focus-visible:ring-offset-0',
                ]
          )}
        />

        {/* Banner Lock ghost slot — siempre montado, opacity toggle */}
        <div className="min-h-[20px]">
          <div
            aria-hidden={!marcada}
            role="status"
            className="flex items-center gap-2 text-[12.5px] text-foreground/65 transition-opacity duration-200"
            style={{
              opacity: marcada ? 1 : 0,
              visibility: marcada ? 'visible' : 'hidden',
            }}
          >
            <Lock className="size-3.5 text-gold-deep" strokeWidth={2.25} />
            <span>
              Respuesta marcada como definitiva. Desmarcá para editarla.
            </span>
          </div>
        </div>

        {/* STT interim/error (solo cuando sttEnabled) */}
        {sttEnabled && stt.transcripts.interim && (
          <p
            className="px-1 text-sm text-muted-foreground/70"
            aria-live="polite"
          >
            {stt.transcripts.interim}…
          </p>
        )}
        {sttEnabled && stt.status === 'reconnecting' && (
          <p
            className="px-1 text-xs text-muted-foreground/80"
            role="status"
            aria-live="polite"
          >
            Reconectando con el servicio de voz…
          </p>
        )}
        {sttEnabled && stt.lowAudioWarning && stt.status === 'streaming' && (
          <p
            className="flex items-center gap-2 px-1 text-xs text-amber-600"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-amber-500 animate-pulse-ring"
            />
            Habla más fuerte o acércate al micrófono — la señal está muy baja.
          </p>
        )}
        {sttEnabled && stt.longRecordingWarning && stt.status === 'streaming' && (
          <p
            className="px-1 text-xs text-amber-600"
            role="status"
            aria-live="polite"
          >
            La grabación lleva más de 25 minutos. Se detendrá automáticamente a los 30.
          </p>
        )}
        {sttEnabled && stt.error && stt.status === 'error' && (
          <p className="px-1 text-xs text-destructive" role="alert">
            {stt.error}
          </p>
        )}
      </div>

      {/* ─── 3. FOOTER — autosave izq, buttons der ─── */}
      <footer className="flex flex-wrap items-center justify-between gap-4">
        <AutosaveIndicator meta={meta} />

        <div className="flex items-center gap-2">
          {sttEnabled ? (
            <MicButton
              status={stt.status}
              error={stt.error}
              errorCode={stt.errorCode}
              audioLevel={stt.audioLevel}
              onStart={handleMicStart}
              onStop={handleMicStop}
              // Touch target: 56px en mobile (Apple HIG sweet spot, supera el
              // mínimo WCAG 44), 44px en desktop (compacto, alineado con el CTA).
              className="size-14 [&>svg]:size-5 md:size-11 md:[&>svg]:size-4"
            />
          ) : (
            <DictarButtonDisabled
              preguntaId={pregunta.id}
              showTooltip={showMicTooltip}
              onShowTooltip={setShowMicTooltip}
            />
          )}

          <MarcarButton
            marcada={marcada}
            onToggle={onToggleMarcada}
          />
        </div>
      </footer>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes inline — para que el JSX principal sea legible.
// ─────────────────────────────────────────────────────────────────────────────

function AutosaveIndicator({
  meta,
}: {
  meta: (typeof AUTOSAVE_META)[AutosaveStatus];
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 text-xs font-medium numeric',
        meta.tone === 'success' && 'text-gold-deep',
        meta.tone === 'warn' && 'text-amber-700',
        meta.tone === 'muted' && 'text-foreground/55'
      )}
    >
      {meta.text ? (
        <>
          <span
            aria-hidden
            className={cn(
              'inline-block size-1.5 rounded-full',
              meta.tone === 'success' && 'bg-gold-deep',
              meta.tone === 'warn' && 'bg-amber-500',
              meta.tone === 'muted' && 'bg-foreground/40',
              meta.pulsing && 'animate-pulse-ring'
            )}
          />
          <span>{meta.text}</span>
        </>
      ) : (
        <span className="text-foreground/70">Borrador autoguardado</span>
      )}
    </div>
  );
}

function DictarButtonDisabled({
  preguntaId,
  showTooltip,
  onShowTooltip,
}: {
  preguntaId: string;
  showTooltip: boolean;
  onShowTooltip: (v: boolean) => void;
}) {
  return (
    <div className="relative">
      <motion.button
        type="button"
        disabled
        onMouseEnter={() => onShowTooltip(true)}
        onMouseLeave={() => onShowTooltip(false)}
        onFocus={() => onShowTooltip(true)}
        onBlur={() => onShowTooltip(false)}
        aria-describedby={`mic-tip-${preguntaId}`}
        initial="rest"
        animate="rest"
        variants={ghostButtonVariants}
        transition={SPRING_BUTTON}
        className="inline-flex h-12 cursor-not-allowed items-center gap-2.5 rounded-full border border-[color:var(--survey-hairline-strong)] bg-transparent pl-5 pr-2 text-[13.5px] font-medium tracking-tight text-foreground/55 opacity-70 transition-colors"
      >
        Dictar respuesta
        <span
          aria-hidden
          className="inline-flex size-8 items-center justify-center rounded-full bg-[color:var(--ink)]/8 text-foreground/65"
        >
          <Mic className="size-3.5" strokeWidth={2.25} />
        </span>
      </motion.button>
      {showTooltip && (
        <div
          id={`mic-tip-${preguntaId}`}
          role="tooltip"
          className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-ink px-3 py-2 text-xs text-cream-pure shadow-lg animate-fade-up"
        >
          Disponible solo en sesión real (preview lo desactiva).
        </div>
      )}
    </div>
  );
}

function MarcarButton({
  marcada,
  onToggle,
}: {
  marcada: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap="tap"
      variants={solidButtonVariants}
      transition={SPRING_BUTTON}
      className={cn(
        'inline-flex h-12 min-w-[200px] cursor-pointer items-center justify-between gap-3 rounded-full pl-5 pr-2 text-[13.5px] font-medium tracking-tight transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--survey-card-2)]',
        marcada
          ? 'bg-[color:var(--cream-pure)] text-ink ring-1 ring-[color:var(--gold)]/45'
          : 'bg-ink text-cream-pure shadow-[0_0_0_1px_rgba(244,241,234,0.04),0_20px_50px_-18px_rgba(200,168,100,0.32)] hover:bg-ink-raised'
      )}
    >
      {marcada ? 'Desmarcar' : 'Marcar respondida'}
      <motion.span
        aria-hidden
        variants={{
          rest: { rotate: 0, scale: 1 },
          hover: { rotate: marcada ? -45 : 0, scale: 1.06 },
          tap: { rotate: marcada ? -45 : 0, scale: 0.92 },
        }}
        transition={SPRING_ICON}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full',
          marcada
            ? 'bg-[color:var(--ink)] text-[color:var(--gold)]'
            : 'bg-[color:var(--gold)] text-ink'
        )}
      >
        {marcada ? (
          <RotateCcw className="size-4" strokeWidth={2.5} />
        ) : (
          <Check className="size-4" strokeWidth={2.75} />
        )}
      </motion.span>
    </motion.button>
  );
}
