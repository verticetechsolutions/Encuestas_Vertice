# Admin panel — Paquete 2: Gestión de magic links

**Fecha:** 2026-05-08
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Owner:** Opsyo

## Contexto

Hoy `magic_tokens` se emite de dos maneras:

- Al crear una institución vía `/admin/instituciones/nueva` (server action `crearInstitucionConLink`, modo `dryRun: true` — el admin copia la URL).
- Vía script CLI `scripts/invitar.ts`.

No existe forma de regenerar un link vencido, ni de invalidar un token comprometido, ni de ver qué tokens se emitieron históricamente para una institución. El único feedback es la URL que devuelve el form de creación; tras cerrar la página, esa URL se pierde.

El comentario en `app/actions/auth.ts:18` documenta una decisión deliberada: "no invalidamos al reemitir para evitar race con correos en tránsito". Esa decisión tenía sentido cuando emisión = creación de institución. Ahora que admin va a re-emitir activamente, la coexistencia de N tokens vigentes deja de ser defensa y se vuelve confusión.

Este spec cubre el **Paquete 2 — Gestión de magic links**: reenviar (con auto-revoke de previos), revocar manualmente uno específico, y ver el histórico filtrado por estado.

Los Paquetes 1 (visibilidad core) y 3 (analytics + audit log) tienen sus propios specs.

## Scope

**Dentro:**

- Schema: añadir `magic_tokens.revoked_at` (timestamptz nullable) vía migración Drizzle.
- Comportamiento: `emitirMagicLink` revoca tokens previos no consumidos / no expirados / no revocados de la misma institución antes de insertar el nuevo. `verificarMagicLink` rechaza tokens con `revoked_at != NULL` (razón: `revocado`).
- Server actions admin: `reenviarMagicLink(institucion_id, mode)` y `revocarMagicLink(token_id)`.
- UI per-institución: sección "Magic links" en `/admin/instituciones/[id]` con tabla histórica + chips de filtro + botones reenviar / revocar.
- UI global: `/admin/magic-links` con tabla cross-institución, chips de filtro por estado, default `vigente + consumido`.
- Helper puro `magicTokenStatus` + tests unit + integration.
- Soporte modo email (Resend) y modo dry-run (copy URL) en reenviar.

**Fuera:**

- Audit log / timeline de actividad admin (Paquete 3).
- Edición del email_contacto desde la UI de magic links (existe en otro flujo).
- Re-emitir a un email distinto del registrado en `instituciones.email_contacto`.
- Self-service para el entrevistado (siempre admin-driven).
- Paginación con cursor (cap silencioso 500 igual que paquete 1).
- Dashboard de métricas (cuántos consumidos/revocados por semana, etc.).

## Arquitectura

Mismo patrón que el resto del admin: **React Server Components** para data, **client islands** sólo donde se necesita interacción real (botones con confirmación, copy-to-clipboard). Filtros viven en URL params. Queries Drizzle directas en `page.tsx`. Páginas marcadas `force-dynamic`.

### Rutas y archivos

```
app/admin/
  magic-links/
    page.tsx                          ← NUEVO  índice global
  instituciones/[id]/page.tsx         ← MOD    sección "Magic links"

app/actions/
  adminMagicLinks.ts                  ← NUEVO  reenviar + revocar
  auth.ts                             ← MOD    emitirMagicLink + verificarMagicLink

components/admin/
  magic-link-actions.tsx              ← NUEVO  client island con confirm + clipboard

lib/admin/
  magic-token-status.ts               ← NUEVO  helper puro
  magic-token-status.test.ts          ← NUEVO  unit tests
  parse-magic-status-filter.ts        ← NUEVO  helper puro filtro chips
  parse-magic-status-filter.test.ts   ← NUEVO  unit tests

lib/auth/
  contracts.ts                        ← MOD    types nuevos para revocación

db/migrations/
  0003_magic_token_revoked_at.sql     ← NUEVO  ALTER TABLE
```

## Schema migration

```sql
-- 0003_magic_token_revoked_at.sql
ALTER TABLE magic_tokens
  ADD COLUMN revoked_at timestamptz;

-- Índice parcial para acelerar el lookup "vigentes por institución" que
-- ejecuta emitirMagicLink antes de cada inserción.
CREATE INDEX magic_tokens_active_by_institucion_idx
  ON magic_tokens (institucion_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
```

Backfill: ninguno. Filas existentes quedan con `revoked_at = NULL` (nunca revocadas), comportamiento deseado.

`db/schema.ts` añade `revoked_at: timestamp('revoked_at', { withTimezone: true })`.

## Componentes y responsabilidades

### `lib/admin/magic-token-status.ts` (helper puro)

```ts
export type MagicStatus = 'vigente' | 'consumido' | 'expirado' | 'revocado';

export const VALID_MAGIC_STATUSES = [
  'vigente',
  'consumido',
  'expirado',
  'revocado',
] as const;

interface TokenLike {
  consumed_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}

export function magicTokenStatus(t: TokenLike, now: Date = new Date()): MagicStatus {
  if (t.consumed_at) return 'consumido';
  if (t.revoked_at) return 'revocado';
  if (t.expires_at.getTime() < now.getTime()) return 'expirado';
  return 'vigente';
}
```

Orden de evaluación deliberado: `consumido` gana sobre `revocado` ganaría sobre `expirado` ganaría sobre `vigente`. Razón: si un token ya se consumió, esa es la verdad histórica más relevante (un revoke posterior es ruido). Si nunca se consumió pero se revocó, mostramos revocado (útil para auditoría). Solo si no se consumió ni revocó miramos expiración.

### `lib/admin/parse-magic-status-filter.ts` (helper puro)

Idéntico patrón a `parse-status-filter.ts` del paquete 1.

```ts
export function parseMagicStatusFilter(raw: string | undefined): MagicStatus[] {
  if (!raw) return ['vigente', 'consumido']; // default operativo
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const valid = parts.filter((s): s is MagicStatus =>
    (VALID_MAGIC_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : ['vigente', 'consumido'];
}
```

Default = `vigente + consumido` porque son los estados accionables: vigente para revocar/seguir uso, consumido para confirmar que entró. Expirado/revocado son histórico que la mayor parte del tiempo no necesitas ver.

### `app/actions/auth.ts` (modificación de emitirMagicLink)

```ts
// Wrapping en transacción Drizzle para garantizar atomicidad de revoke + insert.
export async function emitirMagicLink(institucion_id, opts) {
  const [inst] = ... // sin cambios

  const plain = generateMagicToken();
  const token_hash = hashToken(plain);
  const expires_at = magicTokenExpiry();

  await db.transaction(async (tx) => {
    // Auto-revoke de previos no terminales para esta institución.
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

  // resto idéntico (dry-run vs send email)
}
```

Nota: el comentario de "race con correos en tránsito" se actualiza en el código. La justificación nueva: admin maneja explícitamente; un correo en tránsito con un token revocado debe fallar, eso es la intención.

### `app/actions/auth.ts` (modificación de verificarMagicLink)

Añade chequeo `revoked_at IS NULL` antes de aceptar. Outcome nuevo: `razon: 'revocado'`.

```ts
if (row.revoked_at) return { ok: false, razon: 'revocado' };
```

`/acceso/expirado` (página entrevistado) recibe `?razon=revocado` y muestra mensaje "Este enlace fue revocado por el equipo Vértice. Solicita uno nuevo." (vs el genérico actual). El `decodeMessage` en esa página ya tiene patrón switch — añadir caso.

### `app/actions/adminMagicLinks.ts` (server actions)

```ts
'use server';

type ReenviarMode = 'email' | 'dry_run';

export type ReenviarResult =
  | { ok: true; mode: ReenviarMode; magic_url: string; expires_at: string; sent_to?: string }
  | { ok: false; error: string };

export async function reenviarMagicLink(
  institucion_id: string,
  mode: ReenviarMode
): Promise<ReenviarResult> {
  if (!(await isAdminAuthenticated())) return { ok: false, error: 'No autorizado.' };

  // Validación de modo email: si Resend no está configurado, fail-fast con
  // mensaje accionable. NO degradamos silenciosamente a dry-run para evitar
  // que admin asuma que se envió email cuando no.
  if (mode === 'email' && !process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY no configurada. Usa modo "Generar URL" mientras tanto.' };
  }

  try {
    const link = await emitirMagicLink(institucion_id, { dryRun: mode === 'dry_run' });
    revalidatePath(`/admin/instituciones/${institucion_id}`);
    revalidatePath('/admin/magic-links');
    // emitirMagicLink ya leyó email_contacto para mandar el correo; lo
    // exponemos en el resultado tipándolo en EmitirMagicLinkResult (modificación
    // pequeña al contrato) para que el cliente lo muestre sin segundo query.
    return {
      ok: true,
      mode,
      magic_url: link.url,
      expires_at: link.expires_at.toISOString(),
      sent_to: link.enviado ? link.email_contacto : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error al reemitir.' };
  }
}

export type RevocarResult = { ok: true } | { ok: false; error: string };

export async function revocarMagicLink(token_id: string): Promise<RevocarResult> {
  if (!(await isAdminAuthenticated())) return { ok: false, error: 'No autorizado.' };

  // Solo revocamos tokens en estado terminal-elegible: vigente.
  // Consumidos / expirados / ya-revocados quedan inmutables.
  const [updated] = await db
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

  if (!updated) {
    return { ok: false, error: 'Token no revocable (consumido, expirado o ya revocado).' };
  }

  revalidatePath(`/admin/instituciones/${updated.institucion_id}`);
  revalidatePath('/admin/magic-links');
  return { ok: true };
}
```

Justificación de la condición compuesta en revocar: prevenimos race entre dos admins que abran la misma fila y ambos clickeen revocar. Si ya se revocó/consumió/expiró entre el render y el click, la `UPDATE ... WHERE` simplemente no toca filas, y `returning()` queda vacío.

### `app/admin/magic-links/page.tsx` (server component)

Estructura visual:

- Header: "Magic links" + chip group de filtros (5 chips: Default vigentes/`vigente`/`consumido`/`expirado`/`revocado`). Toggle como en paquete 1.
- Sub-título: count de filas visibles.
- Tabla columnas: Institución (link), Status (pill), Creado, Expira, Consumido / Revocado, Acciones (revocar si vigente).
- Empty states: con filtro "Sin tokens con estos filtros" + chip "Ver todos"; sin filtros "Aún no hay magic links emitidos."

Status-pill colors:
- `vigente` → `bg-lime/30 text-lime-foreground` (igual que sesión `abierta`)
- `consumido` → `bg-forest text-primary-foreground` (forest sólido)
- `expirado` → `bg-amber-100 text-amber-900` (warning soft)
- `revocado` → `bg-foreground/8 text-muted-foreground` (gris terminal)

### `app/admin/instituciones/[id]/page.tsx` (modificación)

Añade sección entre "Sesiones" y "Histórico de perfiles":

```
┌─ Magic links (3) ─────────────────────────────────────┐
│  [chips de filtro: vigentes / todos]                   │
│  [Reenviar por correo] [Generar URL]                   │
│  ─────────────────────────────────────────────────     │
│  Tabla: status pill · creado · expira · acciones       │
└────────────────────────────────────────────────────────┘
```

Default chips: `vigente + consumido`. Mismo patrón visual y misma tabla que la global, pero filtrada por institución.

Botones reenviar como `client component` para manejar el copy-to-clipboard del URL devuelto. Si modo email tiene success, mostrar tostada/banner "Enviado a `email_contacto`". Si fail, mostrar el error inline (no toast).

### `components/admin/magic-link-actions.tsx` ('use client')

Tres variantes:
- `<ReenviarPorCorreoButton institucion_id={...} />` — invoca action mode='email', muestra success/error inline.
- `<GenerarUrlButton institucion_id={...} />` — invoca action mode='dry_run', muestra URL en banner con `<button onClick={navigator.clipboard.writeText}>Copiar</button>`.
- `<RevocarButton token_id={...} status={...} />` — solo render si `status === 'vigente'`. Confirm modal nativo (`window.confirm`) antes de invocar action. Texto: "¿Revocar este token? Esta acción no se puede deshacer."

Por qué `window.confirm` y no Dialog del @base-ui: el flujo es una decisión binaria de bajo coste UI (revocar es 1-click recuperable emitiendo nuevo). Diálogo custom es over-engineering aquí.

## Data flow

### Reenviar (modo email)

```
Admin click "Reenviar por correo"
  ↓
client invoca reenviarMagicLink(id, 'email')
  ↓
server: validate auth + RESEND_API_KEY presente
  ↓
emitirMagicLink → tx { revoke prev + insert new } → sendMagicLink (Resend)
  ↓
revalidatePath × 2
  ↓
client recibe { ok: true, sent_to } → muestra "Enviado a contacto@x.com"
```

### Reenviar (modo dry-run)

Idéntico salvo no llama a Resend. Cliente recibe `magic_url` y muestra banner con copy.

### Revocar manual

```
Admin click "Revocar" en fila vigente → window.confirm
  ↓
client invoca revocarMagicLink(token_id)
  ↓
server: UPDATE ... SET revoked_at WHERE id AND vigente-conditions → returning()
  ↓
returning vacío → { ok: false, error } (race detectado)
returning non-vacío → revalidatePath × 2 → { ok: true }
  ↓
client recibe response, revalidación trae status nuevo
```

### Verificar token (entrevistado, sin cambio mayor)

```
GET /acceso/[token]
  ↓
verificarMagicLink → busca por hash, chequea consumed/revoked/expired
  ↓
revoked → outcome { ok: false, razon: 'revocado' } → /acceso/expirado?razon=revocado
otros casos → idéntico al actual
```

## Helpers puros (testeables)

### `magic-token-status.test.ts`

- consumed_at presente → 'consumido' (incluso si revoked_at también)
- revoked_at presente, no consumed → 'revocado'
- expires_at en el pasado, no consumed/revoked → 'expirado'
- expires_at en el futuro, no consumed/revoked → 'vigente'
- Edge: expires_at exacto a `now` → 'expirado' (`<` no `<=`, así que justo en el límite cuenta como vigente; verificamos esto explícitamente en test).
- Edge: ambos consumed y revoked seteados → 'consumido' (orden de precedencia documentado).

### `parse-magic-status-filter.test.ts`

Mismo patrón que `parse-status-filter.test.ts` del paquete 1: undefined, vacío, válido único, válido múltiple, garbage filtra, garbage solo cae al default, whitespace tolera.

## Error handling

| Caso | Comportamiento |
|---|---|
| `?status=garbage` en `/admin/magic-links` | filtra inválidos, cae a `vigente+consumido`. Nunca 500. |
| Reenviar modo email sin `RESEND_API_KEY` | action retorna `{ok:false}` con mensaje accionable. Banner inline en UI. |
| Resend devuelve error (rate limit, etc.) | `sendMagicLink` lanza, action lo cachea, retorna `{ok:false, error: msg}`. El token YA fue insertado y los previos YA revocados — admin debe reintentar o copiar URL manualmente. La transacción de revoke+insert no se revierte porque la inserción fue exitosa, sólo el envío falló. (Decisión consciente: rollback condicionado al éxito de Resend agrega complejidad; el efecto neto es que admin tiene un token vigente y puede usar dry-run para obtener la URL.) |
| Revocar token ya consumido / expirado / revocado | `UPDATE ... WHERE` no afecta filas, `returning()` vacío → `{ok:false}` con mensaje. |
| Race entre dos admins revocando el mismo | uno gana (returning con fila), otro retorna error de race. UI muestra error inline. |
| Revocar último vigente sin reemitir | permitido. Institución queda sin token vigente; admin debe reenviar manualmente. |
| Verificar token revocado (entrevistado) | redirige a `/acceso/expirado?razon=revocado` con mensaje específico. |
| Token vigente cuando se reemite (auto-revoke) | tx revoca previos en mismo statement. `verificarMagicLink` consultas posteriores ven el estado nuevo. |

## Testing

Stack: **Vitest** (igual que paquete 1).

### Unit tests

`lib/admin/magic-token-status.test.ts`: ~6 cases (ver arriba).
`lib/admin/parse-magic-status-filter.test.ts`: ~7 cases (mismo patrón paquete 1).

### Integration tests

`app/actions/auth.test.ts` (extender existente o crear nuevo):
- `emitirMagicLink` con previos vigentes → previos quedan revocados, nuevo es el único vigente.
- `emitirMagicLink` con previo consumido → consumido NO se revoca, nuevo se inserta.
- `emitirMagicLink` con previo expirado → expirado NO se revoca explícitamente (queda como expirado, no como revocado), nuevo se inserta.
- `verificarMagicLink` con token revocado → `{ok:false, razon:'revocado'}`.

`app/actions/adminMagicLinks.integration.test.ts`:
- `reenviarMagicLink` modo dry_run sin auth → `{ok:false}`.
- `reenviarMagicLink` modo dry_run con auth → ok, devuelve URL, revoca previos.
- `reenviarMagicLink` modo email sin RESEND_API_KEY → `{ok:false}` con mensaje accionable.
- `revocarMagicLink` token vigente → ok, status pasa a revocado.
- `revocarMagicLink` token consumido → `{ok:false}`, fila intacta.
- `revocarMagicLink` con auth ausente → `{ok:false}`.
- `revocarMagicLink` con id inexistente → `{ok:false}` (no diferencia public-facing entre "no existe" y "no revocable").

Reutiliza `createTestDb()` y `resetReviewTables()` de `lib/motor/test-db.ts`. Si `DATABASE_URL_TEST` no está disponible, los tests integration se skipean (mismo patrón que paquete 1).

### E2E manual (Playwright MCP, no automatizado)

Después de implementar:

1. Login admin con token válido.
2. `/admin/instituciones/[id]` muestra sección "Magic links" con tabla. Si la institución tiene 1 token vigente (creado al alta), aparece en la tabla.
3. Click "Generar URL" → banner aparece con URL + botón Copiar. Tabla actualizada: previo revocado (si lo había), nuevo vigente.
4. Click "Revocar" en token vigente → confirm dialog → status pasa a `revocado`.
5. `/admin/magic-links` global muestra tokens cross-institución. Chips filtran. Default `vigente + consumido`.
6. Reenviar modo email sin `RESEND_API_KEY` → banner de error con mensaje accionable.
7. Visitar `/acceso/<token>` con token revocado → redirige a `/acceso/expirado?razon=revocado` con mensaje específico.

## Notas de implementación

- **No tocamos paquete 1.** El command palette no necesita extender scope (search por id de magic token sería paquete 3 si surge necesidad).
- **No agregamos dependencias.** Resend y Drizzle ya están en `package.json`.
- Migración Drizzle: `npx drizzle-kit generate` → revisar SQL → commit junto con el cambio en `schema.ts`.
- `revalidatePath` se llama explícitamente en cada server action mutadora. RSC re-render trae status nuevo sin client-side state.
- El cap silencioso de 500 filas en `/admin/magic-links` se hereda del patrón de paquete 1.
- Email template ya existe en `lib/email/resend.ts:sendMagicLink` — reutilizar sin tocar.
- **Contrato `EmitirMagicLinkResult` se extiende** con `email_contacto?: string` para que el caller pueda mostrar a quién se envió sin re-query. Cambio retro-compatible (campo opcional).
- **Impacto en `scripts/smoke_auth.ts`:** este script re-emite tokens para la misma institución a propósito (tests B y D). Tras este paquete, tokens B quedarán revocados cuando D emita. El smoke debe actualizarse: o bien usar instituciones distintas por test, o asumir el nuevo comportamiento y validar el revoke explícitamente. **Tarea incluida en plan de implementación**: ajustar smoke como paso adicional al final.

## Convención de commits

Sub-feature por commit (4 commits independientes en orden):

1. `feat(auth): magic_tokens.revoked_at + auto-revoke en emitir + check en verificar`
2. `feat(admin): server actions reenviar/revocar magic link + helpers + unit tests`
3. `feat(admin): índice global /admin/magic-links con chips de filtro`
4. `feat(admin): sección magic links en /admin/instituciones/[id] con acciones`

Mismo branch (`feat/admin-paquete-2-magic-links`), un solo PR al final agrupándolos.
