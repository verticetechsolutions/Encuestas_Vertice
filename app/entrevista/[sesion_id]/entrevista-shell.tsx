'use client';

// Shell de entrevista — pregunta-as-hero (2026-05-05 refactor).
// Decisión de UX: la pregunta activa es el foco absoluto. NO mostramos las 3
// preguntas del batch en stack — el usuario navega entre ellas con BatchNav.
// Eso fuerza atención plena a la pregunta presente y reduce la fricción de
// "responder rápido para terminar el formulario".
//
// Layout:
//   - Header dark forest-deep (compact)
//   - Card outer cream con stepper + chip-progreso top
//   - Centered column max-w-3xl con:
//       eyebrow ("Pregunta X de Y · Sección …") + BatchNav
//       HeroPregunta (dominante)
//       Action row: Anterior · Enviar turno (cuando todas marcadas) · Siguiente
//   - Footer collapsible con PanelProgreso (detalle bajo demanda)
//
// Microanimaciones:
//   - HeroPregunta usa `key={activePregunta.id}` para retrigger animate-fade-up
//     en cada cambio (slide visual entre preguntas).
//   - Send turno button hace pulse-ring cuando todas marcadas (CTA breathing).

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HeroPregunta } from '@/components/entrevista/HeroPregunta';
import { BatchNav } from '@/components/entrevista/BatchNav';
import { PanelProgreso } from '@/components/entrevista/PanelProgreso';
import { Stepper } from '@/components/entrevista/Stepper';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import { GrupoUISchema, getCajaAny, type GrupoUI } from '@/lib/schemas/cajas';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface Props {
  sesion_id: string;
  nombre_institucion: string;
  totales_por_grupo: Record<GrupoUI, number>;
  /** Cuando true, el store no toca DB ni /api/turn — todo simulado en memoria. */
  preview?: boolean;
}

const GRUPO_LABEL: Record<GrupoUI, string> = {
  identificacion: 'Identidad',
  productos_y_mercado: 'Productos y mercado',
  numeros_del_negocio: 'Números del negocio',
  operacion: 'Operación',
  pricing_y_criterio: 'Pricing y criterio',
  contacto_y_especificos: 'Contacto y específicos',
};

function inferGrupoActivo(cajasObjetivo: string[] | undefined): GrupoUI {
  if (!cajasObjetivo || cajasObjetivo.length === 0) return 'identificacion';
  for (const codigo of cajasObjetivo) {
    const canon = getCajaAny(codigo);
    if (canon) return canon.grupo_ui;
  }
  return 'identificacion';
}

export function EntrevistaShell({
  sesion_id,
  nombre_institucion,
  totales_por_grupo,
  preview = false,
}: Props) {
  const init = useEntrevistaStore((s) => s.init);
  const cargarFixtureMock = useEntrevistaStore((s) => s.cargarFixtureMock);
  const status = useEntrevistaStore((s) => s.status);
  const batch = useEntrevistaStore((s) => s.batch_actual);
  const respuestas = useEntrevistaStore((s) => s.respuestas_pendientes);
  const marcadas = useEntrevistaStore((s) => s.marcadas_respondidas);
  const autosave = useEntrevistaStore((s) => s.autosave_estado);
  const cajas_llenas_por_grupo = useEntrevistaStore(
    (s) => s.cajas_llenas_por_grupo
  );
  const ultimo_error_turn = useEntrevistaStore((s) => s.ultimo_error_turn);
  const setRespuesta = useEntrevistaStore((s) => s.setRespuesta);
  const marcarRespondida = useEntrevistaStore((s) => s.marcarRespondida);
  const enviarBatch = useEntrevistaStore((s) => s.enviarBatch);

  // Índice de la pregunta activa dentro del batch. Local porque es UI-only;
  // no necesitamos persistir cuál es la pregunta visible al recargar (el batch
  // se rehidrata del fixture/api y el índice se reinicia).
  const [pregIndex, setPregIndex] = useState(0);

  useEffect(() => {
    init(sesion_id, totales_por_grupo, { preview });
    cargarFixtureMock();
  }, [sesion_id, totales_por_grupo, preview, init, cargarFixtureMock]);

  // Reset índice al llegar batch nuevo. batch.id cambia entre turnos de Sonnet.
  useEffect(() => {
    if (batch?.id) setPregIndex(0);
  }, [batch?.id]);

  const total = batch?.preguntas.length ?? 0;
  const todasMarcadas =
    total > 0 && batch!.preguntas.every((p) => marcadas[p.id] === true);
  const enviando = status === 'enviando' || status === 'procesando';
  const enError = status === 'error_turn';

  const activePregunta = batch?.preguntas[pregIndex] ?? null;

  const grupoActivo: GrupoUI = useMemo(() => {
    if (activePregunta) {
      return inferGrupoActivo(activePregunta.cajas_objetivo);
    }
    return 'identificacion';
  }, [activePregunta]);

  // Total cajas llenas global — chip discreto arriba.
  const cajasGlobal = useMemo(() => {
    const grupos = GrupoUISchema.options;
    return grupos.reduce(
      (acc, g) => {
        acc.llenas += cajas_llenas_por_grupo[g].llenas;
        acc.total += cajas_llenas_por_grupo[g].total;
        return acc;
      },
      { llenas: 0, total: 0 }
    );
  }, [cajas_llenas_por_grupo]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header dark forest — minimal */}
      <header className="bg-forest-deep text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
              <span className="text-xs font-bold tracking-tight">V</span>
            </div>
            <div className="leading-tight">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground/60">
                Vértice
              </p>
              <p className="text-sm font-medium tracking-tight">
                Entrevista de criterios
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-primary-foreground/65 md:flex">
            {preview ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime ring-1 ring-lime/30">
                <span
                  className="size-1.5 rounded-full bg-lime animate-pulse-ring"
                  aria-hidden
                />
                Preview UI
              </span>
            ) : (
              <>
                <span
                  className="size-1.5 rounded-full bg-lime/80 animate-pulse-ring"
                  aria-hidden
                />
                <span>Borrador autoguardado</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-forest/40 px-2.5 py-1.5 ring-1 ring-primary-foreground/10">
            <div className="flex size-7 items-center justify-center rounded-full bg-lime text-lime-foreground text-xs font-semibold">
              {nombre_institucion.charAt(0)}
            </div>
            <span className="hidden text-sm font-medium md:inline">
              {nombre_institucion}
            </span>
          </div>
        </div>
      </header>

      {/* Container */}
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="rounded-[28px] bg-cream/85 p-3 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur md:p-5">
          {/* Top: stepper + chip progreso global */}
          <div className="rounded-3xl bg-cream p-4 ring-1 ring-foreground/5 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Stepper
                porGrupo={cajas_llenas_por_grupo}
                activo={grupoActivo}
              />
              <div className="flex items-center gap-2 self-start rounded-full bg-muted/50 px-3 py-1.5 ring-1 ring-foreground/8 lg:self-center">
                <Sparkles className="size-3 text-forest" />
                <span className="font-mono text-[11px] tabular-nums tracking-tight text-foreground/80">
                  {cajasGlobal.llenas}
                  <span className="text-muted-foreground">/{cajasGlobal.total}</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  cajas
                </span>
              </div>
            </div>
          </div>

          {/* Centered focus column */}
          <div className="mx-auto mt-6 max-w-3xl px-1 md:mt-8">
            {/* Eyebrow + BatchNav */}
            <div className="mb-6 flex flex-col items-center gap-4 md:mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Sección actual · {GRUPO_LABEL[grupoActivo]}
              </p>
              {batch && total > 0 && (
                <BatchNav
                  preguntas={batch.preguntas.map((p) => ({
                    id: p.id,
                    marcada: marcadas[p.id] === true,
                  }))}
                  activeIndex={pregIndex}
                  onChange={setPregIndex}
                />
              )}
            </div>

            {/* Hero pregunta o skeleton */}
            {activePregunta ? (
              <HeroPregunta
                pregunta={activePregunta}
                numero={pregIndex + 1}
                total={total}
                seccionLabel={GRUPO_LABEL[grupoActivo]}
                texto={respuestas[activePregunta.id] ?? ''}
                marcada={marcadas[activePregunta.id] === true}
                autosave={autosave[activePregunta.id] ?? 'idle'}
                onChangeTexto={(t) => setRespuesta(activePregunta.id, t)}
                onToggleMarcada={(m) => marcarRespondida(activePregunta.id, m)}
              />
            ) : enviando ? (
              <div className="flex items-center justify-center gap-3 rounded-3xl bg-cream py-20 ring-1 ring-foreground/5 shadow-sm">
                <Loader2 className="size-5 animate-spin text-forest" />
                <p className="text-sm text-foreground">
                  {status === 'enviando'
                    ? 'Enviando tus respuestas al motor…'
                    : 'Generando las próximas preguntas…'}
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-cream py-20 text-center ring-1 ring-foreground/5 shadow-sm">
                <p className="text-sm text-muted-foreground">Cargando preguntas…</p>
              </div>
            )}

            {/* Error banner */}
            {enError && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/70 animate-fade-up">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div className="text-sm leading-relaxed text-amber-900">
                  <p className="font-medium">No se pudo continuar el turno.</p>
                  <p className="mt-0.5 text-amber-900/80">
                    {ultimo_error_turn ?? 'Error desconocido.'}
                  </p>
                  <p className="mt-1.5 text-xs text-amber-900/70">
                    Tus respuestas se conservaron. Reintenta cuando quieras.
                  </p>
                </div>
              </div>
            )}

            {/* Send turno CTA — destaca cuando todas marcadas */}
            {batch && (
              <div
                className={cn(
                  'mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between md:mt-8',
                  'rounded-2xl bg-cream p-4 ring-1 ring-foreground/5 shadow-sm transition-all duration-500',
                  todasMarcadas && !enError && 'ring-lime/60 bg-lime/15'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-semibold tracking-tight text-foreground">
                    {(() => {
                      const pendientes = batch.preguntas.filter((p) => !marcadas[p.id]).length;
                      if (todasMarcadas) return '¡Listo para enviar!';
                      return `${pendientes} pregunta${pendientes === 1 ? '' : 's'} por marcar`;
                    })()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {todasMarcadas
                      ? 'La IA generará las próximas preguntas con base en tus respuestas.'
                      : 'Marca cada respuesta para habilitar el envío del turno.'}
                  </p>
                </div>
              <Button
                type="button"
                size="lg"
                onClick={() => void enviarBatch()}
                disabled={!todasMarcadas || enviando}
                className={cn(
                  'h-12 rounded-full px-6 text-sm font-semibold tracking-tight transition-all',
                  'bg-forest text-primary-foreground hover:bg-forest-soft active:scale-[0.98]',
                  todasMarcadas &&
                    !enError &&
                    'bg-lime text-lime-foreground hover:bg-lime/90 shadow-md',
                  todasMarcadas && !enError && !enviando && 'animate-pulse-ring',
                  'disabled:opacity-60'
                )}
              >
                {status === 'enviando' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando…
                  </>
                ) : status === 'procesando' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando…
                  </>
                ) : enError ? (
                  <>
                    Reintentar envío
                    <ArrowRight className="size-4" />
                  </>
                ) : (
                  <>
                    Enviar turno
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              </div>
            )}

            {/* Panel progreso opcional — collapse para no robar foco */}
            <details className="group/panel mt-4">
              <summary className="cursor-pointer rounded-2xl bg-cream px-5 py-3 text-xs font-semibold tracking-tight text-foreground/85 ring-1 ring-foreground/5 shadow-sm transition-colors hover:bg-cream/80 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Progreso por sección
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/panel:rotate-180" />
                </span>
              </summary>
              <div className="mt-3 animate-fade-up">
                <PanelProgreso
                  porGrupo={cajas_llenas_por_grupo}
                  grupoActivo={grupoActivo}
                />
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
