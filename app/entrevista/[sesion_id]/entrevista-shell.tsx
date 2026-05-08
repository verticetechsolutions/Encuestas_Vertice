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
import { HeroPregunta } from '@/components/entrevista/HeroPregunta';
import { BatchNav } from '@/components/entrevista/BatchNav';
import { PanelProgreso } from '@/components/entrevista/PanelProgreso';
import { Stepper } from '@/components/entrevista/Stepper';
import { VertexMark } from '@/components/landing/VertexMark';
import { BrandSuccessGlyph } from '@/components/landing/BrandSuccessGlyph';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import { GrupoUISchema, getCajaAny, type GrupoUI } from '@/lib/schemas/cajas';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
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
    <div className="relative min-h-screen overflow-x-clip bg-canvas">
      {/* Atmosphere overlays globales — radial gold + noise sutil, espejo del
          landing. Pointer-events none para no robar interacción. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 atmosphere-radial-gold"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 atmosphere-noise"
      />

      {/* Container — todo en cards apiladas sobre el mismo canvas, sin bandas
          full-width. Header navy se vuelve un card más, no una sección aparte. */}
      <main className="relative z-10 mx-auto max-w-6xl space-y-4 px-4 py-6 md:space-y-5 md:px-8 md:py-8">
        {/* Card navy — VertexMark + brand + status + avatar */}
        <div className="relative overflow-hidden rounded-3xl bg-ink text-cream-pure shadow-xl shadow-ink/30 ring-1 ring-ink/40">
          <div
            aria-hidden
            className="atmosphere-radial-gold pointer-events-none absolute inset-0"
          />
          <div
            aria-hidden
            className="atmosphere-noise pointer-events-none absolute inset-0"
          />
          <div className="relative flex items-center justify-between gap-4 px-5 py-3.5 md:px-7">
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
        </div>

        {/* Card body — stepper + hero pregunta + send + panel */}
        <div className="gold-seam rounded-[28px] bg-cream-pure/85 p-3 shadow-xl shadow-ink/5 backdrop-blur md:p-5">
          {/* Top: stepper + chip progreso global */}
          <div className="gold-seam rounded-3xl bg-cream-pure p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Stepper
                porGrupo={cajas_llenas_por_grupo}
                activo={grupoActivo}
              />
              <div className="flex items-center gap-2.5 self-start rounded-full bg-cream-pure px-3 py-1.5 ring-1 ring-ink/10 lg:self-center">
                <Sparkles className="size-3 text-gold-deep" />
                <span className="font-mono text-[11px] tabular-nums tracking-tight text-foreground/85">
                  {cajasGlobal.llenas}
                  <span className="text-foreground/45">/{cajasGlobal.total}</span>
                </span>
                <span className="text-eyebrow text-foreground/45">cajas</span>
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
              <div className="gold-seam rounded-3xl bg-cream-pure px-6 py-16 text-center shadow-sm animate-fade-up md:px-10 md:py-20">
                <div className="flex justify-center">
                  <BrandSuccessGlyph size={72} />
                </div>
                <p className="text-eyebrow mt-9 text-gold-deep">
                  Sesión cerrada
                </p>
                <h2 className="mt-5 text-display text-[28px] leading-[1.05] tracking-[-0.025em] text-foreground md:text-[36px]">
                  Entrevista completada.
                </h2>
                <span aria-hidden className="gold-hairline mx-auto mt-6 block w-12" />
                <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-foreground/55">
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
              <div className="gold-seam flex items-center justify-center gap-3 rounded-3xl bg-cream-pure py-20 shadow-sm">
                <Loader2 className="size-5 animate-spin text-gold-deep" />
                <p className="text-sm text-foreground">
                  {status === 'enviando'
                    ? 'Enviando tus respuestas al motor…'
                    : 'Generando las próximas preguntas…'}
                </p>
              </div>
            ) : (
              <div className="gold-seam rounded-3xl bg-cream-pure py-20 text-center shadow-sm">
                <p className="text-sm text-foreground/55">Cargando preguntas…</p>
              </div>
            )}

            {/* Banner informativo (cierre de sección, transición, etc) — gold */}
            {!sesionCerrada && mensaje_estado && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-gold/8 p-4 ring-1 ring-gold/30 animate-fade-up">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold-deep" />
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

            {/* Send turno CTA — pill anidado estilo landing.
                Activo (todasMarcadas): bg-cream-pure + sub-pill ink + arrow gold.
                Pendiente: bg-ink + sub-pill ink + arrow gold. */}
            {batch && !sesionCerrada && (
              <div
                className={cn(
                  'mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between md:mt-8',
                  'rounded-2xl bg-cream-pure p-4 ring-1 ring-ink/8 shadow-sm transition-all duration-500',
                  todasMarcadas && !enError && 'ring-gold/45 bg-gold/[0.06]'
                )}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium tracking-tight text-foreground">
                    {(() => {
                      const pendientes = batch.preguntas.filter((p) => !marcadas[p.id]).length;
                      if (todasMarcadas) return '¡Listo para enviar!';
                      return `${pendientes} pregunta${pendientes === 1 ? '' : 's'} por marcar`;
                    })()}
                  </p>
                  <p className="text-[11px] leading-relaxed text-foreground/55">
                    {todasMarcadas
                      ? 'La IA generará las próximas preguntas con base en tus respuestas.'
                      : 'Marca cada respuesta para habilitar el envío del turno.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void enviarBatch()}
                  disabled={!todasMarcadas || enviando}
                  className={cn(
                    'group/send relative inline-flex h-12 items-center gap-3 rounded-full pl-6 pr-2 text-[13.5px] font-medium tracking-tight transition-all',
                    'will-change-transform active:scale-[0.99] disabled:cursor-not-allowed',
                    todasMarcadas && !enError
                      ? // CTA cream protagonista — espejo de "Solicitar alianza"
                        [
                          'bg-cream-pure text-ink',
                          'shadow-[0_0_0_1px_rgb(10_15_28_/_0.04),0_30px_70px_-20px_rgb(200_168_100_/_0.45)]',
                          'hover:bg-white',
                          !enviando && 'animate-pulse-ring',
                        ]
                      : // CTA ink dimmed — espejo del SubmitButton del landing
                        [
                          'bg-ink text-cream-pure',
                          'hover:bg-ink-raised',
                          'disabled:opacity-50',
                        ]
                  )}
                >
                  {status === 'enviando' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando…
                      <span
                        aria-hidden
                        className="inline-flex size-9 items-center justify-center rounded-full bg-gold/20 text-gold-bright"
                      >
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </>
                  ) : status === 'procesando' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Procesando…
                      <span
                        aria-hidden
                        className="inline-flex size-9 items-center justify-center rounded-full bg-gold/20 text-gold-bright"
                      >
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </>
                  ) : enError ? (
                    <>
                      Reintentar envío
                      <span
                        aria-hidden
                        className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-gold transition-transform group-hover/send:rotate-45"
                      >
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </>
                  ) : (
                    <>
                      Enviar turno
                      <span
                        aria-hidden
                        className={cn(
                          'inline-flex size-9 items-center justify-center rounded-full transition-transform group-hover/send:rotate-45',
                          todasMarcadas
                            ? 'bg-ink text-gold'
                            : 'bg-cream-pure/15 text-cream-pure/55'
                        )}
                      >
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Panel progreso opcional — collapse para no robar foco */}
            <details className="group/panel mt-4">
              <summary className="cursor-pointer rounded-2xl bg-cream-pure px-5 py-3 text-xs font-medium tracking-tight text-foreground/85 ring-1 ring-ink/8 shadow-sm transition-colors hover:bg-cream-pure/80 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-eyebrow text-foreground/45">
                      Progreso por sección
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-foreground/45 transition-transform group-open/panel:rotate-180" />
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
