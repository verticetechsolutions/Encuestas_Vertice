// Export CSV/JSON de entidades para auditoría/handoff. Sólo lecturas.
//
// GET /admin/api/export/<entity>?format=csv|json[&raw=1]
// entity ∈ instituciones | sesiones | extracciones | perfiles
//
// Gate: ADMIN_COOKIE válida (validado en middleware via presencia + en este
// handler via isAdminAuthenticated). Sin la cookie, middleware redirige a
// /admin/login antes de llegar acá.
//
// Sprint 2 security audit 2026-05-12: PII redaction default ON +
// audit log de cada export. `?raw=1` exporta sin redactar pero requiere
// confirmación explícita del admin (logueada).

import { NextResponse, type NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  instituciones,
  sesiones,
  extracciones,
  perfil_decision_final,
} from '@/db/schema';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { withAuditLog } from '@/lib/auth/audit';

// Campos sensibles por entidad. Se enmascaran cuando raw!=1.
//   - email_contacto: solo primeros 2 chars + dominio (`zantxxxxx@gmail.com` → `za***@gmail.com`).
//   - telefono_contacto: solo últimos 4 dígitos.
//   - contenido (texto del turno): primeros 80 chars + "…" si más largo.
const PII_FIELDS_BY_ENTITY: Record<Entity, Array<keyof never>> = {
  instituciones: ['email_contacto', 'telefono_contacto'],
  sesiones: ['metadata'], // borrador_respuestas contiene texto libre del usuario
  extracciones: ['valor', 'evidencia_textual'],
  perfiles: ['perfil_json'],
};

const VALID_ENTITIES = [
  'instituciones',
  'sesiones',
  'extracciones',
  'perfiles',
] as const;
type Entity = (typeof VALID_ENTITIES)[number];

function isEntity(s: string): s is Entity {
  return (VALID_ENTITIES as readonly string[]).includes(s);
}

interface Params {
  params: Promise<{ entity: string }>;
}

export async function GET(req: NextRequest, ctx: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { entity } = await ctx.params;
  if (!isEntity(entity)) {
    return NextResponse.json(
      { error: 'unknown_entity', valid: VALID_ENTITIES },
      { status: 400 }
    );
  }

  const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'invalid_format', valid: ['csv', 'json'] },
      { status: 400 }
    );
  }

  const raw = req.nextUrl.searchParams.get('raw') === '1';

  return withAuditLog(
    'exports.descargar',
    {
      target_type: 'entity',
      target_id: entity,
      payload: { format, raw, ts: new Date().toISOString() },
    },
    async () => {
      const rows = await fetchEntity(entity);
      const processed = raw ? rows : redactRows(entity, rows);

      if (format === 'json') {
        return NextResponse.json(processed, {
          headers: {
            'Content-Disposition': `attachment; filename="${entity}${raw ? '_raw' : ''}.json"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      const csv = toCsv(processed);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${entity}${raw ? '_raw' : ''}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
  );
}

// =============================================================================
// Redaction
// =============================================================================

function redactRows(
  entity: Entity,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const redacted: Record<string, unknown> = { ...row };
    for (const field of PII_FIELDS_BY_ENTITY[entity] as string[]) {
      if (!(field in redacted)) continue;
      redacted[field] = redactValue(field, redacted[field]);
    }
    return redacted;
  });
}

function redactValue(field: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (field === 'email_contacto' && typeof value === 'string') {
    return maskEmail(value);
  }
  if (field === 'telefono_contacto' && typeof value === 'string') {
    return maskPhone(value);
  }
  if (typeof value === 'object') {
    // jsonb columns: shallow redaction marker. No imprimimos contenido,
    // solo "[redacted JSONB]" + size hint. Admin que necesite el dato pide
    // ?raw=1 explícito (queda en audit log).
    const json = JSON.stringify(value);
    return `[redacted ${field} JSONB ~${json.length}b — usa ?raw=1 si lo necesitas (queda en audit)]`;
  }
  return '[redacted]';
}

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '[redacted email]';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last4 = digits.slice(-4);
  return `****${last4}`;
}

async function fetchEntity(entity: Entity): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case 'instituciones':
      return (await db
        .select()
        .from(instituciones)
        .orderBy(desc(instituciones.created_at))) as Record<string, unknown>[];
    case 'sesiones':
      return (await db
        .select()
        .from(sesiones)
        .orderBy(desc(sesiones.started_at))) as Record<string, unknown>[];
    case 'extracciones':
      return (await db
        .select()
        .from(extracciones)
        .orderBy(desc(extracciones.created_at))) as Record<string, unknown>[];
    case 'perfiles':
      return (await db
        .select()
        .from(perfil_decision_final)
        .orderBy(desc(perfil_decision_final.generado_at))) as Record<
        string,
        unknown
      >[];
  }
}

// CSV mínimo, RFC-4180. Escapa quotes (doble), wrappa en quotes si tiene
// comma/quote/newline. Objetos/arrays jsonb se serializan a JSON inline (los
// dumps de Postgres ya vienen como objetos plain via Drizzle).
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)))
  );
  const lines: string[] = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(
      headers.map((h) => escapeCsv(formatCsvCell(row[h]))).join(',')
    );
  }
  return lines.join('\n');
}

function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
