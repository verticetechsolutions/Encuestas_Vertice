'use client';

// Manual-QA route for the Deepgram STT layer. Renders the MicButton and
// TranscriptionPanel against the live useDeepgramStream hook so the founder
// can validate transcription quality, latency, mute handling, and inline
// edits before this gets wired into the entrevista motor.
//
// Requires a valid `vertice_session` cookie — /api/stt/token will 401
// otherwise. To QA: log in via magic link first, then navigate here.

import { MicButton } from '@/components/stt/MicButton';
import { TranscriptionPanel } from '@/components/stt/TranscriptionPanel';
import { useDeepgramStream } from '@/lib/stt/use-deepgram-stream';

export default function SttDemoPage() {
  const {
    status,
    error,
    errorCode,
    transcripts,
    pauseDetected,
    audioLevel,
    longRecordingWarning,
    metrics,
    start,
    stop,
    editSegment,
  } = useDeepgramStream();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Demo · Deepgram STT
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          QA manual del cliente Deepgram (Nova-3 multilingual · diarización ·
          keepalive + finalize + audio constraints + level meter). No está
          conectado al motor de entrevista — esto solo valida transcripción + UI.
        </p>
      </header>

      <section className="flex items-center gap-6">
        <MicButton
          status={status}
          error={error}
          errorCode={errorCode}
          audioLevel={audioLevel}
          onStart={() => void start()}
          onStop={() => void stop()}
        />
        <div className="flex flex-col gap-1 font-mono text-xs">
          <span>
            <span className="text-muted-foreground">Estado:</span> {status}
          </span>
          {errorCode && (
            <span>
              <span className="text-muted-foreground">Error code:</span> {errorCode}
            </span>
          )}
          <span>
            <span className="text-muted-foreground">Pausa &gt;1.5s:</span>{' '}
            {pauseDetected ? 'sí' : 'no'}
          </span>
          <span>
            <span className="text-muted-foreground">Audio level:</span>{' '}
            {audioLevel.toFixed(2)}
          </span>
          <span>
            <span className="text-muted-foreground">Segmentos finalizados:</span>{' '}
            {transcripts.history.length}
          </span>
          <span>
            <span className="text-muted-foreground">Time to open:</span>{' '}
            {metrics.timeToOpenMs !== null ? `${metrics.timeToOpenMs}ms` : '—'}
          </span>
          <span>
            <span className="text-muted-foreground">Time to first transcript:</span>{' '}
            {metrics.timeToFirstTranscriptMs !== null
              ? `${metrics.timeToFirstTranscriptMs}ms`
              : '—'}
          </span>
          <span>
            <span className="text-muted-foreground">Reconnects:</span>{' '}
            {metrics.reconnects}
          </span>
          <span>
            <span className="text-muted-foreground">KeepAlives sent:</span>{' '}
            {metrics.keepAlivesSent}
          </span>
          {longRecordingWarning && (
            <span className="text-amber-600">
              ⚠ Long recording: hit 25-min mark
            </span>
          )}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Transcripción
        </h2>
        <TranscriptionPanel transcripts={transcripts} onEdit={editSegment} />
        <p className="mt-2 text-xs text-muted-foreground">
          Final en negro · interim en gris · doble clic para editar (se marca
          como corregido manualmente con un punto dorado).
        </p>
      </section>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Requiere sesión activa (cookie <code>vertice_session</code>). Si el
        token endpoint regresa 401, abre un magic link primero.
      </footer>
    </main>
  );
}
