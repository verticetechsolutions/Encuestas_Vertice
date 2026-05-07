// Detalle de sesión — vista de auditoría profunda. Cinco secciones:
//   1. Header (institución + status + cajas)
//   2. Turnos de conversación (orden cronológico, agente vs usuario)
//   3. Extracciones (con supersede chain visible: cuáles están activas)
//   4. Casos sintéticos (cap 5/sesión)
//   5. Reviews y declinadas (handoff Sonnet→Opus)

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, asc, desc, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  sesiones,
  instituciones,
  turnos_conversacion,
  extracciones,
  casos_generados,
  reviews_seccion,
  cajas_declinadas,
} from '@/db/schema';
import { ArrowLeft } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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

  const [turnos, extraccionesActivas, casos, reviews, declinadas] =
    await Promise.all([
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
    ]);

  const activas = extraccionesActivas.filter((e) => e.superseded_by === null);
  const supersedidas = extraccionesActivas.length - activas.length;

  // Chequeo rápido de coherencia: las activas deben matchear cajas_llenas_count
  // ± supersedidas (no exacto porque cajas_llenas_count puede estar desfasado
  // del cálculo en runtime).
  void isNull;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/instituciones/${row.institucion.id}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Volver a {row.institucion.razon_social}
      </Link>

      <header className="rounded-3xl bg-cream p-6 shadow-sm ring-1 ring-foreground/5 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Sesión
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          {row.institucion.razon_social}
        </h1>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          {row.sesion.id}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Status" value={row.sesion.status} />
          <Stat
            label="Cajas"
            value={`${row.sesion.cajas_llenas_count}/${row.sesion.cajas_aplicables}`}
            mono
          />
          <Stat
            label="Iniciada"
            value={formatRelative(row.sesion.started_at)}
          />
          <Stat
            label="Último turno"
            value={formatRelative(row.sesion.ultimo_turno_at)}
          />
          <Stat
            label="Consentimiento"
            value={
              row.sesion.consentimiento_at
                ? formatRelative(row.sesion.consentimiento_at)
                : '—'
            }
          />
        </div>
        {row.sesion.fatiga_detectada && (
          <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900 ring-1 ring-amber-200/70">
            Fatiga detectada
          </p>
        )}
      </header>

      <Section
        title={`Turnos de conversación (${turnos.length})`}
        defaultOpen={turnos.length <= 30}
      >
        {turnos.length === 0 ? (
          <Empty message="Sin turnos registrados todavía." />
        ) : (
          <ol className="divide-y divide-foreground/5">
            {turnos.map((t) => (
              <li
                key={t.id}
                className={`grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4 ${
                  t.rol === 'agente'
                    ? 'bg-forest/[0.04]'
                    : 'bg-background/30'
                }`}
              >
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    #{t.numero_turno}
                  </span>
                  <RolBadge rol={t.rol} />
                </div>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {t.contenido_texto || (
                      <em className="text-muted-foreground">
                        (sin texto — extracciones inline)
                      </em>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{t.fuente}</span>
                    {t.modelo_llm && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{t.modelo_llm}</span>
                      </>
                    )}
                    {t.tokens_input !== null && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          in {t.tokens_input} / out {t.tokens_output ?? 0}
                        </span>
                      </>
                    )}
                    {t.latencia_ms !== null && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {t.latencia_ms}ms
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatRelative(t.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title={`Extracciones — ${activas.length} activas / ${supersedidas} supersedidas`}
        defaultOpen={activas.length <= 30}
      >
        {extraccionesActivas.length === 0 ? (
          <Empty message="Sin extracciones." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Caja</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Confianza</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Fuente</th>
                <th className="px-5 py-3">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {extraccionesActivas.map((e) => (
                <tr
                  key={e.id}
                  className={`${
                    e.superseded_by !== null
                      ? 'opacity-50 line-through'
                      : ''
                  }`}
                >
                  <td className="px-5 py-3 font-mono text-xs text-foreground">
                    {e.caja_codigo}
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                    <pre className="max-w-md overflow-hidden text-ellipsis whitespace-pre-wrap break-words">
                      {JSON.stringify(e.valor)}
                    </pre>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums">
                    {e.confianza.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    {e.superseded_by !== null ? (
                      <Tag muted>supersedida</Tag>
                    ) : (
                      <Tag accent>activa</Tag>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-[10px] text-muted-foreground">
                    {e.fuente}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {formatRelative(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Casos sintéticos (${casos.length}/5)`}>
        {casos.length === 0 ? (
          <Empty message="Sin casos solicitados todavía." />
        ) : (
          <ul className="divide-y divide-foreground/5">
            {casos.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      Caso #{c.numero_caso}
                    </span>
                    <Tag>{c.estado}</Tag>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(c.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cajas objetivo:{' '}
                  <span className="font-mono">
                    {c.cajas_objetivo.join(', ')}
                  </span>
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-forest hover:underline">
                    Ver contenido
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                    {JSON.stringify(c.contenido, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Reviews de sección (${reviews.length})`}>
        {reviews.length === 0 ? (
          <Empty message="Sin reviews emitidos." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Grupo</th>
                <th className="px-5 py-3">Round</th>
                <th className="px-5 py-3">Decisión Opus</th>
                <th className="px-5 py-3">Siguiente</th>
                <th className="px-5 py-3">Disparado en turno</th>
                <th className="px-5 py-3">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-mono text-xs">
                    {r.grupo_ui_codigo}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums">
                    {r.round}
                  </td>
                  <td className="px-5 py-3">
                    {r.decision_opus ? (
                      <Tag accent>{r.decision_opus}</Tag>
                    ) : (
                      <Tag muted>pendiente</Tag>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {r.siguiente_grupo_ui ?? '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums">
                    #{r.turno_disparador}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {formatRelative(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Cajas declinadas (${declinadas.length})`}>
        {declinadas.length === 0 ? (
          <Empty message="Ninguna caja declinada — la sesión avanzó limpia." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Caja</th>
                <th className="px-5 py-3">Razón</th>
                <th className="px-5 py-3">Detalle</th>
                <th className="px-5 py-3">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {declinadas.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3 font-mono text-xs">
                    {d.caja_codigo}
                  </td>
                  <td className="px-5 py-3">
                    <Tag muted>{d.razon}</Tag>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {d.detalle ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {formatRelative(d.declinada_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Metadata bruto">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <pre className="max-h-64 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
            <span className="text-muted-foreground">// secciones_cerradas</span>
            {'\n'}
            {JSON.stringify(row.sesion.secciones_cerradas, null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto rounded-xl bg-foreground/[0.04] p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
            <span className="text-muted-foreground">// metadata</span>
            {'\n'}
            {JSON.stringify(row.sesion.metadata ?? null, null, 2)}
          </pre>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer items-center justify-between rounded-2xl px-5 py-4 transition hover:bg-foreground/[0.02] [&::-webkit-details-marker]:hidden">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition group-open:opacity-50">
            Colapsar
          </span>
        </summary>
        <div className="overflow-hidden rounded-2xl bg-background/30">
          {children}
        </div>
      </details>
    </section>
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
    <div className="rounded-2xl bg-background/40 p-3">
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

function Tag({
  children,
  accent,
  muted,
}: {
  children: React.ReactNode;
  accent?: boolean;
  muted?: boolean;
}) {
  const cls = accent
    ? 'bg-forest text-primary-foreground ring-forest'
    : muted
      ? 'bg-foreground/8 text-muted-foreground ring-foreground/15'
      : 'bg-forest/12 text-forest ring-forest/25';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      {children}
    </span>
  );
}

function RolBadge({ rol }: { rol: 'agente' | 'usuario' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
        rol === 'agente'
          ? 'bg-forest text-primary-foreground ring-forest'
          : 'bg-lime text-lime-foreground ring-lime'
      }`}
    >
      {rol}
    </span>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
