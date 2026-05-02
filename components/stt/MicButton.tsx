'use client';

// Circular mic toggle. Drives the useDeepgramStream lifecycle from a single
// button: idle ↔ streaming. Error renders a destructive border with a tooltip;
// requesting_mic / connecting render a spinner so the user knows the click
// landed even if the websocket hasn't opened yet.
//
// Identidad Vértice: navy primary, gold focus ring. Fallback to the project's
// shadcn neutral tokens for everything else so dark mode works for free.

import { Loader2, Mic, MicOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SttStatus } from '@/lib/stt/use-deepgram-stream';

const VERTICE_NAVY = '#0a1f44';
const VERTICE_GOLD = '#c8a34a';

interface Props {
  status: SttStatus;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

export function MicButton({ status, error, onStart, onStop, className }: Props) {
  const isBusy = status === 'requesting_mic' || status === 'connecting';
  const isStreaming = status === 'streaming';
  const isError = status === 'error';
  const label = isStreaming
    ? 'Detener grabación'
    : isBusy
      ? 'Conectando con el micrófono'
      : isError
        ? 'Error con el micrófono — clic para reintentar'
        : 'Iniciar grabación';

  return (
    <button
      type="button"
      aria-label={label}
      title={error ?? label}
      disabled={isBusy}
      onClick={isStreaming ? onStop : onStart}
      style={{
        backgroundColor: isStreaming ? '#dc2626' : isError ? undefined : VERTICE_NAVY,
        boxShadow: isStreaming ? '0 0 0 6px rgba(220,38,38,0.18)' : undefined,
      }}
      className={cn(
        'relative inline-flex h-16 w-16 items-center justify-center rounded-full',
        'text-white transition-all duration-150',
        'outline-none focus-visible:ring-4',
        'disabled:cursor-not-allowed disabled:opacity-70',
        isError && 'bg-destructive/10 text-destructive border-2 border-destructive',
        isStreaming && 'animate-pulse',
        className,
      )}
      data-status={status}
    >
      {/* Gold focus ring matches Vértice identity. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-0 group-focus-visible:ring-4"
        style={{ boxShadow: 'inset 0 0 0 0 transparent' }}
      />
      <span aria-hidden className="absolute -inset-1 rounded-full opacity-0 transition-opacity"
        style={{ boxShadow: `0 0 0 3px ${VERTICE_GOLD}` }}
      />
      {isBusy ? (
        <Loader2 className="size-7 animate-spin" />
      ) : isError ? (
        <AlertTriangle className="size-7" />
      ) : isStreaming ? (
        <MicOff className="size-7" />
      ) : (
        <Mic className="size-7" />
      )}
    </button>
  );
}
