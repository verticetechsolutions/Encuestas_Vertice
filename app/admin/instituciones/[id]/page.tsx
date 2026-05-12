// Detalle de institución — design system coherente con /admin/sesiones/[id].
// Hero con organic extrusion, SectionCard para sesiones / magic links /
// histórico de perfiles, ítems con left rail accent y status pills tintados.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  instituciones,
  sesiones,
  perfil_decision_final,
  magic_tokens,
} from '@/db/schema';
import { ArrowLeft } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import {
  magicTokenStatus,
  type MagicStatus,
} from '@/lib/admin/magic-token-status';
import { SectionCard } from '@/components/admin/section-card';
import { SesionListItem } from '@/components/admin/sesion-list-item';
import { MagicLinkActionsPanel } from '@/components/admin/magic-link-actions';
import { MagicLinkInstitucionItem } from '@/components/admin/magic-link-institucion-item';
import { InstitucionAdminActions } from '@/components/admin/institucion-admin-actions';

export const dynamic = 'force-dynamic';

const SESION_STATUS_COLOR: Record<string, string> = {
  abierta: 'var(--gold)',
  pausada: '#D4A862',
  sintetizando: 'var(--gold-bright)',
  completa: 'var(--ink)',
  abandonada: 'rgb(10 15 28 / 0.30)',
};

const SESION_STATUS_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  pausada: 'Pausada',
  sintetizando: 'Sintetizando',
  completa: 'Completa',
  abandonada: 'Abandonada',
};

const MAGIC_STATUS_COLOR: Record<MagicStatus, string> = {
  vigente: 'var(--gold)',
  consumido: 'var(--ink)',
  expirado: '#D4A862',
  revocado: 'rgb(10 15 28 / 0.30)',
};

const MAGIC_STATUS_LABEL: Record<MagicStatus, string> = {
  vigente: 'Vigente',
  consumido: 'Consumido',
  expirado: 'Expirado',
  revocado: 'Revocado',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminInstitucionDetailPage({ params }: Props) {
  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instituciones)
    .where(eq(instituciones.id, id))
    .limit(1);
  if (!inst) notFound();

  const [sesionesList, perfiles, magicLinks] = await Promise.all([
    db
      .select()
      .from(sesiones)
      .where(eq(sesiones.institucion_id, id))
      .orderBy(desc(sesiones.started_at)),
    db
      .select()
      .from(perfil_decision_final)
      .where(eq(perfil_decision_final.institucion_id, id))
      .orderBy(desc(perfil_decision_final.version)),
    db
      .select({
        id: magic_tokens.id,
        expires_at: magic_tokens.expires_at,
        consumed_at: magic_tokens.consumed_at,
        revoked_at: magic_tokens.revoked_at,
        created_at: magic_tokens.created_at,
      })
      .from(magic_tokens)
      .where(eq(magic_tokens.institucion_id, id))
      .orderBy(desc(magic_tokens.created_at))
      .limit(50),
  ]);

  const totalSesiones = sesionesList.length;
  const totalPerfiles = perfiles.length;

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      {/* Breadcrumb back */}
      <Link
        href="/admin/instituciones"
        className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/55 transition hover:text-foreground"
      >
        <ArrowLeft
          className="size-3.5 transition group-hover:-translate-x-0.5"
          strokeWidth={1.75}
        />
        Volver al catálogo
      </Link>

      {/* ════════════════════════════════════════════════════════════════
          HERO — organic extrusion bottom-left + atmosphere
          ════════════════════════════════════════════════════════════════ */}
      <HeroInstitucionCard
        razonSocial={inst.razon_social}
        nombreComercial={inst.nombre_comercial}
        tipo={inst.tipo}
        email={inst.email_contacto}
        telefono={inst.telefono_contacto}
        createdAt={inst.created_at}
        totalSesiones={totalSesiones}
        totalPerfiles={totalPerfiles}
      />

      {/* Edit + Delete actions */}
      <InstitucionAdminActions
        institucion={{
          id: inst.id,
          razon_social: inst.razon_social,
          nombre_comercial: inst.nombre_comercial,
          tipo: inst.tipo,
          email_contacto: inst.email_contacto,
          telefono_contacto: inst.telefono_contacto,
        }}
      />

      {/* ════════════════════════════════════════════════════════════════
          SESIONES
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Operativo"
        title="Sesiones"
        count={sesionesList.length}
        defaultOpen={sesionesList.length > 0 && sesionesList.length <= 12}
      >
        {sesionesList.length === 0 ? (
          <Empty message="Esta institución aún no ha iniciado entrevistas." />
        ) : (
          <div className="flex flex-col gap-1 p-1 md:p-1.5">
            {sesionesList.map((s, i) => (
              <SesionListItem
                key={s.id}
                href={`/admin/sesiones/${s.id}`}
                title={`Sesión ${s.id.slice(0, 8)}…`}
                status={SESION_STATUS_LABEL[s.status] ?? s.status}
                statusColor={
                  SESION_STATUS_COLOR[s.status] ?? 'var(--gold)'
                }
                tipo={inst.tipo}
                cajas={`${s.cajas_llenas_count}/${s.cajas_aplicables}`}
                startedRelative={formatRelative(s.started_at)}
                lastTurnRelative={formatRelative(s.ultimo_turno_at)}
                index={i}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          MAGIC LINKS — panel de acciones + lista
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Acceso"
        title="Magic links"
        count={magicLinks.length}
      >
        <div className="flex flex-col gap-4 p-2 md:p-3">
          {/* Actions panel — siempre arriba, independiente de la lista */}
          <MagicLinkActionsPanel institucion_id={id} />

          {/* Lista */}
          {magicLinks.length === 0 ? (
            <Empty message="Aún no se ha emitido ningún magic link para esta institución." />
          ) : (
            <div className="flex flex-col gap-1.5">
              {magicLinks.map((m, i) => {
                const status = magicTokenStatus(m);
                return (
                  <MagicLinkInstitucionItem
                    key={m.id}
                    id={m.id}
                    status={status}
                    statusLabel={MAGIC_STATUS_LABEL[status]}
                    statusColor={MAGIC_STATUS_COLOR[status]}
                    createdRelative={formatRelative(m.created_at)}
                    expiresRelative={formatRelative(m.expires_at)}
                    outcomeRelative={
                      m.consumed_at
                        ? `consumido ${formatRelative(m.consumed_at)}`
                        : m.revoked_at
                          ? `revocado ${formatRelative(m.revoked_at)}`
                          : null
                    }
                    index={i}
                  />
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ════════════════════════════════════════════════════════════════
          HISTÓRICO DE PERFILES
          ════════════════════════════════════════════════════════════════ */}
      <SectionCard
        eyebrow="Síntesis"
        title="Histórico de perfiles"
        count={perfiles.length}
        defaultOpen={perfiles.length > 0}
      >
        {perfiles.length === 0 ? (
          <Empty message="No hay perfil generado todavía. La síntesis se ejecuta cuando cierra la última sección de la entrevista (Fase 8)." />
        ) : (
          <div className="flex flex-col gap-1.5 p-2 md:p-3">
            {perfiles.map((p, idx) => (
              <PerfilCard
                key={p.id}
                version={p.version}
                schema={p.schema_version}
                completitud={p.completitud}
                confianza={p.confianza_global}
                sesionId={p.sesion_id}
                generadoAt={p.generado_at}
                perfilJson={p.perfil_json}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HeroInstitucionCard — organic extrusion bottom-left + atmosphere
// ════════════════════════════════════════════════════════════════════════════

function HeroInstitucionCard({
  razonSocial,
  nombreComercial,
  tipo,
  email,
  telefono,
  createdAt,
  totalSesiones,
  totalPerfiles,
}: {
  razonSocial: string;
  nombreComercial: string | null;
  tipo: string;
  email: string;
  telefono: string | null;
  createdAt: Date;
  totalSesiones: number;
  totalPerfiles: number;
}) {
  return (
    <div className="relative isolate px-8 pt-10 pb-20 md:px-12 md:pt-12 md:pb-24">
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
          <div className="squircle absolute inset-x-0 top-0 bottom-12 rounded-[28px] bg-cream-pure" />
          <div className="absolute bottom-0 left-0 h-20 w-1/3 rounded-full bg-cream-pure" />
        </div>
        <div className="absolute inset-x-0 top-0 bottom-12 overflow-hidden rounded-[28px]">
          <div className="atmosphere-radial-gold-warm absolute inset-0" />
        </div>
      </div>

      {/* Eyebrow + tipo pill */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-eyebrow text-gold-deep">Institución</span>
        <span className="squircle inline-flex shrink-0 items-center rounded-full bg-foreground/[0.06] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-[0.18em] text-foreground/65 ring-1 ring-foreground/[0.08]">
          {tipo}
        </span>
      </div>

      {/* Título */}
      <h1 className="mt-4 text-[clamp(28px,3.5vw,44px)] font-semibold leading-tight tracking-[-0.025em] text-foreground">
        {razonSocial}
      </h1>
      {nombreComercial && (
        <p className="mt-2 text-[15px] tracking-tight text-foreground/65">
          {nombreComercial}
        </p>
      )}

      {/* KPIs row */}
      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
        <KpiCell label="Email contacto" value={email} />
        <KpiCell
          label="Tel contacto"
          value={telefono ?? '—'}
          mono={telefono !== null}
        />
        <KpiCell label="Sesiones" value={String(totalSesiones)} mono />
        <KpiCell label="Perfiles" value={String(totalPerfiles)} mono />
      </div>
      <div className="mt-4 text-[12px] tracking-tight text-foreground/45">
        Creada {formatRelative(createdAt)}
      </div>
    </div>
  );
}

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
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-eyebrow text-foreground/45">{label}</span>
      <span
        className={`truncate text-[18px] font-semibold tracking-tight text-foreground ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PerfilCard — card de perfil con stats grid + JSON details
// ════════════════════════════════════════════════════════════════════════════

function PerfilCard({
  version,
  schema,
  completitud,
  confianza,
  sesionId,
  generadoAt,
  perfilJson,
  defaultOpen,
}: {
  version: number;
  schema: string;
  completitud: number;
  confianza: number;
  sesionId: string;
  generadoAt: Date;
  perfilJson: unknown;
  defaultOpen: boolean;
}) {
  return (
    <article className="squircle rounded-2xl bg-cream-pure/40 p-4 ring-1 ring-foreground/[0.04] transition hover:ring-foreground/[0.10] md:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[13.5px] font-semibold tabular-nums text-foreground">
          v{version}
        </span>
        <span className="font-mono text-[11px] text-foreground/55">
          sesión {sesionId.slice(0, 8)}…
        </span>
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-foreground/45">
          {formatRelative(generadoAt)}
        </span>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCell label="Schema" value={schema} mono />
        <StatCell
          label="Completitud"
          value={`${Math.round(completitud * 100)}%`}
        />
        <StatCell label="Confianza" value={confianza.toFixed(2)} mono />
        <StatCell label="Versión" value={String(version)} mono />
      </div>
      <details open={defaultOpen} className="mt-3">
        <summary className="cursor-pointer text-[11.5px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85 [&::-webkit-details-marker]:hidden">
          Ver JSON completo
        </summary>
        <pre
          data-lenis-prevent
          className="mt-2 max-h-96 overflow-auto rounded-xl bg-ink p-4 font-mono text-[11px] leading-relaxed text-cream-pure/85"
        >
          {JSON.stringify(perfilJson, null, 2)}
        </pre>
      </details>
    </article>
  );
}

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

function Empty({ message }: { message: string }) {
  return (
    <div className="squircle mx-3 my-3 rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03] md:mx-4 md:my-4">
      <p className="mx-auto max-w-md text-[13px] tracking-tight text-foreground/55">
        {message}
      </p>
    </div>
  );
}
