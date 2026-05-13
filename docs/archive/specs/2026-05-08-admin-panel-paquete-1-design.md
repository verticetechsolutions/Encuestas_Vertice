# Admin panel — Paquete 1: Visibilidad core

**Fecha:** 2026-05-08
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Owner:** Opsyo

## Contexto

Hoy el panel admin (`app/admin/*`) cubre login, dashboard con KPIs, listado y alta de instituciones, detalle de institución, detalle de sesión y exports CSV/JSON. Faltan piezas para que el admin "vea todo" desde un solo lugar sin tener que correr scripts.

Los gaps identificados se agruparon en 3 paquetes secuenciales. Este spec cubre el **Paquete 1 — Visibilidad core**, que entrega el primer valor visible: ver cualquier sesión sin pasar por la institución, ver el perfil JSON por sesión específica (no solo el último de la institución) y buscar instituciones/sesiones rápido vía command palette.

Los Paquetes 2 (gestión de magic links) y 3 (analytics: respuestas agregadas, audit log, correcciones manuales) tendrán sus propios specs.

## Scope

**Dentro:**

- **A** — `/admin/sesiones`: índice global con filtros por status, default `abierta + sintetizando`.
- **E** — Perfil JSON por sesión específica en `/admin/sesiones/[id]` + histórico de perfiles versionados en `/admin/instituciones/[id]`.
- **G** — Command palette (Cmd/Ctrl+K) global en `/admin/*`, scope = instituciones + sesiones por id.

**Fuera:**

- Reenviar/revocar/historial de magic links (Paquete 2).
- Vista agregada de extracciones cross-sesión (Paquete 3).
- Audit log / timeline de actividad (Paquete 3).
- Listado de `eventos_correccion_manual` (Paquete 3).
- Catálogo de cajas configurable desde UI (descartado por ahora).
- Multi-admin con roles (single shared token sigue siendo el modelo).
- Paginación con cursor (cap silencioso a 500 filas; revisitar en P3 si llega).
- Full-text search dentro de turnos/extracciones (Paquete 3).

## Arquitectura

Mismo patrón que el resto del admin: **React Server Components** para todo lo que renderiza data, **un solo client island** (el command palette). Filtros viven en URL params (`?status=...`), no en estado cliente. Queries Drizzle directas en `page.tsx`. Páginas marcadas `force-dynamic` para que no se cacheen.

### Rutas y archivos

```
app/admin/
  sesiones/
    page.tsx                  ← NUEVO  índice global con filtros
    [id]/page.tsx             ← MOD    agregar sección "Perfil de esta sesión"
  instituciones/
    [id]/page.tsx             ← MOD    "último perfil" → "histórico de perfiles"
  api/
    search/route.ts           ← NUEVO  GET /admin/api/search?q=
  layout.tsx                  ← MOD    nav link a "Sesiones" + montar trigger Cmd+K

components/admin/             ← directorio nuevo
  command-palette.tsx         ← NUEVO  client component
  command-palette-trigger.tsx ← NUEVO  client component, listener global de teclado

lib/admin/
  parse-status-filter.ts      ← NUEVO  helper puro (testeable)
  search-query.ts             ← NUEVO  sanitizeQuery + isUuidish (testeable)
```

## Componentes y responsabilidades

### `app/admin/sesiones/page.tsx` (server component)

Índice global. Lee `searchParams.status`, valida con `parseStatusFilter()`, query con `inArray`, renderiza tabla.

Estructura visual:

- Header: título "Sesiones" + chip group de filtros (5 chips, uno por status del enum). Chip activo destacado, click navega a `?status=...`. Un chip "Todas" limpia filtros.
- Si `rows.length === 501` → footer "Mostrando primeras 500. Refina filtros.".
- Tabla: columnas Institución (link), Tipo, Status (pill), Cajas (`X/Y`), Iniciada, Último turno, Detalle. Mismas convenciones visuales que la tabla del dashboard.
- Empty state con filtros aplicados: "Sin sesiones con estos filtros" + chip "Ver todas".
- Empty state sin sesiones global: "Aún no hay sesiones" + link a "Nueva institución".

### `app/admin/api/search/route.ts` (route handler)

```
GET /admin/api/search?q=<term>&limit=8
```

Flujo:

1. `adminGuardOrThrow()` (lanza si no autenticado) → catch → `Response.json({error:'unauthorized'}, {status: 401})`.
2. Parsea y valida `q` con `sanitizeQuery()`. Si `len < 2` → `200 { instituciones: [], sesiones: [] }`.
3. Dispara dos queries paralelas:
   - **Instituciones:** `ILIKE` sobre `razon_social`, `nombre_comercial`, `email_contacto`. Limit 8. Order by `created_at DESC`.
   - **Sesiones:** solo si `isUuidish(q)`, `WHERE id::text ILIKE 'q%'` joinada a `instituciones`. Limit 8.
4. Devuelve JSON `{ instituciones: [{id, razon_social, tipo}], sesiones: [{id, razon_social, status, started_at}] }`.
5. `dynamic = 'force-dynamic'`, response con `Cache-Control: no-store`.

Errores DB → `500 { error: 'search_failed' }` + log a Sentry.

### `components/admin/command-palette.tsx` ('use client')

Construido sobre **`@base-ui/react` Dialog** (ya en `package.json`). No agregamos `cmdk` ni dependencias nuevas.

Estado interno (useState):

- `query: string`
- `results: { instituciones, sesiones }`
- `loading: boolean`
- `selectedIdx: number` (índice flat sobre todos los items renderizados)
- `error: string | null`

Comportamiento:

- Abierto/cerrado controlado por prop `open` desde el `Trigger`.
- Al abrir: foco en input, query vacía → empty state inicial "Empieza a escribir...".
- Cambio de query: debounce 150ms → `fetch('/admin/api/search?q=...', { signal })` con `AbortController`. Cancela request anterior.
- Resultados en dos secciones (Instituciones / Sesiones), keyboard-navegables.
- ↑↓ mueve `selectedIdx` (envuelve si llega al final). Enter dispara `router.push(href)` y cierra. Esc cierra.
- Cada item renderiza con `<Link>` de Next (prefetch automático).
- Empty state con resultados: "Sin resultados para 'X'".
- 401 del backend: cierra palette + `router.push('/admin/login?next=' + currentPath)`.

### `components/admin/command-palette-trigger.tsx` ('use client')

Botón discreto en el header (`<button>` con texto "Buscar..." + chip `⌘K` o `Ctrl K` según `navigator.platform`).

Maneja:

- `useState` para `open`.
- `useEffect` que registra `keydown` global, captura `(meta||ctrl) + k`. Si palette ya abierto → toggle (cierra). Funciona aunque el foco esté en otro `<input>`.
- Renderiza `<CommandPalette open={open} onOpenChange={setOpen} />`. El palette completo solo monta cuando `open===true` (cero peso en bundle inicial salvo el listener).
- En mobile (<768px) el botón se renderiza igual; el atajo no se anuncia visualmente. El palette ocupa full-screen al abrir.

Por qué separar trigger y palette: el trigger es trivial y siempre vive; el palette es el bulto pesado y solo se monta on-demand.

### Modificaciones a archivos existentes

#### `app/admin/layout.tsx`

- Nuevo `<NavLink href="/admin/sesiones">Sesiones</NavLink>` en el nav (entre "Resumen" e "Instituciones").
- Nuevo `<CommandPaletteTrigger />` en el header derecho, antes del form de logout.

#### `app/admin/sesiones/[id]/page.tsx`

Se añade al `Promise.all` existente una sexta query:

```ts
db.select().from(perfil_decision_final)
  .where(eq(perfil_decision_final.sesion_id, id))
  .orderBy(desc(perfil_decision_final.version))
  .limit(1)
```

Nueva `<Section title="Perfil de esta sesión">` después de "Cajas declinadas" y antes de "Metadata bruto". Si hay perfil, muestra los 4 stats (schema, completitud, confianza global, versión) + JSON colapsable. Si no, mensaje: "La síntesis aún no se ha generado para esta sesión."

#### `app/admin/instituciones/[id]/page.tsx`

La query existente ya trae `perfiles` ordenados por versión DESC. No se toca la query.

Render:

- Sección renombrada de "Perfil JSON (síntesis final)" a "Histórico de perfiles".
- Sub-header con el conteo: `Histórico de perfiles ({perfiles.length})`.
- Si 0 perfiles → mensaje existente se mantiene.
- Si N perfiles → map sobre `perfiles`. Cada uno `<details>`, `open` solo el primero (versión más alta). Header de cada `<details>`: "v{N} · {formatRelative(generado_at)} · {sesion_id (corto)}".
- Cada perfil expandido muestra 4 stats + JSON pretty-printed (`JSON.stringify(perfil_json, null, 2)`, igual que hoy en el detalle de sesión).

## Data flow

### Índice global (`/admin/sesiones?status=...`)

```
URL params → parseStatusFilter() → SesionStatus[] → inArray query → render tabla
```

Caso edge: si `parseStatusFilter` recibe `?status=garbage,abierta`, filtra inválidos, devuelve `['abierta']`. Si todo es inválido, devuelve `['abierta','sintetizando']` (default).

### Command palette flow

```
Cmd+K → setOpen(true) → palette monta
  ↓
input change → debounce 150ms → fetch('/admin/api/search?q=...')
  ↓
route handler → adminGuardOrThrow → sanitizeQuery → 2 queries paralelas → JSON
  ↓
client recibe → setResults → render dos secciones
  ↓
Enter → router.push(item.href) → setOpen(false)
```

### Perfil por sesión

```
/admin/sesiones/[id] → Promise.all incluye query de perfil_decision_final WHERE sesion_id = id
  ↓
Si perfil existe → render stats + JSON colapsable
Si no → render empty state con mensaje
```

### Histórico de perfiles

```
/admin/instituciones/[id] → query existente devuelve perfiles[] (DESC por versión)
  ↓
Render N <details>, primero open por default, resto colapsado
```

## Helpers puros (testeables)

### `lib/admin/parse-status-filter.ts`

```ts
const VALID_STATUSES = ['abierta','pausada','sintetizando','completa','abandonada'] as const;
type SesionStatus = typeof VALID_STATUSES[number];

export function parseStatusFilter(raw: string | undefined): SesionStatus[] {
  if (!raw) return ['abierta', 'sintetizando'];
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  const valid = parts.filter((s): s is SesionStatus =>
    (VALID_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : ['abierta', 'sintetizando'];
}
```

### `lib/admin/search-query.ts`

```ts
const MAX_LEN = 100;
const MIN_LEN = 2;

export function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, MAX_LEN)
    .replace(/[%_\\]/g, '\\$&'); // escape de wildcards y backslash
}

export function isUuidish(q: string): boolean {
  // 4-36 chars, solo hex y dashes (UUID parcial o completo)
  return /^[0-9a-f-]{4,36}$/i.test(q);
}

export const SEARCH_MIN_LEN = MIN_LEN;
```

## Error handling

| Caso | Comportamiento |
|---|---|
| `?status=garbage` en índice | filtra inválidos, cae al default si vacío. Nunca 500. |
| DB caída en cualquier page | propaga al `app/global-error.tsx` existente. |
| Resultset == 501 filas | render 500, footer "Mostrando primeras 500. Refina filtros." |
| Cookie inválida en `/admin/api/search` | 401 JSON. Cliente cierra palette, redirige a login con `?next=`. |
| `q` vacío / <2 chars / >100 chars en search | 200 con arrays vacíos (no 400; el cliente puede estar tipeando). |
| `%` o `_` en `q` | escapados en `sanitizeQuery` antes de `ILIKE`. |
| Race de fetches en palette | `AbortController` cancela los previos. `AbortError` ignorado silente. |
| Doble Cmd+K con palette abierto | toggle (cierra). |
| Cmd+K mientras escribes en otro input | abre igual; el palette se monta encima. Esc lo cierra. |
| Sesión sin perfil aún | render explícito "La síntesis aún no se ha generado". |
| `perfil_json` null (no debería pasar) | render "Perfil corrupto, contactar al equipo." |
| DB error en route handler search | 500 + Sentry log. |

Auth edge cases ya cubiertos por `requireAdmin()` / `adminGuardOrThrow()` existentes — no se agrega lógica nueva.

## Testing

Stack: **Vitest** (ya configurado, `vitest.config.ts`). Naming convention del repo: `*.test.ts` para unit, `*.integration.test.ts` para integration (excluidos de paralelismo, requieren `DATABASE_URL_TEST`).

### Unit tests

`lib/admin/parse-status-filter.test.ts`:

- undefined → `['abierta','sintetizando']`
- `''` → default
- `'completa'` → `['completa']`
- `'completa,abandonada'` → `['completa','abandonada']`
- `'garbage,abierta'` → `['abierta']`
- `'garbage'` → default
- `' completa , abandonada '` → `['completa','abandonada']` (whitespace)

`lib/admin/search-query.test.ts`:

- `sanitizeQuery`: trim; max 100 chars; escapa `%`, `_`, `\`; cadena vacía → `''`.
- `isUuidish`: 4 hex chars → true; 8 hex con dash → true; UUID completo (36) → true; 3 chars → false; chars no-hex → false; >36 → false; vacío → false.

### Integration tests

Infra existente: `lib/motor/test-db.ts` con `createTestDb()` y `resetReviewTables()`. Patrón: `beforeEach` limpia, `afterAll` cierra cliente. Requiere `DATABASE_URL_TEST` apuntando a Neon branch dedicado.

`app/admin/api/search/route.integration.test.ts`:

- Seed 3 instituciones con razones sociales distintas + 5 sesiones con UUIDs predecibles.
- `q='banco'` → encuentra instituciones que matchean en razon_social.
- `q='%bank%'` (con wildcard inyectado) → no devuelve resultados extras (escape funciona).
- `q='abc12'` (UUID parcial hex) → encuentra sesiones cuyo id arranca con esos chars.
- `q='ab'` (2 chars no-uuidish) → encuentra solo instituciones, sesiones vacío.
- Sin cookie admin → 401.
- `q=''` → arrays vacíos.

Si `DATABASE_URL_TEST` no está disponible en CI, los integration tests se skipean condicionalmente. Replicar exactamente el patrón ya usado en `lib/motor/review.integration.test.ts` (leer ese archivo antes de implementar para no introducir un patrón distinto).

### E2E manual (Playwright MCP, no automatizado en suite)

Después de implementar, valido en browser con el servidor dev levantado (`npm run dev`):

1. Login admin con token válido.
2. `/admin/sesiones` carga; chips de filtro funcionan; navegación a detalle de sesión funciona.
3. `/admin/sesiones/[id]` muestra sección "Perfil de esta sesión" cuando hay perfil; estado vacío explícito cuando no.
4. `/admin/instituciones/[id]` muestra histórico expandible; primero open, resto colapsado.
5. Cmd+K abre palette desde 3 páginas distintas (`/admin`, `/admin/sesiones`, `/admin/instituciones/[id]`); búsqueda devuelve resultados; Enter navega; Esc cierra.
6. Cookie expirada simulada (borrar cookie en devtools) + búsqueda → redirige a login.
7. Resize a <768px → palette se renderiza full-screen; trigger sin chip de atajo.

## Notas de implementación

- **No tocamos la auth existente.** `requireAdmin()` y `adminGuardOrThrow()` ya cubren lo que necesitamos.
- **No agregamos dependencias nuevas.** `@base-ui/react` ya está; lo usamos para el Dialog del palette.
- **No tocamos las exports CSV/JSON** existentes en `/admin/api/export/`.
- Las queries del índice global usan `inArray` de `drizzle-orm` para el filtro por status.
- Keyboard shortcut: detección Mac vs PC con `navigator.platform.includes('Mac')` o `navigator.userAgent`. Si falla, default a `Ctrl K`.
- El debounce de 150ms es manual (`setTimeout` + `clearTimeout` en effect cleanup); no agregamos lodash ni similar.
- El cap de 500 filas en `/admin/sesiones` se elige porque a ese volumen el TTFB sigue <500ms en Neon. Si el dataset crece, P3 introduce cursor pagination.

## Convención de commits

Sub-feature por commit (los 3 son independientes y revisables por separado):

1. `feat(admin): índice global de sesiones con filtros por status (gap A)`
2. `feat(admin): perfil JSON por sesión + histórico en institución (gap E)`
3. `feat(admin): command palette global Cmd+K (gap G)`

Mismo branch (`feat/admin-paquete-1-visibilidad-core`), un solo PR al final agrupándolos.
