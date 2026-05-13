'use client';

// Toggle para silenciar el chime audio del STT. Setting persistido en
// localStorage vía `isChimeMuted` / `setChimeMuted` (lib/stt/chime.ts).
//
// Diseño UX:
//   - Botón compacto en el header del entrevista shell (al lado del badge de
//     "Borrador autoguardado"). Microcopy explícito en aria-label para que
//     screen readers anuncien el estado.
//   - Mute persiste cross-sesión (mismo browser). El default es "audio on"
//     porque el chime es feedback funcional, no decorativo.
//   - Icono Volume2 → muted = VolumeX, no muted = Volume2.

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isChimeMuted, setChimeMuted } from '@/lib/stt/chime';

export function ChimeMuteToggle({ surface = 'dark' }: { surface?: 'dark' | 'light' }) {
  // hydrated guard: en SSR el setting siempre arranca en false. Diferimos el
  // read del localStorage al primer effect para evitar hydration mismatch
  // si el usuario tiene el chime muteado de una sesión previa.
  const [muted, setMuted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMuted(isChimeMuted());
    setHydrated(true);
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ muted: boolean }>).detail;
      if (detail) setMuted(detail.muted);
    };
    window.addEventListener('vertice:chime-muted-change', handler as EventListener);
    return () => window.removeEventListener('vertice:chime-muted-change', handler as EventListener);
  }, []);

  if (!hydrated) {
    // Render placeholder con shape estable para evitar layout shift al hidratar.
    return <span className="inline-block size-7" aria-hidden />;
  }

  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? 'Activar sonido del micrófono' : 'Silenciar sonido del micrófono';

  const colorClass =
    surface === 'dark'
      ? 'text-[color:var(--survey-card-1-fg-faint)] hover:text-[color:var(--survey-card-1-fg)]'
      : 'text-foreground/55 hover:text-foreground';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={muted}
      title={label}
      onClick={() => setChimeMuted(!muted)}
      className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors ${colorClass}`}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
    </button>
  );
}
