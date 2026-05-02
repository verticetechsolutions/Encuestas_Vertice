'use client';

// Editable transcription view for the demo route. Reads from the same
// TranscriptState shape the hook exposes; renders finalized segments inline-
// editable (contentEditable) and the current interim segment in muted gray
// at the tail. Auto-scrolls to the bottom whenever a new final lands.
//
// Editing pattern: a segment becomes editable on focus. On blur we diff
// against the original text — if it changed, we call `editSegment(id, text)`
// and the hook flags it as `corregida_manualmente: true`. The corrected
// state shows a small gold dot so the founder can see at a glance which
// segments were touched by hand during QA.

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TranscriptState, TranscriptSegment } from '@/lib/stt/use-deepgram-stream';

interface Props {
  transcripts: TranscriptState;
  onEdit: (id: string, newText: string) => void;
  className?: string;
}

export function TranscriptionPanel({ transcripts, onEdit, className }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastHistoryLenRef = useRef<number>(0);

  useEffect(() => {
    if (transcripts.history.length !== lastHistoryLenRef.current) {
      lastHistoryLenRef.current = transcripts.history.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [transcripts.history.length]);

  const isEmpty =
    transcripts.history.length === 0 && transcripts.interim.trim() === '';

  return (
    <div
      ref={scrollRef}
      className={cn(
        'h-72 overflow-y-auto rounded-lg border border-border bg-background p-4',
        'text-base leading-relaxed text-foreground',
        className,
      )}
      aria-live="polite"
      aria-atomic="false"
    >
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          Habla por el micrófono — la transcripción aparecerá aquí.
        </p>
      ) : (
        <>
          {transcripts.history.map((seg) => (
            <Segment key={seg.id} seg={seg} onEdit={onEdit} />
          ))}
          {transcripts.interim && (
            <span className="text-muted-foreground/70">
              {' '}
              {transcripts.interim}
            </span>
          )}
        </>
      )}
    </div>
  );
}

interface SegmentProps {
  seg: TranscriptSegment;
  onEdit: (id: string, newText: string) => void;
}

function Segment({ seg, onEdit }: SegmentProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // Avoid stomping the user's caret while they're typing — only sync DOM text
  // when the prop diverges from the rendered text.
  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== seg.text) {
      el.textContent = seg.text;
    }
  }, [seg.text]);

  return (
    <span
      data-segment-id={seg.id}
      data-speaker={seg.speaker ?? 'unk'}
      className="group/seg"
    >
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => {
          const next = e.currentTarget.textContent ?? '';
          if (next !== seg.text) onEdit(seg.id, next);
        }}
        className={cn(
          'rounded px-0.5 outline-none',
          'focus-visible:bg-muted/40',
          'hover:bg-muted/30',
        )}
      >
        {seg.text}
      </span>
      {seg.corregida_manualmente && (
        <span
          aria-label="segmento corregido manualmente"
          title="Corregido manualmente"
          className="ml-0.5 inline-block size-1.5 align-super rounded-full"
          style={{ backgroundColor: '#c8a34a' }}
        />
      )}{' '}
    </span>
  );
}
