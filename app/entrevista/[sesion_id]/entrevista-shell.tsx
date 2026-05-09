'use client';

// Shell de entrevista — pregunta-as-hero (2026-05-05 refactor).
// Decisión de UX: la pregunta activa es el foco absoluto. NO mostramos las 3
// preguntas del batch en stack — el usuario navega entre ellas con BatchNav.
// Eso fuerza atención plena a la pregunta presente y reduce la fricción de
// "responder rápido para terminar el formulario".
//
// Layout:
//   - Header dark ink (compact, espejo del landing)
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

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeroPregunta } from '@/components/entrevista/HeroPregunta';
import { BatchNav } from '@/components/entrevista/BatchNav';
import { RightRail } from '@/components/entrevista/RightRail';
import { Stepper } from '@/components/entrevista/Stepper';
import { BrandSuccessGlyph } from '@/components/landing/BrandSuccessGlyph';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import { withViewTransition } from '@/lib/view-transitions';
import { GrupoUISchema, getCajaAny, type GrupoUI } from '@/lib/schemas/cajas';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
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

  // Wrapper view-transition para navegación entre preguntas. En Chrome ≥111,
  // Edge, Safari 18+ activa la animación nativa CSS sobre `view-transition-name:
  // question-card` (declarada en HeroPregunta + globals.css). En el resto cae
  // al callback directo (no-op visual, sin throw).
  const navegarAPregunta = useCallback((idx: number) => {
    withViewTransition(() => setPregIndex(idx));
  }, []);

  // BrandSuccessGlyph overlay al cierre exitoso de turno. Detectamos transición
  // 'procesando' → 'mostrando_batch' (= turno enviado, IA respondió, llegó nuevo
  // batch). ~2.2s de display, después fade out. Refuerzo de progreso editorial.
  const [mostrandoGlyphTurno, setMostrandoGlyphTurno] = useState(false);
  const statusAnteriorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      statusAnteriorRef.current === 'procesando' &&
      status === 'mostrando_batch'
    ) {
      setMostrandoGlyphTurno(true);
      const t = setTimeout(() => setMostrandoGlyphTurno(false), 2200);
      statusAnteriorRef.current = status;
      return () => clearTimeout(t);
    }
    statusAnteriorRef.current = status;
  }, [status]);

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

  // Glyph divider entre transición de secciones (ej: Productos → Números).
  // Cuando grupoActivo cambia, mostramos un ✦ dorado durante 1.2s para
  // marcar tipográficamente el cambio sin romper el flujo de lectura.
  const [mostrandoDividerSeccion, setMostrandoDividerSeccion] = useState(false);
  const grupoAnteriorRef = useRef<GrupoUI | null>(null);
  useEffect(() => {
    if (grupoAnteriorRef.current && grupoAnteriorRef.current !== grupoActivo) {
      setMostrandoDividerSeccion(true);
      const t = setTimeout(() => setMostrandoDividerSeccion(false), 1200);
      grupoAnteriorRef.current = grupoActivo;
      return () => clearTimeout(t);
    }
    grupoAnteriorRef.current = grupoActivo;
  }, [grupoActivo]);

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
    <div className="relative min-h-screen overflow-x-clip bg-survey-bg">
      {/* Paleta A (2026-05-09): off-white pure como canvas, sin atmosphere overlay.
          El radial gold y el noise SVG distraen en una lectura de 12 min con un
          único punto de foco (la pregunta). Hairlines + tipografía hacen el resto. */}

      {/* BrandSuccessGlyph overlay — celebración editorial al cierre exitoso de
          turno. Refuerzo de progreso cinemático cada ~3 preguntas. ~2.2s. */}
      {mostrandoGlyphTurno && (
        <div
          aria-live="polite"
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none animate-fade-up"
        >
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-cream-pure/95 px-14 py-12 backdrop-blur-md shadow-2xl shadow-ink/25 ring-1 ring-ink/8">
            <BrandSuccessGlyph size={72} />
            <p className="text-eyebrow text-gold-deep">Turno completado</p>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-4">
              <Image
                src="/Logo_white.svg"
                alt="Vértice"
                width={7095}
                height={2369}
                priority
                className="h-6 w-auto select-none md:h-7"
              />
              <span aria-hidden className="hidden h-7 w-px bg-cream-pure/15 md:block" />
              <p className="hidden text-eyebrow text-cream-pure/55 md:block">
                Entrevista de criterios
              </p>
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

        {/* Card stepper — barra de secciones full width.
            User-facing: NO chip de counts absolutos (eran "0/54 cajas",
            término interno). El % global vive en RightRail. */}
        <div className="gold-seam rounded-3xl bg-cream-pure p-4 shadow-sm md:p-5">
          <Stepper porGrupo={cajas_llenas_por_grupo} activo={grupoActivo} />
        </div>

        {/* Grid 2 columnas: hero pregunta (lg:col-span-8) + sidebar (lg:col-span-4) */}
        <div className="grid gap-4 md:gap-5 lg:grid-cols-12">
          {/* Columna izquierda — pregunta protagonista. El contexto de
              sección vive en el Stepper arriba + en el header del HeroPregunta
              (vía seccionLabel). Eliminado eyebrow M0X redundante. */}
          <div className="space-y-4 md:space-y-5 lg:col-span-8">
            {/* Glyph divider editorial entre secciones — marca el cambio
                tipográficamente sin texto adicional (estilo Stratechery * * *). */}
            {mostrandoDividerSeccion && (
              <div className="flex justify-center py-6 animate-fade-up">
                <span
                  aria-hidden
                  className="text-display text-gold text-[28px] tracking-[1em]"
                >
                  ✦
                </span>
              </div>
            )}

            {/* Hero pregunta, loader, o pantalla de cierre */}
            {sesionCerrada ? (
              <div className="gold-seam rounded-3xl bg-cream-pure px-6 py-16 text-center shadow-sm animate-fade-up md:px-10 md:py-20">
                <div className="flex justify-center">
                  <BrandSuccessGlyph size={72} />
                </div>
                <p className="text-eyebrow mt-9 text-gold-deep">Sesión cerrada</p>
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

            {/* BatchNav inferior — navegación clara entre preguntas del turno.
                Eliminada la redundancia "Pregunta X / Y" (el dot activo ya
                comunica posición vía label P0X embedded). */}
            {!sesionCerrada && batch && total > 0 && (
              <div className="flex items-center justify-end rounded-2xl bg-cream-pure px-4 py-2.5 ring-1 ring-ink/8 shadow-sm md:px-5">
                <BatchNav
                  preguntas={batch.preguntas.map((p) => ({
                    id: p.id,
                    marcada: marcadas[p.id] === true,
                  }))}
                  activeIndex={pregIndex}
                  onChange={navegarAPregunta}
                />
              </div>
            )}

            {/* Banner informativo (cierre de sección, transición) */}
            {!sesionCerrada && mensaje_estado && (
              <div className="flex items-start gap-3 rounded-2xl bg-gold/8 p-4 ring-1 ring-gold/30 animate-fade-up">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold-deep" />
                <p className="text-sm leading-relaxed text-foreground/85">
                  {mensaje_estado}
                </p>
              </div>
            )}

            {/* Error banner */}
            {enError && (
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/70 animate-fade-up">
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
          </div>

          {/* Columna derecha — RightRail unificado: 2 secciones hairline
              (Turno + Progreso) en lugar de 3 cards apiladas. */}
          {!sesionCerrada && batch && activePregunta && (
            <div className="lg:col-span-4">
              <RightRail
                pendientes={batch.preguntas.filter((p) => !marcadas[p.id]).length}
                total={total}
                todasMarcadas={todasMarcadas}
                enviando={enviando}
                enError={enError}
                status={status}
                cajasObjetivo={activePregunta.cajas_objetivo}
                cajasGlobal={cajasGlobal}
                cajasPorGrupo={cajas_llenas_por_grupo}
                grupoActivo={grupoActivo}
                onEnviarBatch={() => void enviarBatch()}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
