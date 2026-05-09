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
import { Stepper } from '@/components/entrevista/Stepper';
import { BrandSuccessGlyph } from '@/components/landing/BrandSuccessGlyph';
import { useEntrevistaStore } from '@/lib/state/entrevista';
import { withViewTransition } from '@/lib/view-transitions';
import { getCajaAny, type GrupoUI } from '@/lib/schemas/cajas';
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

  return (
    <div className="relative min-h-screen overflow-x-clip bg-survey-bg">
      {/* Paleta A (2026-05-09): off-white pure como canvas, sin atmosphere overlay.
          El radial gold y el noise SVG distraen en una lectura de 12 min con un
          único punto de foco (la pregunta). Hairlines + tipografía hacen el resto. */}

      {/* BrandSuccessGlyph overlay — celebración editorial al cierre exitoso de
          turno. ~2.2s. */}
      {mostrandoGlyphTurno && (
        <div
          aria-live="polite"
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none animate-fade-up"
        >
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-survey-surface/95 px-14 py-12 backdrop-blur-md shadow-2xl shadow-ink/15 ring-1 ring-survey-hairline">
            <BrandSuccessGlyph size={72} />
            <p className="text-eyebrow text-gold-deep">Turno completado</p>
          </div>
        </div>
      )}

      {/* Header — full bleed, hairline bottom. F6 lo simplifica completo.
          Por ahora conservamos el card dark a max-w del contenedor único. */}
      <header className="relative z-10 border-b border-[color:var(--survey-hairline)] bg-survey-bg">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-6 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/Logo_blue.svg"
              alt="Vértice"
              width={7095}
              height={2369}
              priority
              className="h-6 w-auto select-none"
            />
            <span aria-hidden className="hidden h-5 w-px bg-[color:var(--survey-hairline-strong)] md:block" />
            <p className="hidden text-eyebrow text-[color:var(--ink)]/45 md:block">
              Entrevista de criterios
            </p>
          </div>
          <div className="flex items-center gap-3">
            {preview && (
              <span className="hidden items-center gap-2 text-eyebrow text-gold-deep md:inline-flex">
                <span
                  className="size-1.5 rounded-full bg-gold animate-pulse-ring"
                  aria-hidden
                />
                Preview UI
              </span>
            )}
            <span className="text-sm font-medium tracking-tight text-[color:var(--ink)]/85">
              {nombre_institucion}
            </span>
          </div>
        </div>
      </header>

      {/* Container único centrado. Single column max-w-720px, generous padding.
          Everything (stepper, pregunta, nav, banners) vive en este eje. */}
      <main className="relative z-10 mx-auto max-w-[720px] px-6 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24">
        {/* Stepper minimalista — sin pill wrapper. Vive directo sobre canvas. */}
        <Stepper porGrupo={cajas_llenas_por_grupo} activo={grupoActivo} />

        {/* Espacio entre stepper y pregunta — generoso para Typeform-feel */}
        <div className="mt-12 space-y-8 md:mt-16">
          {/* Glyph divider editorial entre secciones — marca el cambio
              tipográficamente sin texto adicional (estilo Stratechery * * *). */}
          {mostrandoDividerSeccion && (
            <div className="flex justify-center py-2 animate-fade-up">
              <span
                aria-hidden
                className="text-display text-gold text-[24px] tracking-[1em]"
              >
                ✦
              </span>
            </div>
          )}

          {/* Hero pregunta, loader, o pantalla de cierre.
              Sin card wrapper — la pregunta vive directo en canvas. */}
          {sesionCerrada ? (
            <div className="px-2 py-12 text-center animate-fade-up md:py-16">
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
              cajasObjetivo={activePregunta.cajas_objetivo}
              texto={respuestas[activePregunta.id] ?? ''}
              marcada={marcadas[activePregunta.id] === true}
              autosave={autosave[activePregunta.id] ?? 'idle'}
              onChangeTexto={(t) => setRespuesta(activePregunta.id, t)}
              onToggleMarcada={(m) => marcarRespondida(activePregunta.id, m)}
              sttEnabled={!preview}
            />
          ) : enviando ? (
            <div className="flex items-center justify-center gap-3 py-20">
              <Loader2 className="size-5 animate-spin text-gold-deep" />
              <p className="text-sm text-foreground/65">
                {status === 'enviando'
                  ? 'Enviando tus respuestas al motor…'
                  : 'Generando las próximas preguntas…'}
              </p>
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-sm text-foreground/55">Cargando preguntas…</p>
            </div>
          )}

          {/* BatchNav minimal — sin pill wrapper, alineado al center bajo la pregunta.
              F5 lo redibuja a "← Anterior · 1 / 3 ·" minimalista. */}
          {!sesionCerrada && batch && total > 0 && (
            <div className="flex items-center justify-center pt-4">
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
            <div className="flex items-start gap-3 rounded-xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/[0.06] p-4 animate-fade-up">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold-deep" />
              <p className="text-sm leading-relaxed text-foreground/85">
                {mensaje_estado}
              </p>
            </div>
          )}

          {/* Error banner */}
          {enError && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50 p-4 animate-fade-up">
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
      </main>
    </div>
  );
}
