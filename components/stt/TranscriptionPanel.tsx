'use client';

// Editable transcription view for the demo route. Reads from the same
// TranscriptState shape the hook exposes; renders finalized segments as
// plain text (selectable across segments) and the current interim segment
// in muted gray at the tail. Auto-scrolls to the bottom whenever a new
// final lands.
//
// Editing pattern: doble clic en el panel entra modo edit. UN solo
// contentEditable wrapper envuelve TODOS los segmentos para que selección,
// drag-to-select y Ctrl+A funcionen sobre el texto completo (cada
// contentEditable individual crea editing-context aislado en el browser,
// rompiendo la selección continua entre spans).
//
// onBlur: diffeamos cada segmento contra su snapshot via data-segment-id
// markers; los segmentos que cambiaron disparan onEdit(id, text) y el hook
// los flagea `corregida_manualmente: true`. Punto dorado de UI para que el
// founder vea de un vistazo qué se tocó a mano.
//
// Compatibilidad React + contentEditable:
//   1. Snapshot inmutable durante edit. Si llegan segments nuevos del stream
//      mientras editas, NO los renderizamos hasta blur — sino React intenta
//      reconciliar hijos de un contentEditable cuyo DOM fue tocado por el
//      user/browser y lanza NotFoundError en insertBefore.
//   2. `editKey` cambia al salir de edit, forzando remount completo del
//      contenedor. React monta DOM limpio en vez de intentar diffear contra
//      el DOM que el user dejó editado.
//   3. El wrapper SIEMPRE está montado (no condicional sobre isEmpty). Así
//      React no swaps `<p>` ↔ `<div contentEditable>` cuando llega el primer
//      segmento, evitando otro flavor del mismo bug de placement.

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  TranscriptSegment,
  TranscriptState,
} from '@/lib/stt/use-deepgram-stream';

interface Props {
  transcripts: TranscriptState;
  onEdit: (id: string, newText: string) => void;
  className?: string;
}

export function TranscriptionPanel({ transcripts, onEdit, className }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<TranscriptSegment[]>([]);
  const lastHistoryLenRef = useRef<number>(0);
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(0);

  // Auto-scroll a fondo cuando llega un nuevo final, salvo en modo edit
  // (no queremos saltarle el viewport al user mientras edita).
  useEffect(() => {
    if (editing) return;
    if (transcripts.history.length !== lastHistoryLenRef.current) {
      lastHistoryLenRef.current = transcripts.history.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [transcripts.history.length, editing]);

  function enterEdit(): void {
    // Snapshot inmutable de los segmentos al momento de entrar a edit.
    // Mientras edita, el render NO mira transcripts.history aunque cambie.
    snapshotRef.current = transcripts.history;
    setEditing(true);
  }

  function handleBlur(): void {
    const root = editableRef.current;
    if (root) {
      // Walk segmentos del DOM editado y diffea cada uno contra el snapshot.
      const segEls = root.querySelectorAll<HTMLElement>('[data-segment-id]');
      for (const el of Array.from(segEls)) {
        const id = el.getAttribute('data-segment-id');
        if (!id) continue;
        const textEl = el.querySelector<HTMLElement>('[data-text]');
        const newText = (textEl?.textContent ?? '').trim();
        const original = snapshotRef.current.find((s) => s.id === id);
        if (original && newText && newText !== original.text) {
          onEdit(id, newText);
        }
      }
    }
    setEditing(false);
    snapshotRef.current = [];
    // Forzar remount: clave nueva en el wrapper hace que React descarte el
    // DOM editado por el user y monte uno fresco desde transcripts.history.
    setEditKey((k) => k + 1);
  }

  const visibleSegments = useMemo(
    () => (editing ? snapshotRef.current : transcripts.history),
    [editing, transcripts.history],
  );

  const isEmpty =
    visibleSegments.length === 0 && transcripts.interim.trim() === '';

  return (
    <div
      ref={scrollRef}
      // data-lenis-prevent: Lenis (smooth-scroll global) intercepta wheel a
      // nivel window. Sin esto el wheel sobre el panel scrollearía la página
      // en lugar de la transcripción.
      data-lenis-prevent
      className={cn(
        'h-72 overflow-y-auto rounded-lg border border-border bg-background p-4',
        'text-base leading-relaxed text-foreground',
        className,
      )}
      aria-live="polite"
      aria-atomic="false"
    >
      <div
        key={editKey}
        ref={editableRef}
        contentEditable={editing && !isEmpty}
        suppressContentEditableWarning
        spellCheck={false}
        title={editing || isEmpty ? undefined : 'Doble clic para editar'}
        onDoubleClick={() => {
          if (!isEmpty && !editing) enterEdit();
        }}
        onBlur={handleBlur}
        className={cn(
          'rounded outline-none transition-shadow',
          editing && !isEmpty
            ? 'ring-2 ring-[color:#c8a34a]/40 bg-muted/20 px-2 py-1 -mx-2 -my-1'
            : !isEmpty && 'cursor-text',
        )}
      >
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            Habla por el micrófono — la transcripción aparecerá aquí.
          </p>
        ) : (
          <>
            {visibleSegments.map((seg) => (
              <span
                key={seg.id}
                data-segment-id={seg.id}
                data-speaker={seg.speaker ?? 'unk'}
                className="group/seg"
              >
                <span data-text>{seg.text}</span>
                {seg.corregida_manualmente && (
                  <span
                    aria-label="segmento corregido manualmente"
                    title="Corregido manualmente"
                    className="ml-0.5 inline-block size-1.5 align-super rounded-full"
                    style={{ backgroundColor: '#c8a34a' }}
                  />
                )}{' '}
              </span>
            ))}
            {!editing && transcripts.interim && (
              <span className="text-muted-foreground/70">
                {' '}
                {transcripts.interim}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
