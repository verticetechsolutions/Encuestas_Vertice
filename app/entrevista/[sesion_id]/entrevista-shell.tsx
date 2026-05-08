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
import { VertexMark } from '@/components/landing/VertexMark';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import { GrupoUISchema, getCajaAny, type GrupoUI } from '@/lib/schemas/cajas';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
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
  const mensaje_estado = useEntrevistaStore((s) => s.mensaje_estado);
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
  const sesionCerrada = status === 'cerrada';

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
      {/* Header navy ink — espejo del landing. VertexMark real + acentos gold. */}
      <header className="relative bg-ink text-cream-pure">
        {/* Atmosphere overlay sutil — radial gold + noise, 30% intensidad landing */}
        <div
          aria-hidden
          className="atmosphere-radial-gold pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden
          className="atmosphere-noise pointer-events-none absolute inset-0"
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 md:px-8">
          <div className="flex items-center gap-3.5">
            <div className="relative aspect-[1380/1093] w-9 shrink-0">
              <VertexMark
                variant="inline"
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="leading-tight">
              <p className="text-eyebrow text-cream-pure/55">
                Vértice
              </p>
              <p className="mt-1.5 text-sm font-medium tracking-tight text-cream-pure">
                Entrevista de criterios
              </p>
            </div>
          </div>
          <div className="hidden items-center md:flex">
            {preview ? (
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-eyebrow text-gold-bright ring-1 ring-gold/35">
                <span
                  className="size-1.5 rounded-full bg-gold-bright animate-pulse-ring"
                  aria-hidden
                />
                Preview UI
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-eyebrow text-cream-pure/55">
                <span
                  className="size-1.5 rounded-full bg-gold animate-pulse-ring"
                  aria-hidden
                />
                Borrador autoguardado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 rounded-full bg-cream-pure/[0.06] px-2.5 py-1.5 ring-1 ring-cream-pure/15 transition-colors hover:ring-cream-pure/25">
            <div className="flex size-7 items-center justify-center rounded-full bg-gold text-ink text-xs font-semibold">
              {nombre_institucion.charAt(0)}
            </div>
            <span className="hidden pr-1 text-sm font-medium tracking-tight text-cream-pure md:inline">
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
            {/* Eyebrow + BatchNav — manifiesto landing-style M0X */}
            <div className="mb-6 flex flex-col items-center gap-4 md:mb-8">
              <p className="text-eyebrow flex items-center gap-2.5 text-foreground/45">
                <span className="tabular-nums text-gold-deep">
                  M{(GrupoUISchema.options.indexOf(grupoActivo) + 1)
                    .toString()
                    .padStart(2, '0')}
                </span>
                <span className="size-1 rounded-full bg-gold/55" aria-hidden />
                <span>{GRUPO_LABEL[grupoActivo]}</span>
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

            {/* Hero pregunta, skeleton, o pantalla de cierre limpio */}
            {sesionCerrada ? (
              <div className="rounded-3xl bg-cream px-6 py-16 text-center ring-1 ring-forest/15 shadow-sm animate-fade-up md:px-10 md:py-20">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-forest/10">
                  <CheckCircle2 className="size-7 text-forest" />
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  Entrevista completada
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {mensaje_estado ??
                    'Estamos generando la síntesis del perfil. Recibirás el resultado por correo cuando esté listo.'}
                </p>
              </div>
            ) : activePregunta ? (
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
                sttEnabled={!preview}
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

            {/* Banner informativo (cierre de sección, transición, etc) — verde forest */}
            {!sesionCerrada && mensaje_estado && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-forest/8 p-4 ring-1 ring-forest/20 animate-fade-up">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" />
                <p className="text-sm leading-relaxed text-foreground/85">
                  {mensaje_estado}
                </p>
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

            {/* Send turno CTA — destaca cuando todas marcadas. Oculto al cerrar sesión. */}
            {batch && !sesionCerrada && (
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
