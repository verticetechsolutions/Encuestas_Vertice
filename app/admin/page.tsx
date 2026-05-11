// Admin dashboard — métricas y últimas sesiones.

import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones, perfil_decision_final } from '@/db/schema';
import { ArrowRight, Building2, Download, Sparkles } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Conteos en paralelo. Cada query es cheap (count/group-by sobre <1000 rows).
  const [
    [{ n: totalInstituciones }],
    statusBreakdown,
    [{ n: totalPerfiles }],
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
        sesion_id: sesiones.id,
        status: sesiones.status,
        started_at: sesiones.started_at,
        ultimo_turno_at: sesiones.ultimo_turno_at,
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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Vista general
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Resumen
          </h1>
        </div>
        <Link
          href="/admin/instituciones/nueva"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--ink-raised)] active:scale-[0.98]"
        >
          <Building2 className="size-4" />
          Nueva institución
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Instituciones" value={String(totalInstituciones)} />
        <StatCard label="Sesiones totales" value={String(totalSesiones)} />
        <StatCard
          label="Perfiles JSON"
          value={String(totalPerfiles)}
          hint="síntesis final"
        />
        <StatCard
          label="Abiertas"
          value={String(
            statusBreakdown.find((r) => r.status === 'abierta')?.n ?? 0
          )}
          hint="sesiones activas"
        />
      </section>

      <section className="rounded-3xl bg-cream p-5 shadow-sm ring-1 ring-foreground/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Exportar
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Descarga snapshots crudos de las tablas. CSV para análisis,
              JSON para handoff.
            </p>
          </div>
          <Download className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              'instituciones',
              'sesiones',
              'extracciones',
              'perfiles',
            ] as const
          ).map((e) => (
            <div
              key={e}
              className="flex flex-col gap-1.5 rounded-2xl bg-background/40 p-3"
            >
              <p className="text-xs font-semibold tracking-tight text-foreground capitalize">
                {e}
              </p>
              <div className="flex items-center gap-1.5">
                <a
                  href={`/admin/api/export/${e}?format=csv`}
                  className="flex-1 rounded-full bg-ink px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition hover:bg-[var(--ink-raised)]"
                >
                  CSV
                </a>
                <a
                  href={`/admin/api/export/${e}?format=json`}
                  className="flex-1 rounded-full bg-foreground/8 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground transition hover:bg-foreground/15"
                >
                  JSON
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Sesiones recientes
          </h2>
          <Link
            href="/admin/instituciones"
            className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline"
          >
            Ver todas las instituciones <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {sesionesRecientes.length === 0 ? (
          <EmptyState message="Aún no hay sesiones. Crea tu primera institución para emitir un magic link." />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-background/30">
            <table className="w-full text-sm">
              <thead className="bg-background/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th>Institución</Th>
                  <Th>Tipo</Th>
                  <Th>Status</Th>
                  <Th>Cajas</Th>
                  <Th>Último turno</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {sesionesRecientes.map((s) => (
                  <tr
                    key={s.sesion_id}
                    className="transition hover:bg-foreground/[0.02]"
                  >
                    <Td>
                      <Link
                        href={`/admin/instituciones/${s.institucion_id}`}
                        className="font-medium text-foreground hover:text-gold-deep hover:underline"
                      >
                        {s.razon_social}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {s.tipo}
                    </Td>
                    <Td>
                      <StatusPill status={s.status} />
                    </Td>
                    <Td className="font-mono text-xs tabular-nums">
                      {s.cajas_llenas}
                      <span className="text-muted-foreground">
                        /{s.cajas_aplicables}
                      </span>
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {formatRelative(s.ultimo_turno_at)}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/sesiones/${s.sesion_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline"
                      >
                        Ver <ArrowRight className="size-3" />
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-cream p-5 shadow-sm ring-1 ring-foreground/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 ${className ?? ''}`}>{children}</td>
  );
}

const STATUS_STYLE: Record<string, string> = {
  abierta: 'bg-gold-bright/30 text-gold-deep ring-gold-bright/50',
  pausada: 'bg-amber-100 text-amber-900 ring-amber-200',
  sintetizando: 'bg-ink/8 text-ink/72 ring-ink/15',
  completa: 'bg-ink text-cream-pure ring-ink',
  abandonada: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      <Sparkles className="size-2.5" />
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-background/30 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
