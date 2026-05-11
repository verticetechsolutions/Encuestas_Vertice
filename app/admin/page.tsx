// Admin dashboard — Vista general (rediseño editorial+orgánico+Apple, 2026-05-11).
//
// 4 zonas:
//  Zone 1 — Hero editorial (perfiles del mes, ticker + métricas de calidad)
//  Zone 2 — Funnel por stage (4 cards: abierta · sintetizando · completa · abandonada)
//  Zone 3 — Action items (priorizado Pilot pattern) + Activity timeline (Warp block model)
//  Zone 4 — Exports compactos
//
// Separación entre zonas vía whitespace generoso (gap-10 md:gap-16) +
// títulos de sección como anclas visuales. NO dividers.

import { and, count, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  instituciones,
  perfil_decision_final,
  magic_tokens,
} from '@/db/schema';
import {
  Download,
  PieChart,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { MetricCard } from '@/components/admin/metric-card';
import { FunnelStage } from '@/components/admin/funnel-stage';
import { ActionItem } from '@/components/admin/action-item';
import { ActivityBlock } from '@/components/admin/activity-block';
import { SeeAllLink } from '@/components/admin/see-all-link';
import { AdminScrollArea } from '@/components/admin/scroll-area';

export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ────────────────────────────────────────────────────────────────────────────

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  year: 'numeric',
});

function capitalizeMonth(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatFloat(value: number | null | undefined, digits = 2): string {
  if (value == null) return '—';
  return value.toFixed(digits);
}

function formatMinutes(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)} min`;
}

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

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = capitalizeMonth(MONTH_FORMATTER.format(now));

  // Cutoffs para action items
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const day72Ago = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  // Todas las queries en paralelo
  const [
    [{ n: totalInstituciones }],
    statusBreakdown,
    [{ n: totalPerfiles }],
    [{ avg_completitud, avg_confianza }],
    [{ avg_duracion }],
    [{ n: perfilesEsteMes }],
    [{ n: nStuckSinte }],
    [{ n: nStalledOpen }],
    [{ n: nExpiringLinks }],
    [{ n: nDormantInst }],
    sesionesRecientes,
  ] = await Promise.all([
    db.select({ n: count() }).from(instituciones),
    db
      .select({ status: sesiones.status, n: count() })
      .from(sesiones)
      .groupBy(sesiones.status),
    db.select({ n: count() }).from(perfil_decision_final),
    db
      .select({
        avg_completitud: sql<number | null>`AVG(${perfil_decision_final.completitud})`,
        avg_confianza: sql<number | null>`AVG(${perfil_decision_final.confianza_global})`,
      })
      .from(perfil_decision_final),
    db
      .select({
        avg_duracion: sql<number | null>`AVG(${sesiones.duracion_total_segundos})`,
      })
      .from(sesiones)
      .where(eq(sesiones.status, 'completa')),
    db
      .select({ n: count() })
      .from(perfil_decision_final)
      .where(gt(perfil_decision_final.generado_at, startOfMonth)),
    // Action 1: perfiles atascados — status='sintetizando' con ultimo_turno_at >30min
    db
      .select({ n: count() })
      .from(sesiones)
      .where(
        and(
          eq(sesiones.status, 'sintetizando'),
          lt(sesiones.ultimo_turno_at, thirtyMinAgo)
        )
      ),
    // Action 2: sesiones sin turno — status='abierta' + ultimo_turno_at >24h
    db
      .select({ n: count() })
      .from(sesiones)
      .where(
        and(
          eq(sesiones.status, 'abierta'),
          lt(sesiones.ultimo_turno_at, day24Ago)
        )
      ),
    // Action 3: magic links próximos a vencer — vigentes, expires en <48h
    db
      .select({ n: count() })
      .from(magic_tokens)
      .where(
        and(
          lt(magic_tokens.expires_at, in48h),
          gt(magic_tokens.expires_at, now),
          isNull(magic_tokens.consumed_at),
          isNull(magic_tokens.revoked_at)
        )
      ),
    // Action 4: instituciones sin actividad >72h — created >72h, ninguna sesión
    db
      .select({ n: count() })
      .from(instituciones)
      .leftJoin(sesiones, eq(sesiones.institucion_id, instituciones.id))
      .where(
        and(lt(instituciones.created_at, day72Ago), isNull(sesiones.id))
      ),
    db
      .select({
        sesion_id: sesiones.id,
        status: sesiones.status,
        started_at: sesiones.started_at,
        ultimo_turno_at: sesiones.ultimo_turno_at,
        duracion_total_segundos: sesiones.duracion_total_segundos,
        cajas_llenas: sesiones.cajas_llenas_count,
        cajas_aplicables: sesiones.cajas_aplicables,
        razon_social: instituciones.razon_social,
        tipo: instituciones.tipo,
        institucion_id: instituciones.id,
      })
      .from(sesiones)
      .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
      .orderBy(desc(sesiones.ultimo_turno_at))
      .limit(10),
  ]);

  const totalSesiones = statusBreakdown.reduce(
    (acc, row) => acc + Number(row.n),
    0
  );

  // Funnel stages — count por status
  const countByStatus = (status: string): number =>
    Number(statusBreakdown.find((r) => r.status === status)?.n ?? 0);
  const stages = [
    {
      key: 'abierta',
      eyebrow: 'Abiertas',
      label: 'sesiones activas',
      count: countByStatus('abierta'),
    },
    {
      key: 'sintetizando',
      eyebrow: 'Sintetizando',
      label: 'en procesamiento',
      count: countByStatus('sintetizando'),
    },
    {
      key: 'completa',
      eyebrow: 'Completas',
      label: 'perfiles generados',
      count: countByStatus('completa'),
    },
    {
      key: 'abandonada',
      eyebrow: 'Abandonadas',
      label: 'sin completar',
      count: countByStatus('abandonada'),
    },
  ] as const;

  // Action items — solo mostrar los que tienen count > 0
  const actionItems = [
    {
      count: Number(nStuckSinte),
      title: 'Perfiles atascados',
      description: 'Sintetizando hace más de 30 min',
      href: '/admin/sesiones?status=sintetizando',
    },
    {
      count: Number(nStalledOpen),
      title: 'Sesiones sin turno',
      description: 'Última actividad hace más de 24 h',
      href: '/admin/sesiones?status=abierta',
    },
    {
      count: Number(nExpiringLinks),
      title: 'Magic links próximos a vencer',
      description: 'Expiran en menos de 48 h',
      href: '/admin/magic-links',
    },
    {
      count: Number(nDormantInst),
      title: 'Instituciones sin actividad',
      description: 'Creadas hace más de 72 h, sin sesiones',
      href: '/admin/instituciones',
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="flex flex-col gap-10 md:gap-16">
      {/* ════════════════════════════════════════════════════════════════
          ZONE 1 — HERO EDITORIAL
          ════════════════════════════════════════════════════════════════ */}
      <MetricCard
        variant="hero"
        atmosphere
        organic
        eyebrow={monthLabel}
        value={perfilesEsteMes}
        label="perfiles generados este mes"
        hint={
          <div className="flex flex-col gap-3">
            <MetricLine
              icon={<PieChart className="size-3.5" strokeWidth={1.5} />}
              label="Completitud media"
              value={formatPct(avg_completitud)}
            />
            <MetricLine
              icon={<ShieldCheck className="size-3.5" strokeWidth={1.5} />}
              label="Confianza media"
              value={formatFloat(avg_confianza)}
            />
            <MetricLine
              icon={<Timer className="size-3.5" strokeWidth={1.5} />}
              label="Tiempo promedio"
              value={formatMinutes(avg_duracion)}
            />
          </div>
        }
      />

      {/* Secondary stats — 3 compact cards con organic extrusion uniforme
          top-right. Consistencia visual entre los 3 widgets del row. */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <MetricCard
          variant="compact"
          organic="top-right"
          eyebrow="Aliados"
          value={totalInstituciones}
          label="instituciones registradas"
        />
        <MetricCard
          variant="compact"
          organic="top-right"
          eyebrow="Histórico"
          value={totalSesiones}
          label={`sesiones totales · ${totalPerfiles} perfiles`}
        />
        <MetricCard
          variant="compact"
          organic="top-right"
          eyebrow="Activas"
          value={countByStatus('abierta')}
          label="sesiones en flujo"
        />
      </section>

      {/* ════════════════════════════════════════════════════════════════
          ZONE 2 — FUNNEL POR STAGE
          ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-5 flex items-baseline justify-between md:mb-6">
          <h2 className="text-eyebrow text-foreground/55">Funnel</h2>
          <SeeAllLink
            href="/admin/sesiones"
            className="text-[12px] font-medium text-gold-deep transition-colors hover:text-gold-deep/85"
          >
            Ver todas
          </SeeAllLink>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {stages.map((stage, i) => (
            <FunnelStage
              key={stage.key}
              eyebrow={stage.eyebrow}
              count={stage.count}
              label={stage.label}
              statusColor={STATUS_COLOR[stage.key]}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          ZONE 3 — ACTION ITEMS + ACTIVITY TIMELINE
          ════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {/* Action items column (Pilot pattern) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-eyebrow text-foreground/55">
              Requieren atención
            </h2>
            <span className="font-mono text-[11.5px] text-foreground/45 tabular-nums">
              {actionItems.length}{' '}
              {actionItems.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          {actionItems.length === 0 ? (
            <EmptyStateMessage message="Sin pendientes. Todo bajo control." />
          ) : (
            // max-h calibrada para ~6 items: item ≈ 73px (p-4 + 17px title +
            // 2px mt + 16px desc) + gap-3 (12px) → 6·73 + 5·12 = 498. 540px
            // de holgura para que el último item respire bajo la curva del
            // scroll. py-3 simétrico: pt-3 evita que el primer card quede
            // flush contra el top del Viewport (overflow-hidden lo recorta
            // visualmente, sin aire entre el section header y el card);
            // pb-3 reserva espacio para que el shadow del último card no se
            // clipee. AdminScrollArea ya incluye `data-lenis-prevent` y el
            // scrollbar overlay del command palette.
            <AdminScrollArea
              maxHeight="max-h-[540px]"
              contentClassName="flex flex-col gap-3 px-1 py-3"
            >
              {actionItems.map((item, i) => (
                <ActionItem
                  key={item.title}
                  count={item.count}
                  title={item.title}
                  description={item.description}
                  href={item.href}
                  index={i}
                />
              ))}
            </AdminScrollArea>
          )}
        </div>

        {/* Activity timeline (Warp block model) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-eyebrow text-foreground/55">Actividad</h2>
            <SeeAllLink
              href="/admin/sesiones"
              className="font-mono text-[11.5px] text-foreground/45 transition-colors hover:text-gold-deep"
            >
              Ver todas
            </SeeAllLink>
          </div>
          {sesionesRecientes.length === 0 ? (
            <EmptyStateMessage message="Sin sesiones todavía. Las nuevas aparecerán aquí cuando un cliente inicie la entrevista." />
          ) : (
            // max-h calibrada para ~6 ActivityBlock visibles: block ≈ 70px
            // (md p-4 + title 17px + mt-1 + meta 14px) + gap-1 (4px) →
            // 6·70 + 5·4 = 440. 460px igualan la columna de actions.
            <AdminScrollArea
              maxHeight="max-h-[460px]"
              contentClassName="flex flex-col gap-1"
            >
              {sesionesRecientes.map((s, i) => {
                const cajasInfo = `${s.cajas_llenas}/${s.cajas_aplicables} cajas`;
                const tipoInfo = s.tipo;
                const meta = `${tipoInfo} · ${cajasInfo}`;
                return (
                  <ActivityBlock
                    key={s.sesion_id}
                    href={`/admin/sesiones/${s.sesion_id}`}
                    title={s.razon_social}
                    status={STATUS_LABEL[s.status] ?? s.status}
                    statusColor={STATUS_COLOR[s.status]}
                    meta={meta}
                    relativeTime={formatRelative(s.ultimo_turno_at)}
                    index={i}
                  />
                );
              })}
            </AdminScrollArea>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          ZONE 4 — EXPORTS COMPACT
          ════════════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-eyebrow text-foreground/55">Exportar</h2>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-foreground/45">
            <Download className="size-3" strokeWidth={1.5} />
            CSV o JSON
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {(
            [
              { key: 'instituciones', label: 'Instituciones' },
              { key: 'sesiones', label: 'Sesiones' },
              { key: 'extracciones', label: 'Extracciones' },
              { key: 'perfiles', label: 'Perfiles' },
            ] as const
          ).map((e) => (
            <div
              key={e.key}
              className="squircle shadow-card-subtle flex flex-col gap-2 rounded-2xl bg-cream-pure p-3 ring-1 ring-foreground/[0.08] transition hover:ring-foreground/[0.14]"
            >
              <p className="text-[12px] font-medium tracking-tight text-foreground/85">
                {e.label}
              </p>
              <div className="flex items-center gap-1.5">
                <a
                  href={`/admin/api/export/${e.key}?format=csv`}
                  className="squircle flex-1 rounded-full bg-ink px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition hover:bg-[var(--ink-raised)]"
                >
                  CSV
                </a>
                <a
                  href={`/admin/api/export/${e.key}?format=json`}
                  className="squircle flex-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground transition hover:bg-foreground/12"
                >
                  JSON
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Local helpers
// ────────────────────────────────────────────────────────────────────────────

function MetricLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gold-deep">{icon}</span>
      <span className="flex-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-foreground/55">
        {label}
      </span>
      <span className="font-mono text-[13.5px] font-medium tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </div>
  );
}

function EmptyStateMessage({ message }: { message: string }) {
  return (
    <div className="squircle rounded-2xl bg-cream-pure/40 px-6 py-10 text-center ring-1 ring-foreground/[0.03]">
      <p className="mx-auto max-w-sm text-[13px] tracking-tight text-foreground/55">
        {message}
      </p>
    </div>
  );
}
