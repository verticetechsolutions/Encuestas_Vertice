// Detalle de sesión — vista de auditoría profunda con design system
// coherente con /admin (Resumen) y /admin/sesiones. Mismo lenguaje visual:
// hero card con organic extrusion, sections squircle bg-cream-pure, cards
// con left rail accent y status pills tintados.
//
// Siete secciones:
//   1. Hero (institución + status + 5 KPIs)
//   2. Turnos de conversación (cards individuales con rol-tinted)
//   3. Extracciones (cards con supersede chain visible)
//   4. Casos sintéticos (cap 5/sesión)
//   5. Reviews y declinadas (handoff Sonnet→Opus)
//   6. Perfil de sesión
//   7. Metadata bruto

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  instituciones,
  turnos_conversacion,
  extracciones,
  casos_generados,
  reviews_seccion,
  cajas_declinadas,
  perfil_decision_final,
} from '@/db/schema';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import type { SesionStatus } from '@/lib/admin/parse-status-filter';
import { SectionCard } from '@/components/admin/section-card';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  abierta: 'var(--gold)',
  pausada: '#D4A862',
  sintetizando: 'var(--gold-bright)',
  completa: 'var(--ink)',
  abandonada: 'rgb(10 15 28 / 0.30)',
};

const STATUS_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  pausada: 'Pausada',
  sintetizando: 'Sintetizando',
  completa: 'Completa',
  abandonada: 'Abandonada',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSesionDetailPage({ params }: Props) {
  const { id } = await params;

  const [row] = await db
    .select({
      sesion: sesiones,
      institucion: instituciones,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(eq(sesiones.id, id))
    .limit(1);
  if (!row) notFound();

  const [
    turnos,
    extraccionesActivas,
    casos,
    reviews,
    declinadas,
    perfilSesionRows,
  ] = await Promise.all([
    db
      .select()
      .from(turnos_conversacion)
      .where(eq(turnos_conversacion.sesion_id, id))
      .orderBy(asc(turnos_conversacion.numero_turno)),
    db
      .select()
      .from(extracciones)
      .where(eq(extracciones.sesion_id, id))
      .orderBy(desc(extracciones.created_at)),
    db
      .select()
      .from(casos_generados)
      .where(eq(casos_generados.sesion_id, id))
      .orderBy(asc(casos_generados.numero_caso)),
    db
      .select()
      .from(reviews_seccion)
      .where(eq(reviews_seccion.sesion_id, id))
      .orderBy(asc(reviews_seccion.created_at)),
    db
      .select()
      .from(cajas_declinadas)
      .where(eq(cajas_declinadas.sesion_id, id))
      .orderBy(asc(cajas_declinadas.declinada_at)),
    db
      .select()
      .from(perfil_decision_final)
      .where(eq(perfil_decision_final.sesion_id, id))
      .orderBy(desc(perfil_decision_final.version))
      .limit(1),
  ]);

  const perfilSesion = perfilSesionRows[0] ?? null;
  const activas = extraccionesActivas.filter((e) => e.superseded_by === null);
  const supersedidas = extraccionesActivas.length - activas.length;
  const statusKey = row.sesion.status as SesionStatus;
  const statusColor = STATUS_COLOR[statusKey] ?? 'var(--gold)';
  const statusLabel = STATUS_LABEL[statusKey] ?? row.sesion.status;

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      {/* Breadcrumb back */}
      <Link
        href={`/admin/instituciones/${row.institucion.id}`}
        className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/55 transition hover:text-foreground"
      >
        <ArrowLeft
          className="size-3.5 transition group-hover:-translate-x-0.5"
          strokeWidth={1.75}
        />
        Volver a {row.institucion.razon_social}
      </Link>

      {/* ════════════════════════════════════════════════════════════════
          HERO — organic extrusion bottom-left + atmosphere
          ════════════════════════════════════════════════════════════════ */}
      <HeroSesionCard
        razonSocial={row.institucion.razon_social}
        sesionId={row.sesion.id}
        statusLabel={statusLabel}
        statusColor={statusColor}
        cajasLlenas={row.sesion.cajas_llenas_count}
        cajasAplicables={row.sesion.cajas_aplicables}
        startedAt={row.sesion.started_at}
        ultimoTurnoAt={row.sesion.ultimo_turno_at}
        consentimientoAt={row.sesion.consentimiento_at}
        fatigaDetectada={row.sesion.fatiga_detectada}
      />

      {/* ════════════════════════════════════════════════════════════════
          TURNOS
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Conversación"
        title="Turnos"
        count={turnos.length}
        defaultOpen={turnos.length > 0 && turnos.length <= 30}
      >
        {turnos.length === 0 ? (
          <Empty message="Sin turnos registrados todavía." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {turnos.map((t) => (
              <TurnoCard
                key={t.id}
                numero={t.numero_turno}
                rol={t.rol as 'agente' | 'usuario'}
                contenido={t.contenido_texto}
                fuente={t.fuente}
                modelo={t.modelo_llm}
                tokensIn={t.tokens_input}
                tokensOut={t.tokens_output}
                latenciaMs={t.latencia_ms}
                createdAt={t.created_at}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          EXTRACCIONES
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Datos extraídos"
        title="Extracciones"
        rightHint={`${activas.length} activas · ${supersedidas} supersedidas`}
        defaultOpen={extraccionesActivas.length > 0 && activas.length <= 30}
      >
        {extraccionesActivas.length === 0 ? (
          <Empty message="Sin extracciones." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {extraccionesActivas.map((e) => (
              <ExtraccionCard
                key={e.id}
                cajaCodigo={e.caja_codigo}
                valor={e.valor}
                confianza={e.confianza}
                superseded={e.superseded_by !== null}
                fuente={e.fuente}
                createdAt={e.created_at}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          CASOS
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Síntéticos"
        title="Casos"
        count={casos.length}
        rightHint={`${casos.length}/5`}
        defaultOpen={casos.length > 0}
      >
        {casos.length === 0 ? (
          <Empty message="Sin casos solicitados todavía." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {casos.map((c) => (
              <CasoCard
                key={c.id}
                numero={c.numero_caso}
                estado={c.estado}
                cajasObjetivo={c.cajas_objetivo}
                contenido={c.contenido}
                createdAt={c.created_at}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          REVIEWS
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Handoff Opus"
        title="Reviews de sección"
        count={reviews.length}
        defaultOpen={reviews.length > 0}
      >
        {reviews.length === 0 ? (
          <Empty message="Sin reviews emitidos." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                grupoUiCodigo={r.grupo_ui_codigo}
                round={r.round}
                decisionOpus={r.decision_opus}
                siguienteGrupoUi={r.siguiente_grupo_ui}
                turnoDisparador={r.turno_disparador}
                createdAt={r.created_at}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          DECLINADAS
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Skip"
        title="Cajas declinadas"
        count={declinadas.length}
        defaultOpen={declinadas.length > 0}
      >
        {declinadas.length === 0 ? (
          <Empty message="Ninguna caja declinada — la sesión avanzó limpia." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {declinadas.map((d) => (
              <DeclinadaCard
                key={d.id}
                cajaCodigo={d.caja_codigo}
                razon={d.razon}
                detalle={d.detalle}
                declinadaAt={d.declinada_at}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          PERFIL
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Síntesis"
        title="Perfil de esta sesión"
        defaultOpen={Boolean(perfilSesion)}
      >
        {!perfilSesion ? (
          <Empty message="La síntesis aún no se ha generado para esta sesión." />
        ) : (
          <div className="flex flex-col gap-4 p-2 md:p-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCell label="Schema" value={perfilSesion.schema_version} mono />
              <StatCell
                label="Completitud"
                value={`${Math.round(perfilSesion.completitud * 100)}%`}
              />
              <StatCell
                label="Confianza global"
                value={perfilSesion.confianza_global.toFixed(2)}
                mono
              />
              <StatCell
                label="Versión"
                value={String(perfilSesion.version)}
                mono
              />
            </div>
            {perfilSesion.pdf_url ? (
              <a
                href={perfilSesion.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-cream-pure transition hover:bg-ink/90 active:scale-[0.99]"
                data-testid="pdf-download-link"
              >
                <span>Descargar PDF de síntesis</span>
                <ArrowUpRight className="size-3.5" strokeWidth={2} />
              </a>
            ) : (
              <p className="text-[12px] text-foreground/55">
                PDF aún no generado o storage no configurado (BLOB_READ_WRITE_TOKEN pendiente).
              </p>
            )}
            <details className="squircle group/json rounded-2xl bg-ink text-cream-pure">
              <summary className="cursor-pointer rounded-2xl px-5 py-3 text-[12px] font-semibold tracking-tight text-cream-pure/85 transition hover:text-cream-pure [&::-webkit-details-marker]:hidden">
                Ver JSON completo
              </summary>
              <pre
                data-lenis-prevent
                className="max-h-96 overflow-auto px-5 pb-5 font-mono text-[11px] leading-relaxed text-cream-pure/85"
              >
                {JSON.stringify(perfilSesion.perfil_json, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          METADATA BRUTO
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard eyebrow="Debug" title="Metadata bruto" defaultOpen={false}>
        <div className="grid gap-3 p-2 md:grid-cols-2 md:p-3">
          <CodeBlock
            kicker="secciones_cerradas"
            content={JSON.stringify(row.sesion.secciones_cerradas, null, 2)}
          />
          <CodeBlock
            kicker="metadata"
            content={JSON.stringify(row.sesion.metadata ?? null, null, 2)}
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HeroSesionCard — organic extrusion bottom-left, KPIs grid abajo
// ════════════════════════════════════════════════════════════════════════════

function HeroSesionCard({
  razonSocial,
  sesionId,
  statusLabel,
  statusColor,
  cajasLlenas,
  cajasAplicables,
  startedAt,
  ultimoTurnoAt,
  consentimientoAt,
  fatigaDetectada,
}: {
  razonSocial: string;
  sesionId: string;
  statusLabel: string;
  statusColor: string;
  cajasLlenas: number;
  cajasAplicables: number;
  startedAt: Date;
  ultimoTurnoAt: Date;
  consentimientoAt: Date | null;
  fatigaDetectada: boolean;
}) {
  return (
    <div className="relative isolate px-8 pt-10 pb-20 md:px-12 md:pt-12 md:pb-24">
      {/* Goo layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          filter:
            'drop-shadow(0 1px 0 rgb(10 15 28 / 0.06)) drop-shadow(0 4px 10px rgb(10 15 28 / 0.025))',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ filter: 'url(#admin-hero-organic)' }}
        >
          {/* Main rect — clearance bottom-12 para la extrusión bottom-left */}
          <div className="squircle absolute inset-x-0 top-0 bottom-12 rounded-[28px] bg-cream-pure" />
          <div className="absolute bottom-0 left-0 h-20 w-1/3 rounded-full bg-cream-pure" />
        </div>
        {/* Atmosphere clipeada al main rect */}
        <div className="absolute inset-x-0 top-0 bottom-12 overflow-hidden rounded-[28px]">
          <div className="atmosphere-radial-gold-warm absolute inset-0" />
        </div>
      </div>

      {/* Eyebrow + status pill */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-eyebrow text-gold-deep">Sesión</span>
        <StatusPill label={statusLabel} color={statusColor} />
        {fatigaDetectada && <StatusPill label="Fatiga" color="#D4A862" />}
      </div>

      {/* Title */}
      <h1 className="mt-4 text-[clamp(28px,3.5vw,44px)] font-semibold leading-tight tracking-[-0.025em] text-foreground">
        {razonSocial}
      </h1>
      <p className="mt-2 font-mono text-[11.5px] tracking-tight text-foreground/45">
        {sesionId}
      </p>

      {/* KPIs row */}
      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
        <KpiCell
          label="Cajas"
          value={`${cajasLlenas}/${cajasAplicables}`}
          mono
        />
        <KpiCell label="Iniciada" value={formatRelative(startedAt)} />
        <KpiCell label="Último turno" value={formatRelative(ultimoTurnoAt)} />
        <KpiCell
          label="Consentimiento"
          value={
            consentimientoAt ? formatRelative(consentimientoAt) : '—'
          }
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TurnoCard — card individual de turno con left rail accent según rol
// ════════════════════════════════════════════════════════════════════════════

function TurnoCard({
  numero,
  rol,
  contenido,
  fuente,
  modelo,
  tokensIn,
  tokensOut,
  latenciaMs,
  createdAt,
}: {
  numero: number;
  rol: 'agente' | 'usuario';
  contenido: string | null;
  fuente: string;
  modelo: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latenciaMs: number | null;
  createdAt: Date;
}) {
  const rolColor = rol === 'agente' ? 'var(--ink)' : 'var(--gold)';
  const rolLabel = rol === 'agente' ? 'Agente' : 'Usuario';
  return (
    <article className="squircle relative flex items-stretch gap-3 rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:gap-4 md:p-5">
      {/* Left rail — color según rol */}
      <span
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{
          backgroundColor: `color-mix(in srgb, ${rolColor} 55%, transparent)`,
        }}
      />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground/60">
            #{numero}
          </span>
          <StatusPill label={rolLabel} color={rolColor} />
          <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
            {formatRelative(createdAt)}
          </span>
        </header>
        <div className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85">
          {contenido || (
            <em className="text-foreground/40">(sin texto — extracciones inline)</em>
          )}
        </div>
        <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <MetaCell kicker="Fuente" value={fuente} mono />
          {modelo && <MetaCell kicker="Modelo" value={modelo} mono />}
          {tokensIn !== null && (
            <MetaCell
              kicker="Tokens"
              value={`in ${tokensIn} / out ${tokensOut ?? 0}`}
              mono
            />
          )}
          {latenciaMs !== null && (
            <MetaCell kicker="Latencia" value={`${latenciaMs}ms`} mono />
          )}
        </footer>
      </div>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ExtraccionCard — caja_codigo + valor JSON + confianza pill + estado
// ════════════════════════════════════════════════════════════════════════════

function ExtraccionCard({
  cajaCodigo,
  valor,
  confianza,
  superseded,
  fuente,
  createdAt,
}: {
  cajaCodigo: string;
  valor: unknown;
  confianza: number;
  superseded: boolean;
  fuente: string;
  createdAt: Date;
}) {
  const estadoColor = superseded ? 'rgb(10 15 28 / 0.30)' : 'var(--gold)';
  const estadoLabel = superseded ? 'Supersedida' : 'Activa';
  return (
    <article
      className={`squircle rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:p-5 ${
        superseded ? 'opacity-60' : ''
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[13.5px] font-semibold tracking-tight text-foreground">
          {cajaCodigo}
        </span>
        <StatusPill label={estadoLabel} color={estadoColor} />
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
          {formatRelative(createdAt)}
        </span>
      </header>
      <pre
        className={`mt-3 max-w-full overflow-hidden font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-foreground/80 ${
          superseded ? 'line-through' : ''
        }`}
      >
        {JSON.stringify(valor)}
      </pre>
      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <MetaCell kicker="Confianza" value={confianza.toFixed(2)} mono />
        <MetaCell kicker="Fuente" value={fuente} mono />
      </footer>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CasoCard
// ════════════════════════════════════════════════════════════════════════════

function CasoCard({
  numero,
  estado,
  cajasObjetivo,
  contenido,
  createdAt,
}: {
  numero: number;
  estado: string;
  cajasObjetivo: string[];
  contenido: unknown;
  createdAt: Date;
}) {
  return (
    <article className="squircle rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
          Caso #{numero}
        </span>
        <StatusPill label={estado} color="var(--gold)" />
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
          {formatRelative(createdAt)}
        </span>
      </header>
      <div className="mt-3">
        <MetaCell kicker="Cajas objetivo" value={cajasObjetivo.join(', ')} mono />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[11.5px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85">
          Ver contenido
        </summary>
        <pre
          data-lenis-prevent
          className="mt-2 max-h-64 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed text-foreground/80"
        >
          {JSON.stringify(contenido, null, 2)}
        </pre>
      </details>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ReviewCard
// ════════════════════════════════════════════════════════════════════════════

function ReviewCard({
  grupoUiCodigo,
  round,
  decisionOpus,
  siguienteGrupoUi,
  turnoDisparador,
  createdAt,
}: {
  grupoUiCodigo: string;
  round: number;
  decisionOpus: string | null;
  siguienteGrupoUi: string | null;
  turnoDisparador: number;
  createdAt: Date;
}) {
  const decisionColor = decisionOpus
    ? 'var(--gold)'
    : 'rgb(10 15 28 / 0.30)';
  return (
    <article className="squircle rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[13.5px] font-semibold tracking-tight text-foreground">
          {grupoUiCodigo}
        </span>
        <span className="font-mono text-[11px] text-foreground/55">
          round {round}
        </span>
        <StatusPill
          label={decisionOpus ?? 'pendiente'}
          color={decisionColor}
        />
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
          {formatRelative(createdAt)}
        </span>
      </header>
      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <MetaCell
          kicker="Siguiente"
          value={siguienteGrupoUi ?? '—'}
          mono
        />
        <MetaCell
          kicker="Disparado en turno"
          value={`#${turnoDisparador}`}
          mono
        />
      </footer>
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DeclinadaCard
// ════════════════════════════════════════════════════════════════════════════

function DeclinadaCard({
  cajaCodigo,
  razon,
  detalle,
  declinadaAt,
}: {
  cajaCodigo: string;
  razon: string;
  detalle: string | null;
  declinadaAt: Date;
}) {
  return (
    <article className="squircle rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[13.5px] font-semibold tracking-tight text-foreground">
          {cajaCodigo}
        </span>
        <StatusPill label={razon} color="rgb(10 15 28 / 0.30)" />
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
          {formatRelative(declinadaAt)}
        </span>
      </header>
      {detalle && (
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/70">
          {detalle}
        </p>
      )}
    </article>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KpiCell — celda del hero con kicker microcap + valor prominente
// ════════════════════════════════════════════════════════════════════════════

function KpiCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-eyebrow text-foreground/45">{label}</span>
      <span
        className={`text-[18px] font-semibold tracking-tight text-foreground ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// StatCell — más compacta, para el perfil grid
// ════════════════════════════════════════════════════════════════════════════

function StatCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="squircle rounded-2xl bg-cream-pure/55 p-4 ring-1 ring-foreground/[0.05]">
      <p className="text-eyebrow text-foreground/45">{label}</p>
      <p
        className={`mt-2 text-[15px] font-semibold tracking-tight text-foreground ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MetaCell — kicker microcap + valor inline (mismo patrón que SesionListItem)
// ════════════════════════════════════════════════════════════════════════════

function MetaCell({
  kicker,
  value,
  mono = false,
}: {
  kicker: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-foreground/40">
        {kicker}
      </span>
      <span
        className={`text-[12px] tracking-tight text-foreground/72 ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// StatusPill — pill tintado con color-mix. Mirror del SesionListItem.
// ════════════════════════════════════════════════════════════════════════════

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="squircle inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color: `color-mix(in srgb, ${color} 70%, var(--ink))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CodeBlock — pre con kicker, para metadata bruta
// ════════════════════════════════════════════════════════════════════════════

function CodeBlock({
  kicker,
  content,
}: {
  kicker: string;
  content: string;
}) {
  return (
    <div className="squircle overflow-hidden rounded-2xl bg-foreground/[0.04] ring-1 ring-foreground/[0.05]">
      <div className="border-b border-foreground/[0.06] px-3 py-2">
        <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.18em] text-foreground/45">
          {kicker}
        </span>
      </div>
      <pre
        data-lenis-prevent
        className="max-h-64 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground/80"
      >
        {content}
      </pre>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Empty
// ════════════════════════════════════════════════════════════════════════════

function Empty({ message }: { message: string }) {
  return (
    <div className="squircle rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03]">
      <p className="mx-auto max-w-sm text-[13px] tracking-tight text-foreground/55">
        {message}
      </p>
    </div>
  );
}
