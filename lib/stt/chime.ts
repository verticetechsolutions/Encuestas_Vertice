'use client';

// Audio feedback chime para STT: dos tones sintéticos cortos (~150ms cada uno)
// que confirman al entrevistado cuándo arrancó y cuándo paró la grabación.
// Sin assets: oscillator + gain envelope vía Web Audio API.
//
// Diseño:
//   - Start chime: tono ascendente 600 → 900 Hz, sine wave, gain pico 0.08.
//   - Stop chime: tono descendente 700 → 400 Hz, sine wave, gain pico 0.08.
//   - Envelope: attack 10ms, release 140ms (total 150ms), sin clipping.
//   - Volumen bajo intencional. El UI tiene mute toggle (no implementado aún;
//     mute via prefers-reduced-motion no aplica, audio es señal funcional).
//
// El AudioContext se crea lazy en el primer playStartChime (algunos browsers
// requieren un user gesture previo, garantizado porque el chime se dispara
// post-click del mic). El context se reutiliza entre chimes.

let chimeContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (chimeContext && chimeContext.state !== 'closed') return chimeContext;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    chimeContext = new Ctx();
    return chimeContext;
  } catch {
    return null;
  }
}

interface ChimeParams {
  fromHz: number;
  toHz: number;
  durationMs: number;
  peakGain: number;
}

function playChime({ fromHz, toHz, durationMs, peakGain }: ChimeParams): void {
  const ctx = getContext();
  if (!ctx) return;
  // Si el context quedó suspended (autoplay policy), resume best-effort.
  // resume() devuelve promise; no esperamos para no bloquear el caller.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // si no resume, el chime no suena pero el caller no debe romperse
    });
  }

  const now = ctx.currentTime;
  const duration = durationMs / 1000;
  const attack = 0.01;
  const release = duration - attack;

  try {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, now);
    osc.frequency.exponentialRampToValueAtTime(toHz, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // best-effort: si el browser rechaza por cualquier razón, el caller no debe romperse.
  }
}

export function playStartChime(): void {
  playChime({ fromHz: 600, toHz: 900, durationMs: 150, peakGain: 0.08 });
}

export function playStopChime(): void {
  playChime({ fromHz: 700, toHz: 400, durationMs: 150, peakGain: 0.08 });
}

// Dev-only hook para validar el chime sin necesitar permission de micrófono.
// Expone window.__verticeChime con las dos funciones cuando NODE_ENV !== 'production'.
// El bundler tree-shake esto en build de prod.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { __verticeChime?: { start: () => void; stop: () => void } }).__verticeChime = {
    start: playStartChime,
    stop: playStopChime,
  };
}
