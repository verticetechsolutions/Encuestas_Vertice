# Admin Panel — Paquete 2 (Gestión de Magic Links) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al admin reenviar magic links (con auto-revoke de previos), revocar manualmente uno específico y ver histórico filtrable; cubre dos vistas (global + per-institución).

**Architecture:** RSC-first como paquete 1. Helpers puros en `lib/admin/`. Server Actions transaccionales en `app/actions/`. Un solo client island (`magic-link-actions.tsx`) con 3 botones. Contrato `EmitirMagicLinkResult` se extiende sin breaking changes. Migración Drizzle agrega `revoked_at` + índice parcial.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript estricto, Drizzle ORM (postgres-js), Tailwind v4, Vitest 4.x, Resend (modo email opcional), `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-05-08-admin-panel-paquete-2-magic-links-design.md`

---

## File Structure

**Crear:**

- `lib/admin/magic-token-status.ts` — helper puro derivar estado desde timestamps.
- `lib/admin/magic-token-status.test.ts` — unit tests.
- `lib/admin/parse-magic-status-filter.ts` — helper puro filtro chips.
- `lib/admin/parse-magic-status-filter.test.ts` — unit tests.
- `db/migrations/0003_magic_token_revoked_at.sql` — ALTER TABLE + índice parcial.
- `app/actions/adminMagicLinks.ts` — server actions `reenviarMagicLink` + `revocarMagicLink`.
- `app/actions/adminMagicLinks.integration.test.ts` — integration tests del action.
- `app/actions/auth.integration.test.ts` — integration tests del auto-revoke + verificarMagicLink revocado (NUEVO si no existe).
- `app/admin/magic-links/page.tsx` — server component, índice global con chips de filtro.
- `components/admin/magic-link-actions.tsx` — `'use client'`, 3 botones (reenviar email, generar URL, revocar).

**Modificar:**

- `db/schema.ts` — agregar `revoked_at` a `magic_tokens`.
- `lib/auth/contracts.ts` — extender `EmitirMagicLinkResult` con `email_contacto?: string`; añadir razón `'revocado'` a `VerificarMagicLinkOutcome`.
- `app/actions/auth.ts` — `emitirMagicLink` envuelve revoke + insert en transacción + retorna `email_contacto`; `verificarMagicLink` rechaza tokens revocados.
- `app/(auth)/acceso/expirado/page.tsx` — añadir mensaje específico para `razon=revocado`.
- `app/admin/instituciones/[id]/page.tsx` — añadir sección "Magic links" después de "Sesiones" y antes de "Histórico de perfiles".
- `app/admin/layout.tsx` — añadir nav link "Magic links" entre "Sesiones" e "Instituciones".
- `scripts/smoke_auth.ts` — ajustar tests B y D para el nuevo comportamiento auto-revoke.

**Sin cambios pero referenciados:**

- `lib/auth/admin.ts` (`isAdminAuthenticated`).
- `lib/email/resend.ts` (`sendMagicLink`).
- `lib/auth/tokens.ts` (`generateMagicToken`, `hashToken`, `magicTokenExpiry`).
- `lib/motor/test-db.ts` (patrón de integration tests).

---

## Task 0: Branch ya creado

La branch `feat/admin-paquete-2-magic-links` ya está creada y tiene el commit del spec (`6a590bf`). Ningún comando para esta task.

- [ ] **Step 1: Verificar branch correcto**

Run: `git branch --show-current`

Expected: `feat/admin-paquete-2-magic-links`

- [ ] **Step 2: Verificar working tree limpio**

Run: `git status --short`

Expected: vacío (untracked permitidos: `.tmp_design_audit/`, `.playwright-mcp/`).

---

## Task 1: Helper `magicTokenStatus` con tests

**Files:**
- Create: `lib/admin/magic-token-status.ts`
- Test: `lib/admin/magic-token-status.test.ts`

- [ ] **Step 1: Escribir el test (TDD red)**

Crear `lib/admin/magic-token-status.test.ts` con:

```ts
import { describe, it, expect } from 'vitest';
import { magicTokenStatus, VALID_MAGIC_STATUSES } from './magic-token-status';

const NOW = new Date('2026-05-08T12:00:00Z');
const PAST = new Date('2026-05-01T12:00:00Z');
const FUTURE = new Date('2026-05-15T12:00:00Z');

describe('magicTokenStatus', () => {
  it('vigente cuando no consumed/revoked y expires_at futuro', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: null, expires_at: FUTURE },
        NOW
      )
    ).toBe('vigente');
  });

  it('expirado cuando expires_at en el pasado y nada más', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: null, expires_at: PAST },
        NOW
      )
    ).toBe('expirado');
  });

  it('consumido cuando consumed_at presente', () => {
    expect(
      magicTokenStatus(
        { consumed_at: PAST, revoked_at: null, expires_at: FUTURE },
        NOW
      )
    ).toBe('consumido');
  });

  it('revocado cuando revoked_at presente y no consumido', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: PAST, expires_at: FUTURE },
        NOW
      )
    ).toBe('revocado');
  });

  it('consumido gana sobre revocado (precedencia documentada)', () => {
    expect(
      magicTokenStatus(
        { consumed_at: PAST, revoked_at: PAST, expires_at: FUTURE },
        NOW
      )
    ).toBe('consumido');
  });

  it('revocado gana sobre expirado', () => {
    expect(
      magicTokenStatus(
        { consumed_at: null, revoked_at: PAST, expires_at: PAST },
        NOW
      )
    ).toBe('revocado');
  });

  it('VALID_MAGIC_STATUSES contiene los 4 estados', () => {
    expect(VALID_MAGIC_STATUSES).toEqual([
      'vigente',
      'consumido',
      'expirado',
      'revocado',
    ]);
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `npx vitest run lib/admin/magic-token-status.test.ts`

Expected: FAIL con "Cannot find module './magic-token-status'".

- [ ] **Step 3: Implementar helper (TDD green)**

Crear `lib/admin/magic-token-status.ts` con:

```ts
// Deriva el estado de un magic_token desde sus timestamps. Sin estado mutable
// en DB para evitar drift. Precedencia: consumido > revocado > expirado >
// vigente. Razón: si ya se consumió, esa es la verdad histórica relevante;
// un revoke posterior es ruido.

export type MagicStatus = 'vigente' | 'consumido' | 'expirado' | 'revocado';

export const VALID_MAGIC_STATUSES = [
  'vigente',
  'consumido',
  'expirado',
  'revocado',
] as const satisfies readonly MagicStatus[];

interface TokenLike {
  consumed_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}

export function magicTokenStatus(
  t: TokenLike,
  now: Date = new Date()
): MagicStatus {
  if (t.consumed_at) return 'consumido';
  if (t.revoked_at) return 'revocado';
  if (t.expires_at.getTime() < now.getTime()) return 'expirado';
  return 'vigente';
}
```

- [ ] **Step 4: Correr tests (deben pasar)**

Run: `npx vitest run lib/admin/magic-token-status.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/magic-token-status.ts lib/admin/magic-token-status.test.ts
git commit -m "feat(admin): helper magicTokenStatus con unit tests"
```

---

## Task 2: Helper `parseMagicStatusFilter` con tests

**Files:**
- Create: `lib/admin/parse-magic-status-filter.ts`
- Test: `lib/admin/parse-magic-status-filter.test.ts`

- [ ] **Step 1: Escribir el test (TDD red)**

Crear `lib/admin/parse-magic-status-filter.test.ts` con:

```ts
import { describe, it, expect } from 'vitest';
import { parseMagicStatusFilter } from './parse-magic-status-filter';

const DEFAULT = ['vigente', 'consumido'];

describe('parseMagicStatusFilter', () => {
  it('undefined → default [vigente, consumido]', () => {
    expect(parseMagicStatusFilter(undefined)).toEqual(DEFAULT);
  });

  it('cadena vacía → default', () => {
    expect(parseMagicStatusFilter('')).toEqual(DEFAULT);
  });

  it('un valor válido', () => {
    expect(parseMagicStatusFilter('revocado')).toEqual(['revocado']);
  });

  it('múltiples valores válidos', () => {
    expect(parseMagicStatusFilter('vigente,expirado')).toEqual([
      'vigente',
      'expirado',
    ]);
  });

  it('filtra inválidos manteniendo válidos', () => {
    expect(parseMagicStatusFilter('garbage,vigente')).toEqual(['vigente']);
  });

  it('todo inválido → default', () => {
    expect(parseMagicStatusFilter('garbage,otro')).toEqual(DEFAULT);
  });

  it('whitespace tolerado', () => {
    expect(parseMagicStatusFilter(' vigente , revocado ')).toEqual([
      'vigente',
      'revocado',
    ]);
  });
});
```

- [ ] **Step 2: Verificar fallo**

Run: `npx vitest run lib/admin/parse-magic-status-filter.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar helper**

Crear `lib/admin/parse-magic-status-filter.ts` con:

```ts
import {
  VALID_MAGIC_STATUSES,
  type MagicStatus,
} from './magic-token-status';

const DEFAULT_FILTER: MagicStatus[] = ['vigente', 'consumido'];

export function parseMagicStatusFilter(
  raw: string | undefined
): MagicStatus[] {
  if (!raw) return DEFAULT_FILTER;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = parts.filter((s): s is MagicStatus =>
    (VALID_MAGIC_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : DEFAULT_FILTER;
}
```

- [ ] **Step 4: Correr tests**

Run: `npx vitest run lib/admin/parse-magic-status-filter.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/parse-magic-status-filter.ts lib/admin/parse-magic-status-filter.test.ts
git commit -m "feat(admin): helper parseMagicStatusFilter con unit tests"
```

---

## Task 3: Migración + schema con `revoked_at`

**Files:**
- Create: `db/migrations/0003_magic_token_revoked_at.sql`
- Modify: `db/schema.ts` (sección `magic_tokens`)

- [ ] **Step 1: Modificar `db/schema.ts`**

Localizar el bloque `export const magic_tokens = pgTable('magic_tokens', { ... })` y añadir la columna `revoked_at` justo después de `consumed_at`:

```ts
export const magic_tokens = pgTable('magic_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token_hash: text('token_hash').notNull().unique(),
  institucion_id: uuid('institucion_id')
    .references(() => instituciones.id)
    .notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumed_at: timestamp('consumed_at', { withTimezone: true }),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Crear archivo de migración SQL manual**

Drizzle Kit puede regenerar todo el snapshot; preferimos migración manual chiquita para mantener historial limpio.

Crear `db/migrations/0003_magic_token_revoked_at.sql` con:

```sql
ALTER TABLE "magic_tokens" ADD COLUMN "revoked_at" timestamp with time zone;

-- Índice parcial para acelerar la consulta "vigentes por institución" que
-- ejecuta emitirMagicLink antes de revocar previos en cada reemisión.
CREATE INDEX "magic_tokens_active_by_institucion_idx"
  ON "magic_tokens" ("institucion_id")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL;
```

- [ ] **Step 3: Aplicar migración a Neon main**

Antes de ejecutar, asegúrate de que `DATABASE_URL` apunta a `neondb` main (NO a test-integration — main debe tener el cambio para que dev sirva).

Run:

```bash
psql "$DATABASE_URL" -f db/migrations/0003_magic_token_revoked_at.sql
```

Si `psql` no está instalado, usa `neonctl`:

```bash
neonctl sql --project-id young-scene-62665535 --branch main --file db/migrations/0003_magic_token_revoked_at.sql
```

Expected: `ALTER TABLE` y `CREATE INDEX` exitosos.

- [ ] **Step 4: Aplicar migración a Neon test-integration**

```bash
neonctl sql --project-id young-scene-62665535 --branch test-integration --file db/migrations/0003_magic_token_revoked_at.sql
```

Expected: idem.

- [ ] **Step 5: Verificar tipos Drizzle compilan**

Run: `npx tsc --noEmit`

Expected: exit 0. Si falla, revisar que el orden de columnas en `db/schema.ts` no rompa otros queries que hagan select * desestructurado.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/0003_magic_token_revoked_at.sql db/schema.ts
git commit -m "feat(db): magic_tokens.revoked_at + índice parcial vigente"
```

---

## Task 4: Extender contrato `EmitirMagicLinkResult`

**Files:**
- Modify: `lib/auth/contracts.ts`

- [ ] **Step 1: Localizar la interface `EmitirMagicLinkResult`**

En `lib/auth/contracts.ts`, encontrar:

```ts
export interface EmitirMagicLinkResult {
  url: string;
  enviado: boolean;
  expires_at: Date;
}
```

- [ ] **Step 2: Añadir `email_contacto`**

Reemplazar por:

```ts
export interface EmitirMagicLinkResult {
  url: string;
  enviado: boolean;
  expires_at: Date;
  // Email al que se envió (modo email) o se hubiera enviado (dry-run).
  // Permite al caller mostrar "Enviado a contacto@x.com" sin re-query.
  email_contacto: string;
}
```

- [ ] **Step 3: Localizar la unión `VerificarMagicLinkOutcome`**

Encontrar el tipo (probablemente):

```ts
export type VerificarMagicLinkOutcome =
  | { ok: true; sesion_id: string; reanudada: boolean }
  | { ok: false; razon: 'token_invalido' | 'consumido' | 'expirado' };
```

- [ ] **Step 4: Añadir razón `'revocado'`**

Reemplazar la rama `ok: false` por:

```ts
  | { ok: false; razon: 'token_invalido' | 'consumido' | 'expirado' | 'revocado' };
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`

Expected: errores en archivos consumidores que no manejan `email_contacto` ni `'revocado'`. Esto es esperado — los próximos tasks los arreglan. Si hay otros errores no relacionados, abortar y revisar.

NOTA: NO commits aún. Este task se commitea junto con Task 5 (cambios de `auth.ts` que dependen del contrato).

---

## Task 5: `emitirMagicLink` con auto-revoke transaccional + integration tests

**Files:**
- Modify: `app/actions/auth.ts` (función `emitirMagicLink`)
- Create: `app/actions/auth.integration.test.ts`

- [ ] **Step 1: Crear el integration test (TDD red)**

Crear `app/actions/auth.integration.test.ts` (mismo patrón que `app/admin/api/search/route.integration.test.ts`):

```ts
// Integration test del auto-revoke en emitirMagicLink contra Postgres real.

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

import { eq, and, isNull } from 'drizzle-orm';
import { instituciones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { emitirMagicLink, verificarMagicLink } from './auth';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

describe('emitirMagicLink (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  skip('revoca tokens vigentes previos al emitir uno nuevo', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test@bank.example',
        cajas_aplicables: 49,
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const second = await emitirMagicLink(inst.id, { dryRun: true });

    // Solo el segundo debe estar vigente (sin revoked_at, sin consumed_at).
    const vigentes = await db
      .select({ id: magic_tokens.id, revoked_at: magic_tokens.revoked_at })
      .from(magic_tokens)
      .where(
        and(
          eq(magic_tokens.institucion_id, inst.id),
          isNull(magic_tokens.consumed_at),
          isNull(magic_tokens.revoked_at)
        )
      );
    expect(vigentes).toHaveLength(1);
    expect(first.url).not.toEqual(second.url);
  });

  skip('NO revoca tokens consumidos al emitir uno nuevo', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 2',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test2@bank.example',
        cajas_aplicables: 49,
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const tokenPlain = new URL(first.url).pathname.split('/').pop()!;
    // Consumir el primero
    const result = await verificarMagicLink(tokenPlain);
    expect(result.ok).toBe(true);

    await emitirMagicLink(inst.id, { dryRun: true });

    // El primer token debe seguir consumido (consumed_at), no revocado.
    const allTokens = await db
      .select({
        consumed_at: magic_tokens.consumed_at,
        revoked_at: magic_tokens.revoked_at,
      })
      .from(magic_tokens)
      .where(eq(magic_tokens.institucion_id, inst.id));

    const consumed = allTokens.filter((t) => t.consumed_at);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].revoked_at).toBeNull();
  });

  skip('verificarMagicLink rechaza token revocado con razon revocado', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 3',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test3@bank.example',
        cajas_aplicables: 49,
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const tokenPlain = new URL(first.url).pathname.split('/').pop()!;
    // Emitir nuevo revoca el primero
    await emitirMagicLink(inst.id, { dryRun: true });

    const result = await verificarMagicLink(tokenPlain);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.razon).toBe('revocado');
  });

  skip('emitirMagicLink retorna email_contacto', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 4',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test4@bank.example',
        cajas_aplicables: 49,
      })
      .returning({ id: instituciones.id });

    const result = await emitirMagicLink(inst.id, { dryRun: true });
    expect(result.email_contacto).toBe('test4@bank.example');
  });
});
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `npx vitest run app/actions/auth.integration.test.ts`

Expected: FAIL en al menos uno de los 4 tests (probable: el contrato sin `email_contacto` o `verificarMagicLink` no chequea `revoked_at`).

- [ ] **Step 3: Modificar `emitirMagicLink` en `app/actions/auth.ts`**

Localizar la función completa y reemplazar por:

```ts
export async function emitirMagicLink(
  institucion_id: string,
  opts: EmitirMagicLinkOptions = {}
): Promise<EmitirMagicLinkResult> {
  const [inst] = await db
    .select({
      id: instituciones.id,
      razon_social: instituciones.razon_social,
      email_contacto: instituciones.email_contacto,
    })
    .from(instituciones)
    .where(eq(instituciones.id, institucion_id))
    .limit(1);
  if (!inst) throw new Error(`institucion_id ${institucion_id} no encontrada`);

  const plain = generateMagicToken();
  const token_hash = hashToken(plain);
  const expires_at = magicTokenExpiry();

  // Auto-revoke + insert atómico. Cualquier token previo no consumido y no
  // revocado para esta institución queda revocado en el mismo statement antes
  // de insertar el nuevo. Garantiza la invariante "máximo un token vigente
  // por institución" que asume `verificarMagicLink` y la UI admin.
  await db.transaction(async (tx) => {
    await tx
      .update(magic_tokens)
      .set({ revoked_at: new Date() })
      .where(
        and(
          eq(magic_tokens.institucion_id, institucion_id),
          isNull(magic_tokens.consumed_at),
          isNull(magic_tokens.revoked_at)
        )
      );
    await tx.insert(magic_tokens).values({
      token_hash,
      institucion_id,
      expires_at,
    });
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/acceso/${plain}`;

  if (opts.dryRun) {
    return { url, enviado: false, expires_at, email_contacto: inst.email_contacto };
  }

  await sendMagicLink({
    to: inst.email_contacto,
    url,
    razon_social: inst.razon_social,
    expiresAt: expires_at,
  });
  return { url, enviado: true, expires_at, email_contacto: inst.email_contacto };
}
```

- [ ] **Step 4: Asegurar imports**

En el header de `app/actions/auth.ts` debe haber `and, eq, isNull` desde drizzle. Si falta `isNull`:

```ts
import { eq, and, isNull } from 'drizzle-orm';
```

- [ ] **Step 5: Modificar `verificarMagicLink` (chequeo revoked)**

Localizar el bloque:

```ts
if (!row) return { ok: false, razon: 'token_invalido' };
if (row.consumed_at) return { ok: false, razon: 'consumido' };
if (row.expires_at.getTime() < Date.now()) return { ok: false, razon: 'expirado' };
```

Y reemplazar por:

```ts
if (!row) return { ok: false, razon: 'token_invalido' };
if (row.consumed_at) return { ok: false, razon: 'consumido' };
if (row.revoked_at) return { ok: false, razon: 'revocado' };
if (row.expires_at.getTime() < Date.now()) return { ok: false, razon: 'expirado' };
```

Y el `select(...)` arriba debe incluir `revoked_at: magic_tokens.revoked_at,` para que la columna esté disponible.

- [ ] **Step 6: Correr tests integration**

Run: `npx vitest run app/actions/auth.integration.test.ts`

Expected: PASS, 4 tests (o skipped si `DATABASE_URL_TEST` no está).

- [ ] **Step 7: Correr typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 8: Commit (Task 4 + 5 juntos)**

```bash
git add lib/auth/contracts.ts app/actions/auth.ts app/actions/auth.integration.test.ts
git commit -m "feat(auth): magic_tokens.revoked_at + auto-revoke en emitir + check en verificar"
```

---

## Task 6: Mensaje específico para `razon=revocado` en `/acceso/expirado`

**Files:**
- Modify: `app/(auth)/acceso/expirado/page.tsx`

- [ ] **Step 1: Añadir entrada al diccionario MENSAJES**

Localizar el bloque `const MENSAJES: Record<string, string> = { ... }` y añadir:

```ts
const MENSAJES: Record<string, string> = {
  token_invalido: 'No reconocemos ese enlace. Probablemente está incompleto o ya fue revocado.',
  expirado: 'Tu enlace de acceso expiró. Vértice los emite con vigencia de 7 días.',
  consumido: 'Este enlace ya fue usado. Por seguridad sólo funciona una vez.',
  revocado: 'Este enlace fue revocado por el equipo Vértice. Solicita uno nuevo a tu contacto.',
  institucion_no_encontrada: 'No encontramos la institución asociada a este enlace.',
  sin_sesion: 'No tienes una sesión activa. Pide un enlace nuevo para iniciar.',
};
```

- [ ] **Step 2: Verificar que el page usa el diccionario sin cambios**

El cuerpo de la función ya hace `(razon && MENSAJES[razon]) ?? fallback` — no requiere otro cambio.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/acceso/expirado/page.tsx"
git commit -m "feat(auth): mensaje específico para razon=revocado en /acceso/expirado"
```

---

## Task 7: Server action `revocarMagicLink` con integration test

**Files:**
- Create: `app/actions/adminMagicLinks.ts`
- Create: `app/actions/adminMagicLinks.integration.test.ts`

- [ ] **Step 1: Escribir el test (TDD red, sólo revoke por ahora)**

Crear `app/actions/adminMagicLinks.integration.test.ts`:

```ts
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

const authMock = vi.hoisted(() => ({ authenticated: true }));
vi.mock('@/lib/auth/admin', () => ({
  isAdminAuthenticated: async () => authMock.authenticated,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { eq } from 'drizzle-orm';
import { instituciones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { emitirMagicLink } from './auth';
import { revocarMagicLink, reenviarMagicLink } from './adminMagicLinks';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

async function seedInstWithLink(suffix: string): Promise<{ inst_id: string; token_id: string }> {
  if (!db) throw new Error('no test db');
  const [inst] = await db
    .insert(instituciones)
    .values({
      razon_social: `Test Bank ${suffix}`,
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: `test${suffix}@bank.example`,
      cajas_aplicables: 49,
    })
    .returning({ id: instituciones.id });
  await emitirMagicLink(inst.id, { dryRun: true });
  const [t] = await db
    .select({ id: magic_tokens.id })
    .from(magic_tokens)
    .where(eq(magic_tokens.institucion_id, inst.id))
    .limit(1);
  return { inst_id: inst.id, token_id: t.id };
}

describe('adminMagicLinks (integration)', () => {
  beforeEach(async () => {
    authMock.authenticated = true;
    if (db) await resetReviewTables(db);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  describe('revocarMagicLink', () => {
    skip('revoca un token vigente', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('A');
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(true);
      const [row] = await db
        .select({ revoked_at: magic_tokens.revoked_at })
        .from(magic_tokens)
        .where(eq(magic_tokens.id, token_id));
      expect(row.revoked_at).toBeInstanceOf(Date);
    });

    skip('falla con token inexistente', async () => {
      const result = await revocarMagicLink('00000000-0000-0000-0000-000000000000');
      expect(result.ok).toBe(false);
    });

    skip('falla con token ya revocado (idempotencia inversa)', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('B');
      await revocarMagicLink(token_id);
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(false);
    });

    skip('falla sin auth', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('C');
      authMock.authenticated = false;
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(false);
    });
  });

  describe('reenviarMagicLink', () => {
    skip('modo dry_run con auth devuelve URL y revoca previos', async () => {
      if (!db) return;
      const { inst_id, token_id: prev } = await seedInstWithLink('D');
      const result = await reenviarMagicLink(inst_id, 'dry_run');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.magic_url).toMatch(/^http.*\/acceso\//);
      const [prevRow] = await db
        .select({ revoked_at: magic_tokens.revoked_at })
        .from(magic_tokens)
        .where(eq(magic_tokens.id, prev));
      expect(prevRow.revoked_at).toBeInstanceOf(Date);
    });

    skip('modo email sin RESEND_API_KEY → ok:false con mensaje accionable', async () => {
      if (!db) return;
      const prevKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;
      try {
        const { inst_id } = await seedInstWithLink('E');
        const result = await reenviarMagicLink(inst_id, 'email');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/RESEND_API_KEY/);
      } finally {
        if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
      }
    });

    skip('falla sin auth', async () => {
      if (!db) return;
      const { inst_id } = await seedInstWithLink('F');
      authMock.authenticated = false;
      const result = await reenviarMagicLink(inst_id, 'dry_run');
      expect(result.ok).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Verificar fallo (módulo no existe)**

Run: `npx vitest run app/actions/adminMagicLinks.integration.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar `app/actions/adminMagicLinks.ts`**

Crear archivo:

```ts
'use server';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { magic_tokens } from '@/db/schema';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { emitirMagicLink } from './auth';

export type ReenviarMode = 'email' | 'dry_run';

export type ReenviarResult =
  | {
      ok: true;
      mode: ReenviarMode;
      magic_url: string;
      expires_at: string;
      sent_to?: string;
    }
  | { ok: false; error: string };

export async function reenviarMagicLink(
  institucion_id: string,
  mode: ReenviarMode
): Promise<ReenviarResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }

  // Fail-fast en modo email si Resend no está configurado. NO degradamos
  // a dry-run silente para evitar que el admin asuma que el correo salió.
  if (mode === 'email' && !process.env.RESEND_API_KEY) {
    return {
      ok: false,
      error:
        'RESEND_API_KEY no configurada. Usa "Generar URL" para copiar manualmente mientras tanto.',
    };
  }

  try {
    const link = await emitirMagicLink(institucion_id, {
      dryRun: mode === 'dry_run',
    });
    revalidatePath(`/admin/instituciones/${institucion_id}`);
    revalidatePath('/admin/magic-links');
    return {
      ok: true,
      mode,
      magic_url: link.url,
      expires_at: link.expires_at.toISOString(),
      sent_to: link.enviado ? link.email_contacto : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al reemitir.',
    };
  }
}

export type RevocarResult = { ok: true } | { ok: false; error: string };

export async function revocarMagicLink(
  token_id: string
): Promise<RevocarResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }

  // UPDATE atómico: solo si está vigente (no consumido, no revocado, no
  // expirado). Si el token ya cambió de estado entre render y click,
  // `returning()` queda vacío y devolvemos error de race.
  const updated = await db
    .update(magic_tokens)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(magic_tokens.id, token_id),
        isNull(magic_tokens.consumed_at),
        isNull(magic_tokens.revoked_at),
        gt(magic_tokens.expires_at, new Date())
      )
    )
    .returning({ institucion_id: magic_tokens.institucion_id });

  if (updated.length === 0) {
    return {
      ok: false,
      error: 'Token no revocable (consumido, expirado o ya revocado).',
    };
  }

  revalidatePath(`/admin/instituciones/${updated[0].institucion_id}`);
  revalidatePath('/admin/magic-links');
  return { ok: true };
}
```

- [ ] **Step 4: Correr tests integration**

Run: `npx vitest run app/actions/adminMagicLinks.integration.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/actions/adminMagicLinks.ts app/actions/adminMagicLinks.integration.test.ts
git commit -m "feat(admin): server actions reenviar/revocar magic link + integration tests"
```

---

## Task 8: Client component `<MagicLinkActions>`

**Files:**
- Create: `components/admin/magic-link-actions.tsx`

Tres sub-componentes en un archivo: `<ReenviarPorCorreoButton>`, `<GenerarUrlButton>`, `<RevocarButton>`.

- [ ] **Step 1: Crear el archivo**

Crear `components/admin/magic-link-actions.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Mail, Link2, Ban, Copy, Check } from 'lucide-react';
import {
  reenviarMagicLink,
  revocarMagicLink,
  type ReenviarMode,
} from '@/app/actions/adminMagicLinks';

// ---- ReenviarPorCorreoButton ----------------------------------------------

export function ReenviarPorCorreoButton({
  institucion_id,
}: {
  institucion_id: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setFeedback(null);
          setError(null);
          startTransition(async () => {
            const result = await reenviarMagicLink(institucion_id, 'email');
            if (result.ok) {
              setFeedback(`Enviado a ${result.sent_to ?? 'el contacto registrado'}.`);
            } else {
              setError(result.error);
            }
          });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-forest-soft disabled:opacity-50"
      >
        <Mail className="size-3.5" />
        {pending ? 'Enviando…' : 'Reenviar por correo'}
      </button>
      {feedback && (
        <p className="text-xs text-forest">{feedback}</p>
      )}
      {error && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200/70">
          {error}
        </p>
      )}
    </div>
  );
}

// ---- GenerarUrlButton -----------------------------------------------------

export function GenerarUrlButton({
  institucion_id,
}: {
  institucion_id: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setUrl(null);
          setError(null);
          startTransition(async () => {
            const result = await reenviarMagicLink(institucion_id, 'dry_run');
            if (result.ok) setUrl(result.magic_url);
            else setError(result.error);
          });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-xs font-medium text-foreground ring-1 ring-foreground/10 transition hover:bg-foreground/5 disabled:opacity-50"
      >
        <Link2 className="size-3.5" />
        {pending ? 'Generando…' : 'Generar URL'}
      </button>
      {url && (
        <div className="flex items-center gap-2 rounded-lg bg-foreground/5 p-2">
          <code className="flex-1 truncate font-mono text-[11px] text-foreground/80">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-primary-foreground transition hover:bg-foreground/85"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200/70">
          {error}
        </p>
      )}
    </div>
  );
}

// ---- RevocarButton --------------------------------------------------------

export function RevocarButton({ token_id }: { token_id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('¿Revocar este token? Esta acción no se puede deshacer.')) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await revocarMagicLink(token_id);
            if (!result.ok) setError(result.error);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[10px] font-medium text-foreground/70 ring-1 ring-foreground/10 transition hover:bg-amber-50 hover:text-amber-900 hover:ring-amber-200/70 disabled:opacity-50"
      >
        <Ban className="size-3" />
        {pending ? 'Revocando…' : 'Revocar'}
      </button>
      {error && <p className="text-[10px] text-amber-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/admin/magic-link-actions.tsx
git commit -m "feat(admin): client island MagicLinkActions con 3 sub-componentes"
```

---

## Task 9: Sección "Magic links" en `/admin/instituciones/[id]/page.tsx`

**Files:**
- Modify: `app/admin/instituciones/[id]/page.tsx`

- [ ] **Step 1: Añadir query de magic_tokens al `Promise.all`**

Localizar el `Promise.all([...])` en el page. Añadir una nueva query para magic tokens de esa institución:

```ts
db.select({
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
```

Capturar el resultado en una variable `magicLinks`.

Asegurar el import al top del archivo:

```ts
import { magic_tokens } from '@/db/schema';
import { magicTokenStatus } from '@/lib/admin/magic-token-status';
import {
  ReenviarPorCorreoButton,
  GenerarUrlButton,
  RevocarButton,
} from '@/components/admin/magic-link-actions';
```

- [ ] **Step 2: Localizar dónde insertar la sección**

Buscar la sección actual "Histórico de perfiles" (renombrada en paquete 1). La sección "Magic links" va INMEDIATAMENTE ANTES de "Histórico de perfiles" y DESPUÉS de "Sesiones".

- [ ] **Step 3: Insertar el JSX**

Antes de la `<section>` de "Histórico de perfiles", añadir:

```tsx
<section className="rounded-3xl bg-cream p-1 shadow-sm ring-1 ring-foreground/5">
  <div className="flex items-center justify-between px-5 py-4">
    <h2 className="text-sm font-semibold tracking-tight text-foreground">
      Magic links ({magicLinks.length})
    </h2>
    <div className="flex items-center gap-2">
      <ReenviarPorCorreoButton institucion_id={id} />
      <GenerarUrlButton institucion_id={id} />
    </div>
  </div>
  {magicLinks.length === 0 ? (
    <div className="rounded-2xl bg-background/30 px-6 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        Aún no se ha emitido ningún magic link para esta institución.
      </p>
    </div>
  ) : (
    <table className="w-full text-sm">
      <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <tr>
          <th scope="col" className="px-5 py-3">Status</th>
          <th scope="col" className="px-5 py-3">Creado</th>
          <th scope="col" className="px-5 py-3">Expira</th>
          <th scope="col" className="px-5 py-3">Consumido / Revocado</th>
          <th scope="col" className="px-5 py-3 text-right" aria-label="Acciones" />
        </tr>
      </thead>
      <tbody className="divide-y divide-foreground/5">
        {magicLinks.map((m) => {
          const status = magicTokenStatus(m);
          return (
            <tr key={m.id}>
              <td className="px-5 py-3">
                <MagicStatusPill status={status} />
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground">
                {formatRelative(m.created_at)}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground">
                {formatRelative(m.expires_at)}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground">
                {m.consumed_at
                  ? `consumido ${formatRelative(m.consumed_at)}`
                  : m.revoked_at
                    ? `revocado ${formatRelative(m.revoked_at)}`
                    : '—'}
              </td>
              <td className="px-5 py-3 text-right">
                {status === 'vigente' && <RevocarButton token_id={m.id} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  )}
</section>
```

- [ ] **Step 4: Añadir el helper `<MagicStatusPill>` dentro del archivo**

Al final del archivo, justo antes del último `}` (a nivel de módulo), añadir:

```tsx
const MAGIC_STATUS_STYLE: Record<string, string> = {
  vigente: 'bg-lime/30 text-lime-foreground ring-lime/40',
  consumido: 'bg-forest text-primary-foreground ring-forest',
  expirado: 'bg-amber-100 text-amber-900 ring-amber-200',
  revocado: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function MagicStatusPill({ status }: { status: string }) {
  const cls = MAGIC_STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/admin/instituciones/[id]/page.tsx
git commit -m "feat(admin): sección Magic links en /admin/instituciones/[id]"
```

---

## Task 10: Página global `/admin/magic-links` + nav link

**Files:**
- Create: `app/admin/magic-links/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Añadir nav link en layout**

En `app/admin/layout.tsx`, localizar el bloque de NavLinks y añadir "Magic links" entre "Sesiones" e "Instituciones":

```tsx
<NavLink href="/admin">Resumen</NavLink>
<NavLink href="/admin/sesiones">Sesiones</NavLink>
<NavLink href="/admin/magic-links">Magic links</NavLink>
<NavLink href="/admin/instituciones">Instituciones</NavLink>
<NavLink href="/admin/instituciones/nueva">
  Nueva institución
</NavLink>
```

- [ ] **Step 2: Crear el page**

Crear `app/admin/magic-links/page.tsx`:

```tsx
// Índice global de magic links cross-institución. Filtros chips por status
// (vigente/consumido/expirado/revocado), default operativo vigente+consumido.

import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { magic_tokens, instituciones } from '@/db/schema';
import { formatRelative } from '@/lib/utils';
import {
  parseMagicStatusFilter,
} from '@/lib/admin/parse-magic-status-filter';
import {
  magicTokenStatus,
  VALID_MAGIC_STATUSES,
  type MagicStatus,
} from '@/lib/admin/magic-token-status';

export const dynamic = 'force-dynamic';

const HARD_LIMIT = 500;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminMagicLinksIndexPage({
  searchParams,
}: Props) {
  const { status } = await searchParams;
  const activeStatuses = parseMagicStatusFilter(status);

  // Pull all rows (cap silencioso 500), filtramos en memoria por status
  // derivado. No podemos filtrar en SQL porque "expirado" depende de NOW()
  // y mezcla fácilmente con "vigente" según el momento del query.
  const allRows = await db
    .select({
      id: magic_tokens.id,
      institucion_id: magic_tokens.institucion_id,
      razon_social: instituciones.razon_social,
      created_at: magic_tokens.created_at,
      expires_at: magic_tokens.expires_at,
      consumed_at: magic_tokens.consumed_at,
      revoked_at: magic_tokens.revoked_at,
    })
    .from(magic_tokens)
    .innerJoin(instituciones, eq(magic_tokens.institucion_id, instituciones.id))
    .orderBy(desc(magic_tokens.created_at))
    .limit(HARD_LIMIT + 1);

  const truncated = allRows.length > HARD_LIMIT;
  const filtered = (truncated ? allRows.slice(0, HARD_LIMIT) : allRows).filter(
    (r) =>
      activeStatuses.includes(magicTokenStatus(r))
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Operativo
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Magic links
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'visible' : 'visibles'}
          {truncated && ` (mostrando primeras ${HARD_LIMIT}, refina filtros)`}
        </p>
      </header>

      <FilterChips active={activeStatuses} />

      {filtered.length === 0 ? (
        <EmptyState isExplicitFilter={status !== undefined} />
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-foreground/5">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3">Institución</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Creado</th>
                <th scope="col" className="px-5 py-3">Expira</th>
                <th scope="col" className="px-5 py-3">Consumido / Revocado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {filtered.map((m) => {
                const s = magicTokenStatus(m);
                return (
                  <tr key={m.id} className="transition hover:bg-foreground/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/instituciones/${m.institucion_id}`}
                        className="font-medium text-foreground hover:text-forest hover:underline"
                      >
                        {m.razon_social}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <MagicStatusPill status={s} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(m.created_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatRelative(m.expires_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {m.consumed_at
                        ? `consumido ${formatRelative(m.consumed_at)}`
                        : m.revoked_at
                          ? `revocado ${formatRelative(m.revoked_at)}`
                          : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChips({ active }: { active: MagicStatus[] }) {
  const activeSet = new Set(active);
  const isDefault =
    activeSet.size === 2 && activeSet.has('vigente') && activeSet.has('consumido');
  return (
    <div className="flex flex-wrap gap-2">
      <ChipLink href="/admin/magic-links" active={isDefault}>
        Default (operativos)
      </ChipLink>
      {VALID_MAGIC_STATUSES.map((s) => {
        const isActive = activeSet.has(s);
        const next = isActive
          ? activeSet.size === 1
            ? null
            : Array.from(activeSet).filter((x) => x !== s)
          : [...active, s];
        const href =
          next === null
            ? '/admin/magic-links'
            : `/admin/magic-links?status=${next.join(',')}`;
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

function EmptyState({ isExplicitFilter }: { isExplicitFilter: boolean }) {
  return (
    <div className="rounded-3xl bg-cream p-10 text-center shadow-sm ring-1 ring-foreground/5">
      <p className="text-sm text-muted-foreground">
        {isExplicitFilter
          ? 'Sin magic links con estos filtros.'
          : 'Aún no hay magic links emitidos.'}
      </p>
      {isExplicitFilter && (
        <Link
          href="/admin/magic-links"
          className="mt-3 inline-block text-xs font-medium text-forest hover:underline"
        >
          Ver todos
        </Link>
      )}
    </div>
  );
}

const MAGIC_STATUS_STYLE: Record<string, string> = {
  vigente: 'bg-lime/30 text-lime-foreground ring-lime/40',
  consumido: 'bg-forest text-primary-foreground ring-forest',
  expirado: 'bg-amber-100 text-amber-900 ring-amber-200',
  revocado: 'bg-foreground/8 text-muted-foreground ring-foreground/15',
};

function MagicStatusPill({ status }: { status: string }) {
  const cls =
    MAGIC_STATUS_STYLE[status] ?? 'bg-muted text-foreground ring-foreground/15';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/admin/magic-links/page.tsx app/admin/layout.tsx
git commit -m "feat(admin): índice global /admin/magic-links con chips de filtro"
```

---

## Task 11: Ajustar `scripts/smoke_auth.ts`

**Files:**
- Modify: `scripts/smoke_auth.ts`

El smoke re-emite tokens para la misma institución en tests B y D. Tras este paquete, B queda revocado al emitir D. Necesitamos validar el nuevo comportamiento explícitamente.

- [ ] **Step 1: Localizar el bloque de Test D**

Buscar en `scripts/smoke_auth.ts` el bloque que arranca con `// ---------- Test D: expirado ---`.

- [ ] **Step 2: Confirmar que la verificación de B (consumo) ocurre ANTES de Test D**

Test C debería haber consumido tokenB. Si no es así, ajustar el orden para que B sea consumido antes de D. Si Test C no consume B, debe insertarse un consumo explícito antes de D, e.g.:

```ts
// (Si Test C no consumió B explícitamente, hacerlo aquí.)
// const _ = await verificarMagicLink(tokenB);
```

- [ ] **Step 3: Añadir nuevo Test E que valida auto-revoke**

Después del Test D, añadir:

```ts
// ---------- Test E: auto-revoke en reemisión ------------------------------
// Emitimos tokenE1, luego tokenE2; tokenE1 debe quedar revocado y verificar
// debe devolver razon='revocado'.
const emitE1 = await emitirMagicLink(institucion_id, { dryRun: true });
const tokenE1 = new URL(emitE1.url).pathname.split('/').pop()!;
await emitirMagicLink(institucion_id, { dryRun: true }); // E2: revoca E1
const verifyE1 = await verificarMagicLink(tokenE1);
console.log(`\n[E] verificar tokenE1 tras E2: ${JSON.stringify(verifyE1)}`);
if (verifyE1.ok) throw new Error('[E] Esperaba ok=false, recibí ok=true');
if (!verifyE1.ok && verifyE1.razon !== 'revocado') {
  throw new Error(`[E] Esperaba razon=revocado, recibí ${verifyE1.razon}`);
}
console.log('[E] OK — tokenE1 revocado correctamente.');
```

- [ ] **Step 4: Correr el smoke (dry, sin tocar prod data)**

Asegurar que `DATABASE_URL` apunta a Neon main de DEV (no a una branch productiva). Luego:

```bash
npx tsx scripts/smoke_auth.ts
```

Expected: todos los tests A→E imprimen "OK".

NOTA: el smoke modifica DB. Si esto no es seguro de correr ahora, este step se puede diferir hasta antes del PR — pero el commit del cambio sí va.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke_auth.ts
git commit -m "test(scripts): smoke_auth Test E valida auto-revoke en reemisión"
```

---

## Task 12: Typecheck + tests + E2E manual + PR

**Files:** ninguno modificado en este task; sólo verificación.

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 2: Suite de unit + integration tests**

Run: `npx vitest run lib/admin app/actions`

Expected: PASS — todos los tests del paquete (4 nuevos archivos) + tests pre-existentes que toquen estos paths.

- [ ] **Step 3: Levantar dev server**

```bash
npm run dev
```

Expected: `Ready in <2s`, server en `http://localhost:3000`.

- [ ] **Step 4: E2E manual con Playwright (7 pasos del spec)**

1. Login admin: `/admin/login` → token → redirige a `/admin`.
2. Navegar a `/admin/instituciones/[id]` (cualquier institución existente). Verificar sección "Magic links" presente con tabla.
3. Click "Generar URL" → banner aparece con URL + botón Copiar. Tabla actualiza: previo (si lo había) en `revocado`, nuevo en `vigente`.
4. Click "Reenviar por correo" sin RESEND_API_KEY → banner de error con mensaje accionable.
5. Click "Revocar" en token vigente → confirm dialog → status pasa a `revocado`.
6. Navegar a `/admin/magic-links` → tabla cross-institución. Chips de filtro togglean. Default `vigente + consumido`.
7. Visitar `/acceso/<token-revocado>` → redirige a `/acceso/expirado?razon=revocado` con mensaje específico.

Si todo verde, continuar. Si no, debugear y arreglar antes del PR.

- [ ] **Step 5: Push branch**

```bash
git push -u origin feat/admin-paquete-2-magic-links
```

- [ ] **Step 6: Crear PR**

Run:

```bash
gh pr create --base master --head feat/admin-paquete-2-magic-links --title "Admin paquete 2: gestión de magic links (reenviar/revocar/historial)" --body "$(cat <<'EOF'
## Summary

- **Paquete admin 2 — gestión de magic links** completo según spec `docs/superpowers/specs/2026-05-08-admin-panel-paquete-2-magic-links-design.md`.
- **Schema:** `magic_tokens.revoked_at` + índice parcial vigente.
- **Auto-revoke transaccional** en `emitirMagicLink` — máximo un token vigente por institución.
- **Server actions:** `reenviarMagicLink` (modo email + dry-run) y `revocarMagicLink` (manual).
- **UI:** sección "Magic links" en `/admin/instituciones/[id]` + índice global `/admin/magic-links` con chips de filtro.

## Test plan

- [x] Unit tests: `magicTokenStatus`, `parseMagicStatusFilter`
- [x] Integration tests: `emitirMagicLink` (auto-revoke + email_contacto), `verificarMagicLink` (razon=revocado), `revocarMagicLink`, `reenviarMagicLink`
- [x] Typecheck: `tsc --noEmit` exit 0
- [x] E2E manual con Playwright (7 pasos del spec)
- [x] `scripts/smoke_auth.ts` ajustado y verde

## Notas

- Email path requiere `RESEND_API_KEY` en `.env.local`. Sin ella, el modo email devuelve `{ok:false}` con mensaje accionable; modo dry-run sigue funcionando.
- Comportamiento de `emitirMagicLink` cambió: ahora revoca previos no consumidos. `scripts/invitar.ts` no se afecta (institución nueva no tiene previos). Smoke `scripts/smoke_auth.ts` ajustado para validar el nuevo comportamiento.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL del PR.

---

## Self-Review (al finalizar el plan, antes de ejecutar)

- [ ] **Spec coverage:** cada requisito del spec mapeado a un task.
- [ ] **Type consistency:** tipos compartidos (`MagicStatus`, `ReenviarMode`, etc.) coinciden entre tasks.
- [ ] **Migración aplicada en main + test-integration** antes de correr integration tests.
- [ ] **Sin placeholders:** ningún paso dice "TODO" o "implement later".

## Convención de commits final

El plan produce 9 commits + 1 PR (más el commit del spec ya hecho `6a590bf`):

1. `feat(admin): helper magicTokenStatus con unit tests`
2. `feat(admin): helper parseMagicStatusFilter con unit tests`
3. `feat(db): magic_tokens.revoked_at + índice parcial vigente`
4. `feat(auth): magic_tokens.revoked_at + auto-revoke en emitir + check en verificar`
5. `feat(auth): mensaje específico para razon=revocado en /acceso/expirado`
6. `feat(admin): server actions reenviar/revocar magic link + integration tests`
7. `feat(admin): client island MagicLinkActions con 3 sub-componentes`
8. `feat(admin): sección Magic links en /admin/instituciones/[id]`
9. `feat(admin): índice global /admin/magic-links con chips de filtro`
10. `test(scripts): smoke_auth Test E valida auto-revoke en reemisión`

Más granular que los 4 commits del spec; agrupar al final con merge commit del PR conserva el historial detallado.
