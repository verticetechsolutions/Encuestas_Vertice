// Lista todas las instituciones — pivot principal del admin. Cada fila lleva
// al detalle. Conteos derivados (sesiones, perfiles) vienen de subqueries
// agregadas en una sola pasada al server.

import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ArrowRight, Building2 } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  tipo: string;
  email_contacto: string;
  created_at: Date;
  total_sesiones: number;
  ultimo_turno_at: Date | null;
  total_perfiles: number;
}

async function fetchInstituciones(): Promise<Row[]> {
  // SQL crudo para subquery agregada — Drizzle requiere CTEs para esto y se
  // alarga; sql crudo es más legible. Postgres-js parsea timestamps a Date
  // automáticamente cuando vienen como columna timestamptz.
  const result = await db.execute(sql`
    SELECT
      i.id,
      i.razon_social,
      i.nombre_comercial,
      i.tipo::text AS tipo,
      i.email_contacto,
      i.created_at,
      COALESCE(s.total_sesiones, 0)::int AS total_sesiones,
      s.ultimo_turno_at,
      COALESCE(p.total_perfiles, 0)::int AS total_perfiles
    FROM instituciones i
    LEFT JOIN (
      SELECT institucion_id,
             count(*) AS total_sesiones,
             max(ultimo_turno_at) AS ultimo_turno_at
      FROM sesiones
      GROUP BY institucion_id
    ) s ON s.institucion_id = i.id
    LEFT JOIN (
      SELECT institucion_id, count(*) AS total_perfiles
      FROM perfil_decision_final
      GROUP BY institucion_id
    ) p ON p.institucion_id = i.id
    ORDER BY i.created_at DESC
  `);
  return result as unknown as Row[];
}

export default async function AdminInstitucionesPage() {
  const rows = await fetchInstituciones();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Catálogo
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Instituciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'registrada' : 'registradas'}.
          </p>
        </div>
        <Link
          href="/admin/instituciones/nueva"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-[var(--ink-raised)] active:scale-[0.98]"
        >
          <Building2 className="size-4" />
          Nueva institución
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-10 text-center shadow-sm ring-1 ring-foreground/5">
          <p className="text-sm text-muted-foreground">
            Aún no hay instituciones. Crea la primera para emitir un magic link.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Razón social</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3 text-right">Sesiones</th>
                <th className="px-5 py-3 text-right">Perfiles</th>
                <th className="px-5 py-3">Último turno</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="transition hover:bg-foreground/[0.02]"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/instituciones/${r.id}`}
                      className="font-medium text-foreground hover:text-gold-deep hover:underline"
                    >
                      {r.razon_social}
                    </Link>
                    {r.nombre_comercial && (
                      <p className="text-xs text-muted-foreground">
                        {r.nombre_comercial}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {r.tipo}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {r.email_contacto}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                    {r.total_sesiones}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                    {r.total_perfiles}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {formatRelative(r.ultimo_turno_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/instituciones/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline"
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
    </div>
  );
}
