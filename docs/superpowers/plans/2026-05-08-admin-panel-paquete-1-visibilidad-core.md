# Admin Panel — Paquete 1 (Visibilidad Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar al admin de Vértice tres mejoras: índice global de sesiones con filtros (gap A), perfil JSON por sesión + histórico (gap E) y command palette Cmd+K (gap G).

**Architecture:** React Server Components para todo lo que renderiza data, un solo client island (command palette). Filtros en URL params, no en estado cliente. Queries Drizzle directas en `page.tsx`. Páginas `force-dynamic`. Helpers puros en `lib/admin/` para parseo y sanitización (testeables con Vitest unit). Integration test del route handler `/admin/api/search` reutiliza el patrón de `lib/motor/review.integration.test.ts` (vi.hoisted + vi.mock de `@/lib/db`).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript estricto, Drizzle ORM (postgres-js), Tailwind v4, Vitest 4.x, `@base-ui/react` Dialog (ya instalado), `lucide-react` para iconos.

**Spec:** `docs/superpowers/specs/2026-05-08-admin-panel-paquete-1-visibilidad-core-design.md`

---

## File Structure

**Crear:**

- `lib/admin/parse-status-filter.ts` — helper puro, valida y normaliza `?status=` del índice global.
- `lib/admin/parse-status-filter.test.ts` — unit tests del helper.
- `lib/admin/search-query.ts` — helpers `sanitizeQuery` + `isUuidish` para el route handler de search.
- `lib/admin/search-query.test.ts` — unit tests.
- `app/admin/sesiones/page.tsx` — server component, índice global con filtros chips.
- `app/admin/api/search/route.ts` — route handler GET, devuelve JSON.
- `app/admin/api/search/route.integration.test.ts` — integration test contra Postgres real.
- `components/admin/command-palette.tsx` — `'use client'`, Dialog con búsqueda + keyboard nav.
- `components/admin/command-palette-trigger.tsx` — `'use client'`, botón en header + listener Cmd+K global.

**Modificar:**

- `app/admin/layout.tsx` — agregar nav link "Sesiones" + montar `<CommandPaletteTrigger />`.
- `app/admin/sesiones/[id]/page.tsx` — agregar sección "Perfil de esta sesión".
- `app/admin/instituciones/[id]/page.tsx` — reemplazar "último perfil" por "histórico de perfiles".

**Sin cambios pero referenciados:**

- `lib/auth/admin.ts` (`adminGuardOrThrow`).
- `lib/db.ts`, `db/schema.ts`.
- `lib/motor/test-db.ts` (referencia para el integration test).

---

## Task 0: Crear branch de trabajo

**Files:** Solo git.

- [ ] **Step 1: Verificar working tree limpio**

Run: `git status --short`

Si hay cambios sin commitear ajenos al spec, detener y consultar al usuario antes de crear branch (no incluirlos en este trabajo).

- [ ] **Step 2: Crear y cambiar a branch**

Run: `git checkout -b feat/admin-paquete-1-visibilidad-core`

Expected: `Switched to a new branch 'feat/admin-paquete-1-visibilidad-core'`

---

## Task 1: Helper `parseStatusFilter` con tests

**Files:**
- Create: `lib/admin/parse-status-filter.ts`
- Test: `lib/admin/parse-status-filter.test.ts`

- [ ] **Step 1: Crear directorio si no existe**

Run: `mkdir -p lib/admin`

- [ ] **Step 2: Escribir el test (TDD red)**

Crear `lib/admin/parse-status-filter.test.ts` con:

```ts
import { describe, it, expect } from 'vitest';
import { parseStatusFilter } from './parse-status-filter';

describe('parseStatusFilter', () => {
  it('devuelve default cuando raw es undefined', () => {
    expect(parseStatusFilter(undefined)).toEqual(['abierta', 'sintetizando']);
  });

  it('devuelve default cuando raw es cadena vacía', () => {
    expect(parseStatusFilter('')).toEqual(['abierta', 'sintetizando']);
  });

  it('acepta un solo status válido', () => {
    expect(parseStatusFilter('completa')).toEqual(['completa']);
  });

  it('acepta múltiples válidos separados por coma', () => {
    expect(parseStatusFilter('completa,abandonada')).toEqual([
      'completa',
      'abandonada',
    ]);
  });

  it('filtra valores inválidos y conserva los válidos', () => {
    expect(parseStatusFilter('garbage,abierta')).toEqual(['abierta']);
  });

  it('devuelve default cuando todos son inválidos', () => {
    expect(parseStatusFilter('garbage,otra')).toEqual([
      'abierta',
      'sintetizando',
    ]);
  });

  it('hace trim de whitespace alrededor de cada valor', () => {
    expect(parseStatusFilter(' completa , abandonada ')).toEqual([
      'completa',
      'abandonada',
    ]);
  });

  it('descarta segmentos vacíos por comas dobles', () => {
    expect(parseStatusFilter('completa,,abandonada')).toEqual([
      'completa',
      'abandonada',
    ]);
  });
});
```

- [ ] **Step 3: Correr el test, esperar fallo por import**

Run: `npx vitest run lib/admin/parse-status-filter.test.ts`

Expected: FAIL — `Cannot find module './parse-status-filter'`.

- [ ] **Step 4: Implementar helper**

Crear `lib/admin/parse-status-filter.ts` con:

```ts
// Helper para parsear el query param `?status=` del índice global de sesiones.
// Validación contra el set de status del enum sesionStatusEnum (db/schema.ts).
// Si el input está vacío o no contiene ningún valor válido, cae al default
// operativo: las sesiones "vivas" (abiertas o en síntesis).

export const VALID_STATUSES = [
  'abierta',
  'pausada',
  'sintetizando',
  'completa',
  'abandonada',
] as const;

export type SesionStatus = (typeof VALID_STATUSES)[number];

const DEFAULT: SesionStatus[] = ['abierta', 'sintetizando'];

export function parseStatusFilter(raw: string | undefined): SesionStatus[] {
  if (!raw) return [...DEFAULT];
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const valid = parts.filter((s): s is SesionStatus =>
    (VALID_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : [...DEFAULT];
}
```

- [ ] **Step 5: Correr el test, esperar pasa**

Run: `npx vitest run lib/admin/parse-status-filter.test.ts`

Expected: PASS — los 8 tests verdes.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/admin/parse-status-filter.ts lib/admin/parse-status-filter.test.ts
git commit -m "feat(admin): helper parseStatusFilter con unit tests"
```

---

## Task 2: Página `/admin/sesiones` (índice global)

**Files:**
- Create: `app/admin/sesiones/page.tsx`
- Modify: `app/admin/layout.tsx` (agregar nav link)

Esta task no tiene unit test (server component que consulta DB; spec dice E2E manual). Validamos con typecheck + dev server.

- [ ] **Step 1: Crear directorio y archivo de página**

Run: `mkdir -p app/admin/sesiones`

Crear `app/admin/sesiones/page.tsx` con:

```tsx
// Índice global de sesiones con filtros por status. Default operativo:
// 'abierta' + 'sintetizando' (sesiones vivas). Filtros chips en URL → links
// que cambian ?status=...

import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { ArrowRight, Sparkles } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import {
  parseStatusFilter,
  VALID_STATUSES,
  type SesionStatus,
} from '@/lib/admin/parse-status-filter';

export const dynamic = 'force-dynamic';

const HARD_LIMIT = 500;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminSesionesIndexPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeStatuses = parseStatusFilter(status);

  const rows = await db
    .select({
      sesion_id: sesiones.id,
      status: sesiones.status,
      started_at: sesiones.started_at,
      ultimo_turno_at: sesiones.ultimo_turno_at,
      cajas_llenas: sesiones.cajas_llenas_count,
      cajas_aplicables: sesiones.cajas_aplicables,
      institucion_id: instituciones.id,
      razon_social: instituciones.razon_social,
      tipo: instituciones.tipo,
    })
    .from(sesiones)
    .innerJoin(instituciones, eq(sesiones.institucion_id, instituciones.id))
    .where(inArray(sesiones.status, activeStatuses))
    .orderBy(desc(sesiones.ultimo_turno_at))
    .limit(HARD_LIMIT + 1);

  const truncated = rows.length > HARD_LIMIT;
  const visible = truncated ? rows.slice(0, HARD_LIMIT) : rows;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Operativo
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Sesiones
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {visible.length} {visible.length === 1 ? 'visible' : 'visibles'}
          {truncated && ` (mostrando primeras ${HARD_LIMIT}, refina filtros)`}
        </p>
      </header>

      <FilterChips active={activeStatuses} />

      {visible.length === 0 ? (
        <EmptyState filtered={activeStatuses.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <Th>Institución</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Cajas</Th>
                <Th>Iniciada</Th>
                <Th>Último turno</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {visible.map((s) => (
                <tr
                  key={s.sesion_id}
                  className="transition hover:bg-foreground/[0.02]"
                >
                  <Td>
                    <Link
                      href={`/admin/instituciones/${s.institucion_id}`}
                      className="font-medium text-foreground hover:text-forest hover:underline"
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
                    {formatRelative(s.started_at)}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {formatRelative(s.ultimo_turno_at)}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/sesiones/${s.sesion_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline"
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
    </div>
  );
}

function FilterChips({ active }: { active: SesionStatus[] }) {
  const activeSet = new Set(active);
  return (
    <div className="flex flex-wrap gap-2">
      <ChipLink
        href="/admin/sesiones"
        active={active.length === 0 /* nunca true por default; reservado */}
      >
        Default (vivas)
      </ChipLink>
      {VALID_STATUSES.map((s) => {
        const isActive = activeSet.has(s);
        const next = isActive
          ? activeSet.size === 1
            ? null // si era el único, limpia
            : Array.from(activeSet).filter((x) => x !== s)
          : [...active, s];
        const href = next === null ? '/admin/sesiones' : `/admin/sesiones?status=${next.join(',')}`;
        return (
          <ChipLink key={s} href={href} active={isActive}>
            {s}
          </ChipLink>
        );
      })}
    </div>
  );
}

function ChipLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const cls = active
    ? 'bg-forest text-primary-foreground ring-forest'
    : 'bg-cream text-foreground ring-foreground/10 hover:bg-foreground/5';
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${cls}`}
    >
      {children}
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-3xl bg-cream p-10 text-center shadow-sm ring-1 ring-foreground/5">
      <p className="text-sm text-muted-foreground">
        {filtered
          ? 'Sin sesiones con estos filtros.'
          : 'Aún no hay sesiones. Crea una institución para emitir un magic link.'}
      </p>
      {filtered && (
        <Link
          href="/admin/sesiones"
          className="mt-3 inline-block text-xs font-medium text-forest hover:underline"
        >
          Ver todas
        </Link>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-5 py-3">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 ${className ?? ''}`}>{children}</td>;
}

const STATUS_STYLE: Record<string, string> = {
  abierta: 'bg-lime/30 text-lime-foreground ring-lime/40',
  pausada: 'bg-amber-100 text-amber-900 ring-amber-200',
  sintetizando: 'bg-forest/15 text-forest ring-forest/30',
  completa: 'bg-forest text-primary-foreground ring-forest',
  abandonada: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function StatusPill({ status }: { status: string }) {
  const cls =
    STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      <Sparkles className="size-2.5" />
      {status}
    </span>
  );
}
```

- [ ] **Step 2: Modificar `app/admin/layout.tsx` para agregar nav link**

Localizar el bloque del nav (líneas con `<NavLink href="/admin">Resumen</NavLink>` etc.) y añadir el link de "Sesiones" entre "Resumen" e "Instituciones".

Cambio textual: el bloque actual es

```tsx
<nav className="ml-6 hidden items-center gap-1 md:flex">
  <NavLink href="/admin">Resumen</NavLink>
  <NavLink href="/admin/instituciones">Instituciones</NavLink>
  <NavLink href="/admin/instituciones/nueva">
    Nueva institución
  </NavLink>
</nav>
```

Cambiar a:

```tsx
<nav className="ml-6 hidden items-center gap-1 md:flex">
  <NavLink href="/admin">Resumen</NavLink>
  <NavLink href="/admin/sesiones">Sesiones</NavLink>
  <NavLink href="/admin/instituciones">Instituciones</NavLink>
  <NavLink href="/admin/instituciones/nueva">
    Nueva institución
  </NavLink>
</nav>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS, sin errores nuevos.

- [ ] **Step 4: E2E manual con dev server**

Run en una terminal separada (background si manejas con run_in_background):

```bash
npm run dev
```

Validar en browser:

1. Login admin con tu token (`http://localhost:3000/admin/login?next=/admin`).
2. Ir a `/admin/sesiones` desde el nav. Debe cargar con filtros default activos (chips "abierta" y "sintetizando" destacados).
3. Click en "completa" → URL debe pasar a `?status=completa,abierta,sintetizando` (toggle aditivo) y la tabla actualizarse.
4. Click en una sesión visible → debe navegar a `/admin/sesiones/[id]` (página existente).
5. Click en chip "Default (vivas)" → URL limpia, vuelve a default.
6. Si tienes >0 sesiones que ya están "completa", filtrar solo por "completa" debe mostrarlas.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/admin/sesiones/page.tsx app/admin/layout.tsx
git commit -m "feat(admin): índice global /admin/sesiones con filtros por status (gap A)"
```

---

## Task 3: Sección "Perfil de esta sesión" en `/admin/sesiones/[id]`

**Files:**
- Modify: `app/admin/sesiones/[id]/page.tsx`

Cambio mínimo: agregar query al `Promise.all` existente y renderizar nueva `<Section>`.

- [ ] **Step 1: Agregar `perfil_decision_final` al import**

Localizar el bloque de imports en `app/admin/sesiones/[id]/page.tsx` que importa de `@/db/schema`:

```tsx
import {
  sesiones,
  instituciones,
  turnos_conversacion,
  extracciones,
  casos_generados,
  reviews_seccion,
  cajas_declinadas,
} from '@/db/schema';
```

Cambiar a (agregar `perfil_decision_final`):

```tsx
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
```

- [ ] **Step 2: Agregar query al `Promise.all`**

Localizar el bloque actual (alrededor de la línea 44):

```tsx
const [turnos, extraccionesActivas, casos, reviews, declinadas] =
  await Promise.all([
    db
      .select()
      .from(turnos_conversacion)
      .where(eq(turnos_conversacion.sesion_id, id))
      .orderBy(asc(turnos_conversacion.numero_turno)),
    // ... otras 4 queries existentes
  ]);
```

Cambiar a (agregar la sexta query y desestructurar `perfilSesion`):

```tsx
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
```

- [ ] **Step 3: Renderizar nueva `<Section>` antes de "Metadata bruto"**

Localizar la sección `<Section title="Metadata bruto">` (penúltima en el JSX) y añadir ANTES:

```tsx
<Section title="Perfil de esta sesión">
  {!perfilSesion ? (
    <Empty message="La síntesis aún no se ha generado para esta sesión." />
  ) : (
    <div className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Schema" value={perfilSesion.schema_version} mono />
        <Stat
          label="Completitud"
          value={`${Math.round(perfilSesion.completitud * 100)}%`}
        />
        <Stat
          label="Confianza global"
          value={perfilSesion.confianza_global.toFixed(2)}
          mono
        />
        <Stat label="Versión" value={String(perfilSesion.version)} mono />
      </div>
      <details className="rounded-2xl bg-foreground text-primary-foreground">
        <summary className="cursor-pointer rounded-2xl px-5 py-3 text-xs font-semibold tracking-tight text-primary-foreground/85 hover:text-primary-foreground [&::-webkit-details-marker]:hidden">
          Ver JSON completo
        </summary>
        <pre className="max-h-96 overflow-auto px-5 pb-5 font-mono text-[11px] leading-relaxed text-primary-foreground/85">
          {JSON.stringify(perfilSesion.perfil_json, null, 2)}
        </pre>
      </details>
    </div>
  )}
</Section>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: E2E manual**

Con dev server corriendo:

1. Abrir una sesión que TENGA perfil generado (`status='completa'` con perfil): la nueva sección debe mostrar 4 stats + JSON colapsable.
2. Abrir una sesión que NO tenga perfil (`status='abierta'`): la sección debe mostrar el mensaje "La síntesis aún no se ha generado para esta sesión."

- [ ] **Step 6: Commit**

Run:

```bash
git add app/admin/sesiones/[id]/page.tsx
git commit -m "feat(admin): perfil JSON por sesión en /admin/sesiones/[id] (gap E parte 1)"
```

---

## Task 4: Histórico de perfiles en `/admin/instituciones/[id]`

**Files:**
- Modify: `app/admin/instituciones/[id]/page.tsx`

La query existente ya devuelve `perfiles` ordenados DESC por versión. Solo cambia el render.

- [ ] **Step 1: Reemplazar el bloque "Perfil JSON (síntesis final)"**

Localizar la sección actual (al final del JSX), que arranca con:

```tsx
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
    /* empty state */
  ) : (
    /* render single perfil */
  )}
</section>
```

Reemplazar la sección entera por:

```tsx
<section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
  <div className="flex items-center justify-between px-5 py-4">
    <h2 className="text-sm font-semibold tracking-tight text-foreground">
      Histórico de perfiles ({perfiles.length})
    </h2>
  </div>
  {perfiles.length === 0 ? (
    <div className="rounded-2xl bg-background/30 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        No hay perfil generado todavía. La síntesis se ejecuta cuando
        cierra la última sección de la entrevista (Fase 8).
      </p>
    </div>
  ) : (
    <ul className="divide-y divide-foreground/5">
      {perfiles.map((p, idx) => (
        <li key={p.id} className="px-5 py-4">
          <details open={idx === 0} className="group">
            <summary className="flex cursor-pointer items-center justify-between [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-foreground">
                  v{p.version}
                </span>
                <Tag muted>{formatRelative(p.generado_at)}</Tag>
                <span className="font-mono text-[10px] text-muted-foreground">
                  sesión {p.sesion_id.slice(0, 8)}…
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition group-open:opacity-50">
                Colapsar
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Schema" value={p.schema_version} mono />
                <Stat
                  label="Completitud"
                  value={`${Math.round(p.completitud * 100)}%`}
                />
                <Stat
                  label="Confianza"
                  value={p.confianza_global.toFixed(2)}
                  mono
                />
                <Stat label="Versión" value={String(p.version)} mono />
              </div>
              <pre className="max-h-96 overflow-auto rounded-2xl bg-foreground p-4 font-mono text-[11px] leading-relaxed text-primary-foreground/85">
                {JSON.stringify(p.perfil_json, null, 2)}
              </pre>
            </div>
          </details>
        </li>
      ))}
    </ul>
  )}
</section>
```

- [ ] **Step 2: Eliminar la línea `const latestPerfil = perfiles[0] ?? null;`**

Buscar y eliminar la línea (no se usa más). Está en la zona arriba del return, después del `Promise.all`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: E2E manual**

1. Abrir una institución sin perfiles: debe ver mensaje "No hay perfil generado todavía".
2. Abrir una institución con 1 perfil: debe ver una `<details>` abierta por default con stats + JSON.
3. Abrir una institución con 2+ perfiles (si tienes data): debe ver lista, primera abierta, resto colapsado. Click expande/colapsa.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/admin/instituciones/[id]/page.tsx
git commit -m "feat(admin): histórico de perfiles en /admin/instituciones/[id] (gap E parte 2)"
```

---

## Task 5: Helper `sanitizeQuery` + `isUuidish` con tests

**Files:**
- Create: `lib/admin/search-query.ts`
- Test: `lib/admin/search-query.test.ts`

- [ ] **Step 1: Escribir el test (TDD red)**

Crear `lib/admin/search-query.test.ts` con:

```ts
import { describe, it, expect } from 'vitest';
import {
  sanitizeQuery,
  isUuidish,
  SEARCH_MIN_LEN,
  SEARCH_MAX_LEN,
} from './search-query';

describe('sanitizeQuery', () => {
  it('hace trim de whitespace', () => {
    expect(sanitizeQuery('  banco  ')).toBe('banco');
  });

  it('limita a SEARCH_MAX_LEN chars', () => {
    const long = 'a'.repeat(SEARCH_MAX_LEN + 50);
    expect(sanitizeQuery(long).length).toBe(SEARCH_MAX_LEN);
  });

  it('escapa wildcards % y _ y backslash', () => {
    expect(sanitizeQuery('50%_off\\day')).toBe('50\\%\\_off\\\\day');
  });

  it('devuelve cadena vacía cuando input es solo whitespace', () => {
    expect(sanitizeQuery('   ')).toBe('');
  });
});

describe('isUuidish', () => {
  it('acepta 4 hex chars', () => {
    expect(isUuidish('abcd')).toBe(true);
  });

  it('acepta 8 hex con dash', () => {
    expect(isUuidish('abcd-ef12')).toBe(true);
  });

  it('acepta UUID completo (36 chars)', () => {
    expect(isUuidish('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
  });

  it('rechaza menos de 4 chars', () => {
    expect(isUuidish('ab')).toBe(false);
    expect(isUuidish('abc')).toBe(false);
  });

  it('rechaza chars no-hex', () => {
    expect(isUuidish('xyz1')).toBe(false);
  });

  it('rechaza más de 36 chars', () => {
    expect(isUuidish('a'.repeat(37))).toBe(false);
  });

  it('rechaza vacío', () => {
    expect(isUuidish('')).toBe(false);
  });

  it('es case-insensitive', () => {
    expect(isUuidish('ABCDEF12')).toBe(true);
  });

  it('SEARCH_MIN_LEN es 2', () => {
    expect(SEARCH_MIN_LEN).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test, esperar fallo**

Run: `npx vitest run lib/admin/search-query.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar helper**

Crear `lib/admin/search-query.ts` con:

```ts
// Helpers para el route handler /admin/api/search.
//
// sanitizeQuery: trim + cap de longitud + escape de wildcards LIKE para que el
// usuario no pueda inyectar `%` o `_` y forzar match cualquiera.
// isUuidish: detecta si el query parece un UUID parcial — sólo entonces
// disparamos la query contra `sesiones.id::text ILIKE`.

export const SEARCH_MIN_LEN = 2;
export const SEARCH_MAX_LEN = 100;

export function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, SEARCH_MAX_LEN)
    .replace(/[%_\\]/g, '\\$&');
}

const UUIDISH_RE = /^[0-9a-f-]{4,36}$/i;

export function isUuidish(q: string): boolean {
  return UUIDISH_RE.test(q);
}
```

- [ ] **Step 4: Correr el test, esperar pasa**

Run: `npx vitest run lib/admin/search-query.test.ts`

Expected: PASS — los 11 tests verdes.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/admin/search-query.ts lib/admin/search-query.test.ts
git commit -m "feat(admin): helpers sanitizeQuery + isUuidish con unit tests"
```

---

## Task 6: Route handler `/admin/api/search` + integration test

**Files:**
- Create: `app/admin/api/search/route.ts`
- Test: `app/admin/api/search/route.integration.test.ts`

- [ ] **Step 1: Crear directorio y route handler**

Run: `mkdir -p app/admin/api/search`

Crear `app/admin/api/search/route.ts` con:

```ts
// GET /admin/api/search?q=<term>
// Devuelve { instituciones, sesiones } limitando 8 resultados por categoría.
// Auth via cookie admin (adminGuardOrThrow). Sesiones solo se consultan si q
// parece UUID parcial (isUuidish).

import { NextResponse } from 'next/server';
import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { adminGuardOrThrow } from '@/lib/auth/admin';
import {
  sanitizeQuery,
  isUuidish,
  SEARCH_MIN_LEN,
} from '@/lib/admin/search-query';

export const dynamic = 'force-dynamic';

const RESULT_LIMIT = 8;

export async function GET(req: Request) {
  try {
    await adminGuardOrThrow();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get('q') ?? '';
  const q = sanitizeQuery(raw);

  if (q.length < SEARCH_MIN_LEN) {
    return NextResponse.json(
      { instituciones: [], sesiones: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const pattern = `%${q}%`;
    const sesionPattern = `${q}%`;

    const inst$ = db
      .select({
        id: instituciones.id,
        razon_social: instituciones.razon_social,
        tipo: instituciones.tipo,
      })
      .from(instituciones)
      .where(
        or(
          ilike(instituciones.razon_social, pattern),
          ilike(instituciones.nombre_comercial, pattern),
          ilike(instituciones.email_contacto, pattern)
        )
      )
      .orderBy(desc(instituciones.created_at))
      .limit(RESULT_LIMIT);

    const ses$ = isUuidish(q)
      ? db
          .select({
            id: sesiones.id,
            status: sesiones.status,
            started_at: sesiones.started_at,
            razon_social: instituciones.razon_social,
          })
          .from(sesiones)
          .innerJoin(
            instituciones,
            eq(sesiones.institucion_id, instituciones.id)
          )
          .where(sql`${sesiones.id}::text ILIKE ${sesionPattern}`)
          .limit(RESULT_LIMIT)
      : Promise.resolve([] as Array<{
          id: string;
          status: string;
          started_at: Date;
          razon_social: string;
        }>);

    const [inst, ses] = await Promise.all([inst$, ses$]);

    return NextResponse.json(
      { instituciones: inst, sesiones: ses },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('search route error:', err);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Escribir integration test**

Crear `app/admin/api/search/route.integration.test.ts` con:

```ts
// Integration tests del route handler /admin/api/search contra Postgres real.
// Patrón clonado de lib/motor/review.integration.test.ts: vi.hoisted construye
// un cliente postgres-js apuntando a DATABASE_URL_TEST y vi.mock redirige
// @/lib/db al cliente del test. Adicionalmente mockeamos @/lib/auth/admin para
// no depender de cookies reales.

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url.trim().length === 0) {
    return { db: null, client: null, url: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/postgres-js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require('postgres');
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client);
  return { db, client, url };
});

vi.mock('@/lib/db', () => ({ db: hoisted.db }));

// Mock auth: por default autenticado. Tests que necesiten 401 lo overridean.
const authMock = vi.hoisted(() => ({
  authenticated: true,
}));
vi.mock('@/lib/auth/admin', () => ({
  adminGuardOrThrow: async () => {
    if (!authMock.authenticated) throw new Error('unauthorized');
  },
}));

import { instituciones, sesiones } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { GET } from './route';

const { db, client, url } = hoisted;

describe.skipIf(!url)('GET /admin/api/search (integration)', () => {
  afterAll(async () => {
    if (client) await client.end();
  });

  beforeEach(async () => {
    await resetReviewTables(db!);
    authMock.authenticated = true;
  });

  async function callSearch(q: string): Promise<Response> {
    const req = new Request(`http://test.local/admin/api/search?q=${encodeURIComponent(q)}`);
    return GET(req);
  }

  it('devuelve 401 cuando no está autenticado', async () => {
    authMock.authenticated = false;
    const res = await callSearch('banco');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('devuelve arrays vacíos cuando q es muy corta', async () => {
    const res = await callSearch('a');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ instituciones: [], sesiones: [] });
  });

  it('encuentra instituciones por razón social (ILIKE)', async () => {
    await db!
      .insert(instituciones)
      .values([
        {
          razon_social: 'Banco Ejemplo',
          tipo: 'banco',
          email_contacto: 'a@ejemplo.test',
        },
        {
          razon_social: 'Sofom Otra',
          tipo: 'sofom_er',
          email_contacto: 'b@otra.test',
        },
      ]);

    const res = await callSearch('banco');
    const body = await res.json();
    expect(body.instituciones.length).toBe(1);
    expect(body.instituciones[0].razon_social).toBe('Banco Ejemplo');
    expect(body.sesiones).toEqual([]);
  });

  it('encuentra instituciones por email', async () => {
    await db!.insert(instituciones).values({
      razon_social: 'Test Inc',
      tipo: 'sofipo',
      email_contacto: 'unicorn@test.local',
    });

    const res = await callSearch('unicorn');
    const body = await res.json();
    expect(body.instituciones.length).toBe(1);
    expect(body.instituciones[0].razon_social).toBe('Test Inc');
  });

  it('escapa wildcards en q (% no actúa como wildcard)', async () => {
    await db!
      .insert(instituciones)
      .values([
        {
          razon_social: 'Banco Real',
          tipo: 'banco',
          email_contacto: 'real@test.test',
        },
        {
          razon_social: 'Otra Cosa',
          tipo: 'banco',
          email_contacto: 'otra@test.test',
        },
      ]);

    // q='%real%' después de escape se vuelve '\%real\%' que no debería matchear
    // como wildcard, sino como literal '%real%' que no existe en ninguna razón
    // social → 0 resultados.
    const res = await callSearch('%real%');
    const body = await res.json();
    expect(body.instituciones.length).toBe(0);
  });

  it('encuentra sesiones por UUID parcial (isUuidish)', async () => {
    const [inst] = await db!
      .insert(instituciones)
      .values({
        razon_social: 'Banco Para Sesion',
        tipo: 'banco',
        email_contacto: 'sesion@test.test',
      })
      .returning({ id: instituciones.id });

    const [ses] = await db!
      .insert(sesiones)
      .values({
        institucion_id: inst.id,
        cajas_aplicables: 49,
      })
      .returning({ id: sesiones.id });

    const prefix = ses.id.slice(0, 8); // 8 chars hex con dashes posibles
    const res = await callSearch(prefix);
    const body = await res.json();
    // El prefix matchea la sesión recién creada
    const found = body.sesiones.find((s: { id: string }) => s.id === ses.id);
    expect(found).toBeTruthy();
    expect(found.razon_social).toBe('Banco Para Sesion');
  });

  it('no consulta sesiones cuando q no es UUID-ish', async () => {
    await db!.insert(instituciones).values({
      razon_social: 'Banco XYZ',
      tipo: 'banco',
      email_contacto: 'xyz@test.test',
    });

    const res = await callSearch('banco');
    const body = await res.json();
    // 'banco' no es uuidish → sesiones vacío
    expect(body.sesiones).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr integration test**

Si tienes `DATABASE_URL_TEST` configurada en `.env.local`:

Run: `npx vitest run app/admin/api/search/route.integration.test.ts`

Expected: PASS — los 7 tests.

Si NO tienes `DATABASE_URL_TEST`:

Expected: el suite se skipea (output muestra `0 tests`). Eso está OK — el integration corre en CI con la branch dedicada.

- [ ] **Step 4: Verificar que la suite completa sigue verde**

Run: `npm test`

Expected: todos los tests existentes + nuevos pasan (los integration se skipean si no hay DATABASE_URL_TEST).

- [ ] **Step 5: Commit**

Run:

```bash
git add app/admin/api/search/route.ts app/admin/api/search/route.integration.test.ts
git commit -m "feat(admin): route handler /admin/api/search + integration tests"
```

---

## Task 7: Command palette + trigger (`'use client'`)

**Files:**
- Create: `components/admin/command-palette.tsx`
- Create: `components/admin/command-palette-trigger.tsx`
- Modify: `app/admin/layout.tsx` (montar trigger)

- [ ] **Step 1: Crear directorio components/admin**

Run: `mkdir -p components/admin`

- [ ] **Step 2: Crear `command-palette.tsx`**

Crear `components/admin/command-palette.tsx` con:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { Search, Building2, Activity, Loader2 } from 'lucide-react';

interface InstResult {
  id: string;
  razon_social: string;
  tipo: string;
}
interface SesionResult {
  id: string;
  status: string;
  started_at: string;
  razon_social: string;
}
interface SearchResults {
  instituciones: InstResult[];
  sesiones: SesionResult[];
}

const EMPTY: SearchResults = { instituciones: [], sesiones: [] };
const DEBOUNCE_MS = 150;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
      setError(null);
      setSelectedIdx(0);
      abortRef.current?.abort();
    }
  }, [open]);

  // Fetch debounced
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      fetch(`/admin/api/search?q=${encodeURIComponent(query)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then(async (r) => {
          if (r.status === 401) {
            onOpenChange(false);
            const next = encodeURIComponent(window.location.pathname);
            router.push(`/admin/login?next=${next}`);
            return null;
          }
          if (!r.ok) throw new Error(`status ${r.status}`);
          return r.json();
        })
        .then((data: SearchResults | null) => {
          if (data) {
            setResults(data);
            setSelectedIdx(0);
          }
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name === 'AbortError') return;
          setError('Búsqueda no disponible');
          setResults(EMPTY);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, router, onOpenChange]);

  // Lista flat para keyboard nav: [...instituciones, ...sesiones]
  const flatItems: Array<
    { kind: 'inst'; data: InstResult } | { kind: 'ses'; data: SesionResult }
  > = [
    ...results.instituciones.map((i) => ({ kind: 'inst' as const, data: i })),
    ...results.sesiones.map((s) => ({ kind: 'ses' as const, data: s })),
  ];

  function navigate(item: (typeof flatItems)[number]) {
    onOpenChange(false);
    if (item.kind === 'inst') {
      router.push(`/admin/instituciones/${item.data.id}`);
    } else {
      router.push(`/admin/sesiones/${item.data.id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (flatItems.length === 0 ? 0 : (i + 1) % flatItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) =>
        flatItems.length === 0 ? 0 : (i - 1 + flatItems.length) % flatItems.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIdx];
      if (item) navigate(item);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-foreground/30 backdrop-blur-sm" />
        <Dialog.Popup
          className="fixed left-1/2 top-24 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-cream shadow-2xl ring-1 ring-foreground/10 md:top-32"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar instituciones o sesión por id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error && (
              <p className="px-4 py-6 text-center text-xs text-amber-700">{error}</p>
            )}
            {!error && query.trim().length < 2 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Empieza a escribir (min. 2 caracteres)…
              </p>
            )}
            {!error && query.trim().length >= 2 && flatItems.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            )}
            {!error && results.instituciones.length > 0 && (
              <ResultGroup label="Instituciones">
                {results.instituciones.map((inst, idx) => (
                  <ResultRow
                    key={inst.id}
                    icon={<Building2 className="size-4" />}
                    title={inst.razon_social}
                    subtitle={inst.tipo}
                    selected={selectedIdx === idx}
                    onClick={() => navigate({ kind: 'inst', data: inst })}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  />
                ))}
              </ResultGroup>
            )}
            {!error && results.sesiones.length > 0 && (
              <ResultGroup label="Sesiones">
                {results.sesiones.map((ses, i) => {
                  const idx = results.instituciones.length + i;
                  return (
                    <ResultRow
                      key={ses.id}
                      icon={<Activity className="size-4" />}
                      title={`${ses.razon_social} · ${ses.status}`}
                      subtitle={ses.id}
                      selected={selectedIdx === idx}
                      onClick={() => navigate({ kind: 'ses', data: ses })}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    />
                  );
                })}
              </ResultGroup>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  selected,
  onClick,
  onMouseEnter,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
          selected ? 'bg-forest/10' : 'hover:bg-foreground/[0.02]'
        }`}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
    </li>
  );
}
```

- [ ] **Step 3: Crear `command-palette-trigger.tsx`**

Crear `components/admin/command-palette-trigger.tsx` con:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CommandPalette } from './command-palette';

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');

  useEffect(() => {
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    setShortcutLabel(isMac ? '⌘ K' : 'Ctrl K');

    function onKey(e: KeyboardEvent) {
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-forest/40 px-3 py-1.5 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-forest/70"
      >
        <Search className="size-3.5" />
        <span className="hidden md:inline">Buscar…</span>
        <span className="hidden rounded bg-foreground/20 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground/80 md:inline">
          {shortcutLabel}
        </span>
      </button>
      {open && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
```

- [ ] **Step 4: Modificar `app/admin/layout.tsx` para montar el trigger**

Localizar el bloque del header donde está el form de logout:

```tsx
<form action={logoutAdmin}>
  <button
    type="submit"
    className="rounded-full bg-forest/40 px-3 py-1.5 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-forest/70"
  >
    Cerrar sesión
  </button>
</form>
```

Cambiar a (envolver en un flex container y agregar el trigger antes):

```tsx
<div className="flex items-center gap-2">
  <CommandPaletteTrigger />
  <form action={logoutAdmin}>
    <button
      type="submit"
      className="rounded-full bg-forest/40 px-3 py-1.5 text-xs font-medium text-primary-foreground/85 ring-1 ring-primary-foreground/10 transition hover:bg-forest/70"
    >
      Cerrar sesión
    </button>
  </form>
</div>
```

Y agregar el import al top del archivo:

```tsx
import { CommandPaletteTrigger } from '@/components/admin/command-palette-trigger';
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: E2E manual completo**

Con `npm run dev`:

1. Login admin.
2. Navegar a `/admin`. Ver botón "Buscar… ⌘ K" (o "Ctrl K" en PC) en el header.
3. Presionar Cmd/Ctrl+K → palette debe abrir, foco en input.
4. Tipear "ban" (o el inicio de una razón social que tengas) → ver resultados de instituciones.
5. ↑↓ debe mover el highlight; Enter debe navegar al detalle.
6. Esc debe cerrar el palette.
7. Tipear los primeros 8 chars del UUID de una sesión → debe aparecer en sección "Sesiones".
8. Click directo en un resultado → navega.
9. Cerrar palette y reabrir → debe estar limpio (input vacío).
10. Repetir Cmd+K en `/admin/instituciones` y `/admin/sesiones` → debe funcionar global.
11. En devtools borrar la cookie `vertice_admin` y buscar algo → debe redirigir a `/admin/login?next=...`.
12. Resize a <768px → label "Buscar…" se oculta, queda solo el ícono. Palette ocupa casi todo el viewport.

- [ ] **Step 7: Commit**

Run:

```bash
git add components/admin/command-palette.tsx components/admin/command-palette-trigger.tsx app/admin/layout.tsx
git commit -m "feat(admin): command palette global Cmd+K (gap G)"
```

---

## Task 8: Sweep final + branch ready

**Files:** Solo verificación.

- [ ] **Step 1: Re-correr toda la suite de tests**

Run: `npm test`

Expected: todos verdes. Si DATABASE_URL_TEST está set, integration tests también pasan.

- [ ] **Step 2: Typecheck final**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Lint (si aplica)**

Run: `npm run lint`

Expected: PASS o warnings menores aceptables.

- [ ] **Step 4: Verificar git log limpio**

Run: `git log master..HEAD --oneline`

Expected output:

```
<sha> feat(admin): command palette global Cmd+K (gap G)
<sha> feat(admin): route handler /admin/api/search + integration tests
<sha> feat(admin): helpers sanitizeQuery + isUuidish con unit tests
<sha> feat(admin): histórico de perfiles en /admin/instituciones/[id] (gap E parte 2)
<sha> feat(admin): perfil JSON por sesión en /admin/sesiones/[id] (gap E parte 1)
<sha> feat(admin): índice global /admin/sesiones con filtros por status (gap A)
<sha> feat(admin): helper parseStatusFilter con unit tests
```

- [ ] **Step 5: Resumen al usuario para PR**

Reportar al usuario:
- Branch lista: `feat/admin-paquete-1-visibilidad-core`
- 7 commits, 3 sub-features completadas (A + E + G)
- Tests: N unit nuevos pasando, integration suite OK (o skip si no hay DATABASE_URL_TEST)
- E2E manual ejecutado (lista de 12 puntos del Task 7 step 6)
- Pregunta al usuario si quiere que haga merge a master, abra PR, o lo deja para revisión manual.

NO hacer push ni abrir PR sin pedir explícito al usuario (regla del CLAUDE.md global).

---

## Notas para el ejecutor

- **No agregar dependencias nuevas.** `@base-ui/react`, `lucide-react`, `drizzle-orm` ya están.
- **Si typecheck falla** por algún tipo del DB schema (ej. `tipo` enum vs string), refinar las anotaciones de tipo del componente — no agregar `as any`.
- **Si integration test falla con "DATABASE_URL no configurada"**, NO modificar `vitest.config.ts`; significa que `DATABASE_URL_TEST` no está set y el `describe.skipIf` debería estar saltando el suite. Si no salta, revisar que el `vi.hoisted` retorne `{ db: null, ...}` cuando no hay URL.
- **Si una `Section` o `Stat` o `Tag` no está disponible** en algún archivo modificado, scrollear al final del archivo — son helpers locales, no exports.
- **Cuando muevas el cursor por el palette con `↑↓`**, el highlight no debe scrollear fuera de vista. Si el dataset es chico (max 16 items: 8 inst + 8 ses) no es problema.

---

## Self-review (executed by author)

**Spec coverage:**
- Gap A → Task 1 (helper) + Task 2 (página). ✓
- Gap E → Task 3 (perfil por sesión) + Task 4 (histórico). ✓
- Gap G → Task 5 (helpers) + Task 6 (route handler) + Task 7 (palette + trigger). ✓
- Layout updates → cubiertos en Task 2 (nav link) y Task 7 (trigger). ✓
- Tests → unit en Task 1, 5; integration en Task 6; E2E manual en Task 2, 3, 4, 7. ✓
- Helpers `lib/admin/parse-status-filter.ts` y `lib/admin/search-query.ts` con paths exactos del spec. ✓
- Route handler con cache no-store y dynamic force-dynamic. ✓
- Aborts en cliente con AbortController. ✓
- 401 redirect a login con next. ✓

**Placeholders:** ninguno detectado. Todos los steps tienen código completo, comandos exactos, expected outputs. Sin TODO/TBD.

**Type consistency:**
- `parseStatusFilter` retorna `SesionStatus[]` y se usa en `inArray(sesiones.status, activeStatuses)` — ambos del mismo enum. ✓
- `SearchResults` shape consistente entre route handler (`{ instituciones, sesiones }`) y palette client. ✓
- `sanitizeQuery` y `isUuidish` con signaturas idénticas en helper, test y route handler. ✓
- `SEARCH_MIN_LEN` exportado y referenciado en route handler. ✓
- `CommandPaletteTrigger` y `CommandPalette` con props `open`/`onOpenChange` matcheando. ✓
