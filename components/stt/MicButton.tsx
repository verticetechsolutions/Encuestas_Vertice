'use client';

// Circular mic toggle. Drives the useDeepgramStream lifecycle from a single
// button: idle ↔ streaming. Estados intermedios (requesting_mic, connecting,
// reconnecting) muestran un spinner. Error muestra alert icon + tooltip
// contextual basado en errorCode.
//
// Identidad Vértice: navy primary, gold focus ring, rojo (#dc2626) streaming.
// Pulso animado durante streaming. Audio level meter ring opcional (P1 UX).

import { Loader2, Mic, MicOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SttErrorCode,
  SttStatus,
} from '@/lib/stt/use-deepgram-stream';

const VERTICE_NAVY = '#0a1f44';
const VERTICE_GOLD = '#c8a34a';

interface Props {
  status: SttStatus;
  error: string | null;
  errorCode?: SttErrorCode | null;
  /** Nivel de audio 0-1 (RMS smoothed) — alimenta el ring meter cuando streaming. */
  audioLevel?: number;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

// Mensaje semántico por estado/error. El aria-label conduce screen readers
// y el title hace tooltip para hover desktop.
function labelFor(status: SttStatus, errorCode?: SttErrorCode | null): string {
  switch (status) {
    case 'streaming':
      return 'Detener grabación';
    case 'requesting_mic':
      return 'Solicitando acceso al micrófono';
    case 'connecting':
      return 'Conectando con el servicio de voz';
    case 'reconnecting':
      return 'Reconectando — un momento';
    case 'error':
      return errorActionLabel(errorCode);
    case 'idle':
    default:
      return 'Iniciar grabación';
  }
}

// El label de error guía al user a la acción correcta según código.
function errorActionLabel(code?: SttErrorCode | null): string {
  switch (code) {
    case 'permission_denied':
    case 'permission_revoked':
      return 'Habilita el micrófono y reintenta';
    case 'no_microphone':
      return 'Sin micrófono detectado';
    case 'mic_in_use':
      return 'Cierra otra app usando el mic y reintenta';
    case 'token_rate_limited':
      return 'Demasiados intentos — espera y reintenta';
    case 'network_unstable':
      return 'Red inestable — clic para reintentar';
    case 'session_too_long':
      return 'Sesión finalizada — clic para una nueva';
    default:
      return 'Error con el micrófono — clic para reintentar';
  }
}

export function MicButton({
  status,
  error,
  errorCode,
  audioLevel = 0,
  onStart,
  onStop,
  className,
}: Props) {
  const isBusy =
    status === 'requesting_mic' ||
    status === 'connecting' ||
    status === 'reconnecting';
  const isStreaming = status === 'streaming';
  const isReconnecting = status === 'reconnecting';
  const isError = status === 'error';
  const label = labelFor(status, errorCode);

  // Audio level → halo glow size (visual feedback de voz activa).
  // Cuando streaming, el ring del botón crece con el RMS. Suavizado en CSS
  // con transition para evitar flicker. audioLevel 0-1 → 0-12px extra glow.
  const glowPx = isStreaming ? Math.round(6 + audioLevel * 12) : 0;
  const glowAlpha = isStreaming ? 0.15 + audioLevel * 0.35 : 0;

  return (
    <button
      type="button"
      aria-label={label}
      aria-live="polite"
      aria-busy={isBusy}
      title={error ?? label}
      disabled={isBusy && !isReconnecting}
      onClick={isStreaming ? onStop : onStart}
      style={{
        backgroundColor: isStreaming
          ? '#dc2626'
          : isError
            ? undefined
            : VERTICE_NAVY,
        boxShadow: isStreaming
          ? `0 0 0 ${glowPx}px rgba(220,38,38,${glowAlpha.toFixed(3)})`
          : undefined,
      }}
      className={cn(
        'relative inline-flex h-16 w-16 items-center justify-center rounded-full',
        'text-white transition-all duration-150',
        'outline-none focus-visible:ring-4',
        'disabled:cursor-not-allowed disabled:opacity-70',
        // Touch target mínimo 44x44 ya cubierto con h-16/w-16 (64px).
        isError && 'bg-destructive/10 text-destructive border-2 border-destructive',
        isStreaming && 'animate-pulse',
        className,
      )}
      data-status={status}
      data-error-code={errorCode ?? undefined}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-0 group-focus-visible:ring-4"
        style={{ boxShadow: 'inset 0 0 0 0 transparent' }}
      />
      <span
        aria-hidden
        className="absolute -inset-1 rounded-full opacity-0 transition-opacity"
        style={{ boxShadow: `0 0 0 3px ${VERTICE_GOLD}` }}
      />
      {isBusy ? (
        isReconnecting ? (
          <RefreshCw className="size-7 animate-spin" />
        ) : (
          <Loader2 className="size-7 animate-spin" />
        )
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
