'use client';

// Client shell for the entrevista. Two-column layout (split-screen) per
// IMPLEMENTATION.md §8.2: preguntas a la izquierda, panel de progreso a la
// derecha. En móvil el panel colapsa a `<details>` arriba.
//
// Mock-driven: at mount llamamos `cargarFixtureMock()` para que el founder
// pueda ver la UI sin ANTHROPIC_API_KEY. Cuando /api/turn esté operativo,
// reemplazar `cargarFixtureMock` con un fetch al motor — el resto del shell
// (PreguntaCard, autosave, panel) ya queda intacto.

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PreguntaCard } from '@/components/entrevista/PreguntaCard';
import { PanelProgreso } from '@/components/entrevista/PanelProgreso';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import type { GrupoUI } from '@/lib/schemas/cajas';

interface Props {
  sesion_id: string;
  nombre_institucion: string;
  totales_por_grupo: Record<GrupoUI, number>;
}

export function EntrevistaShell({ sesion_id, nombre_institucion, totales_por_grupo }: Props) {
  const init = useEntrevistaStore((s) => s.init);
  const cargarFixtureMock = useEntrevistaStore((s) => s.cargarFixtureMock);
  const status = useEntrevistaStore((s) => s.status);
  const batch = useEntrevistaStore((s) => s.batch_actual);
  const respuestas = useEntrevistaStore((s) => s.respuestas_pendientes);
  const marcadas = useEntrevistaStore((s) => s.marcadas_respondidas);
  const autosave = useEntrevistaStore((s) => s.autosave_estado);
  const cajas_llenas_por_grupo = useEntrevistaStore((s) => s.cajas_llenas_por_grupo);
  const setRespuesta = useEntrevistaStore((s) => s.setRespuesta);
  const marcarRespondida = useEntrevistaStore((s) => s.marcarRespondida);
  const enviarBatch = useEntrevistaStore((s) => s.enviarBatch);

  // Init store on mount + load mock batch. The mock load is the only piece
  // that disappears once /api/turn is wired (replaced by a real fetch).
  useEffect(() => {
    init(sesion_id, totales_por_grupo);
    cargarFixtureMock();
  }, [sesion_id, totales_por_grupo, init, cargarFixtureMock]);

  const total = batch?.preguntas.length ?? 0;
  const todasMarcadas = total > 0 && batch!.preguntas.every((p) => marcadas[p.id] === true);
  const enviando = status === 'enviando';

  return (
    <div className="min-h-screen bg-background">
      {/* Header — sticky para que el contexto no se pierda al hacer scroll. */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vértice
            </p>
            <h1 className="font-heading text-lg leading-snug">{nombre_institucion}</h1>
          </div>
          {total > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground md:text-sm">
              Pregunta{total > 1 ? 's' : ''} 1–{total} de {total} en este turno
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        {/* Móvil: panel arriba colapsable. Desktop: oculto vía md:hidden, panel
            aparece como aside derecho en grid. */}
        <details className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            Ver progreso de cajas
          </summary>
          <div className="mt-4">
            <PanelProgreso porGrupo={cajas_llenas_por_grupo} />
          </div>
        </details>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="seccion-actual-heading" className="min-w-0">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sección actual
              </p>
              <h2 id="seccion-actual-heading" className="font-heading text-xl">
                Preguntas del turno
              </h2>
            </div>

            {batch === null && status !== 'enviando' && (
              <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
                <p className="text-sm text-muted-foreground">
                  Cargando preguntas…
                </p>
              </div>
            )}

            {batch !== null && (
              <div className="flex flex-col gap-4">
                {batch.preguntas.map((p, i) => (
                  <PreguntaCard
                    key={p.id}
                    pregunta={p}
                    numero={i + 1}
                    total={total}
                    texto={respuestas[p.id] ?? ''}
                    marcada={marcadas[p.id] === true}
                    autosave={autosave[p.id] ?? 'idle'}
                    onChangeTexto={(t) => setRespuesta(p.id, t)}
                    onToggleMarcada={(m) => marcarRespondida(p.id, m)}
                  />
                ))}

                <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {todasMarcadas
                      ? 'Todas las preguntas están marcadas — puedes enviar.'
                      : 'Marca cada respuesta para habilitar el envío del turno.'}
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    disabled={!todasMarcadas || enviando}
                    onClick={() => void enviarBatch()}
                  >
                    {enviando ? 'Enviando…' : 'Enviar turno'}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden md:block">
            <div className="sticky top-24">
              <PanelProgreso porGrupo={cajas_llenas_por_grupo} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
