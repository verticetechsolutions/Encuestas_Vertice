'use client';

// Single pregunta card. The textarea fires `onChange` directly into the store —
// the store handles autosave debounce (1.5s). The mic slot is currently a
// disabled placeholder; the real Deepgram integration lives at
// `lib/stt/use-deepgram-stream.ts` + `components/stt/MicButton.tsx` and gets
// wired in Fase 6 when DEEPGRAM_API_KEY is available.

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, Mic } from 'lucide-react';
import type { Pregunta, AutosaveStatus } from '@/lib/state/entrevista';
import { cn } from '@/lib/utils';

interface Props {
  pregunta: Pregunta;
  numero: number;
  total: number;
  texto: string;
  marcada: boolean;
  autosave: AutosaveStatus;
  onChangeTexto: (texto: string) => void;
  onToggleMarcada: (marcada: boolean) => void;
}

function autosaveLabel(status: AutosaveStatus): { text: string; tone: 'muted' | 'success' | 'warn' } {
  switch (status) {
    case 'pending':
      return { text: 'Por guardar…', tone: 'muted' };
    case 'saving':
      return { text: 'Guardando…', tone: 'muted' };
    case 'saved':
      return { text: 'Guardado', tone: 'success' };
    case 'error':
      return { text: 'No se pudo guardar (seguirá intentando)', tone: 'warn' };
    case 'idle':
    default:
      return { text: '', tone: 'muted' };
  }
}

export function PreguntaCard({
  pregunta,
  numero,
  total,
  texto,
  marcada,
  autosave,
  onChangeTexto,
  onToggleMarcada,
}: Props) {
  const [showMicTooltip, setShowMicTooltip] = useState(false);
  const label = autosaveLabel(autosave);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Pregunta {numero} de {total}
          </span>
          {marcada && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <Check className="size-3" />
              Respondida
            </span>
          )}
        </div>
        <CardTitle className="text-base leading-snug">{pregunta.texto_pregunta}</CardTitle>
      </CardHeader>

      <CardContent>
        <Textarea
          value={texto}
          onChange={(e) => onChangeTexto(e.target.value)}
          placeholder="Escribe tu respuesta aquí…"
          rows={4}
          className="min-h-28"
          aria-label={`Respuesta a la pregunta ${numero}`}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span
            className={cn(
              'text-xs',
              label.tone === 'success' && 'text-emerald-700',
              label.tone === 'warn' && 'text-amber-700',
              label.tone === 'muted' && 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {label.text || ' '}
          </span>

          {/* Mic slot — disabled placeholder. Tooltip on focus/hover explica el
              gating de Deepgram. La integración real existe en
              `components/stt/MicButton.tsx` + `lib/stt/use-deepgram-stream.ts`,
              pero requiere DEEPGRAM_API_KEY. */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              onMouseEnter={() => setShowMicTooltip(true)}
              onMouseLeave={() => setShowMicTooltip(false)}
              onFocus={() => setShowMicTooltip(true)}
              onBlur={() => setShowMicTooltip(false)}
              aria-describedby={`mic-tooltip-${pregunta.id}`}
            >
              <Mic className="size-4" />
              Activar micrófono
            </Button>
            {showMicTooltip && (
              <div
                id={`mic-tooltip-${pregunta.id}`}
                role="tooltip"
                className="absolute right-0 top-full mt-2 z-10 w-64 rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-lg"
              >
                Disponible al integrar Deepgram (Fase 6).
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          type="button"
          variant={marcada ? 'secondary' : 'default'}
          size="sm"
          onClick={() => onToggleMarcada(!marcada)}
        >
          {marcada ? (
            <>
              <Check className="size-4" />
              Marcada como respondida
            </>
          ) : (
            'Marcar respondida'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
