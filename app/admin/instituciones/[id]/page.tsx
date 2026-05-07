// Detalle de institución — sesiones + perfiles JSON.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  instituciones,
  sesiones,
  perfil_decision_final,
} from '@/db/schema';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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

  const [sesionesList, perfiles] = await Promise.all([
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
  ]);

  const latestPerfil = perfiles[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/instituciones"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver al catálogo
      </Link>

      <header className="rounded-3xl bg-cream p-6 shadow-sm ring-1 ring-foreground/5 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Institución
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {inst.razon_social}
        </h1>
        {inst.nombre_comercial && (
          <p className="mt-1 text-sm text-muted-foreground">
            {inst.nombre_comercial}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag>{inst.tipo}</Tag>
          <Tag icon={<Mail className="size-3" />}>{inst.email_contacto}</Tag>
          <Tag muted>creada {formatRelative(inst.created_at)}</Tag>
        </div>
      </header>

      <section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Sesiones ({sesionesList.length})
          </h2>
        </div>
        {sesionesList.length === 0 ? (
          <div className="rounded-2xl bg-background/30 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Esta institución aún no ha iniciado entrevistas.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-background/30">
            <table className="w-full text-sm">
              <thead className="bg-background/50 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Cajas</th>
                  <th className="px-5 py-3">Iniciada</th>
                  <th className="px-5 py-3">Último turno</th>
                  <th className="px-5 py-3">Consentimiento</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {sesionesList.map((s) => (
                  <tr
                    key={s.id}
                    className="transition hover:bg-foreground/[0.02]"
                  >
                    <td className="px-5 py-3">
                      <Tag>{s.status}</Tag>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs tabular-nums">
                      {s.cajas_llenas_count}
                      <span className="text-muted-foreground">
                        /{s.cajas_aplicables}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(s.started_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(s.ultimo_turno_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {s.consentimiento_at
                        ? formatRelative(s.consentimiento_at)
                        : 'pendiente'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/sesiones/${s.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline"
                      >
                        Detalle <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Perfil JSON (síntesis final)
          </h2>
          {latestPerfil && (
            <Tag muted>
              v{latestPerfil.version} · {formatRelative(latestPerfil.generado_at)}
            </Tag>
          )}
        </div>
        {!latestPerfil ? (
          <div className="rounded-2xl bg-background/30 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No hay perfil generado todavía. La síntesis se ejecuta cuando
              cierra la última sección de la entrevista (Fase 8).
            </p>
          </div>
        ) : (
          <div className="space-y-3 px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Schema"
                value={latestPerfil.schema_version}
                mono
              />
              <Stat
                label="Completitud"
                value={`${Math.round(latestPerfil.completitud * 100)}%`}
              />
              <Stat
                label="Confianza global"
                value={latestPerfil.confianza_global.toFixed(2)}
                mono
              />
              <Stat
                label="Versión"
                value={String(latestPerfil.version)}
                mono
              />
            </div>
            <details className="rounded-2xl bg-foreground text-primary-foreground">
              <summary className="cursor-pointer rounded-2xl px-5 py-3 text-xs font-semibold tracking-tight text-primary-foreground/85 hover:text-primary-foreground [&::-webkit-details-marker]:hidden">
                Ver JSON completo
              </summary>
              <pre className="max-h-96 overflow-auto px-5 pb-5 font-mono text-[11px] leading-relaxed text-primary-foreground/85">
                {JSON.stringify(latestPerfil.perfil_json, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}

function Tag({
  children,
  icon,
  muted,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${
        muted
          ? 'bg-foreground/5 text-muted-foreground ring-foreground/10'
          : 'bg-forest/10 text-forest ring-forest/25'
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-background/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold tracking-tight text-foreground ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
