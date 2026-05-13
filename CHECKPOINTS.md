# CHECKPOINTS — log de sesiones

> Log cronológico de sesiones. **Entrada más reciente arriba.** Una entrada por sesión que haya hecho cambios relevantes. No duplicar `STATUS.md`: aquí va el snapshot temporal, allá va el estado canónico.

## Formato estándar por entrada

```markdown
## YYYY-MM-DD — título corto

**Branch:** `...`  ·  **HEAD:** `<hash>`  ·  **Suite:** N/N
**Sesión:** descripción 1-2 líneas.

### Lo que se hizo
- bullet por cambio relevante con archivo:línea cuando aplique

### Pendientes / blockers
- bullet por item abierto, con [USER] si requiere founder

### Cómo retomar
- pasos concretos para la próxima sesión
```

> Al cerrar una sesión: agregar entrada nueva arriba, mover los items perennes a `STATUS.md` (§3, §4 o §5 según aplique).

---

## 2026-05-13 — Redesign modales de acceso del landing (DialogShell + 5 flows)

**Branch:** `master`  ·  **HEAD:** `ba968ec` (working tree con cambios sin commitear en `app/page.tsx` + CHECKPOINTS + STATUS)  ·  **Suite:** 496/496 verdes · typecheck limpio
**Sesión:** founder pidió rediseñar los modales `<Dialog>` del landing (menu / access / request / receipt) para alinearlos al patrón visual cementado en `/acceso/expirado` + `/entrevista/[id]/bienvenida`. Iteración rápida sobre las 5 vistas en Chrome.

### Lo que se hizo

**`app/page.tsx` — refactor visual del Dialog:**
- **`Dialog.Popup`**: ancho `min(94vw,540px)` (era 480px), `rounded-[28px]`, sombra `0_30px_90px_-20px_rgba(0,0,0,0.5)` + ring sutil, transition ease `cubic-bezier(0.16,1,0.3,1)`, removido `border` duro.
- **`DialogShell`**: removido `kicker` y `kickerVariant` (sin status dot, sin texto "Bienvenido"/"Alianza · K9SCMA"). Header nuevo: solo logo Vértice (h-7) top-left + close X top-right, sin borde inferior, sin atmosphere harsh. Atmosphere overlay `atmosphere-radial-gold-warm`. Back arrow tiene hover `-translate-x-0.5` + bg ink/5. Close X tiene hover `rotate-90` + bg ink/5 (micro-anim sutil).
- **`MenuFlow`**: H1 split-color `font-heading text-[clamp(30px,4.8vw,40px)]` ("Acceso a / la plataforma."). Cards "01 · Reanudar entrevista" (white) y "02 · Solicitar alianza" (ink+gold). Componente `MenuOption` reusable con variants `light|dark`, eyebrow mono "01 · TÍTULO", descripción ink/72, arrow pill rotando 45° en hover.
- **`AccessFlow choose`**: H1 "Reanudar / entrevista." con Google como primera card (con GoogleG en círculo ring) + divisor "o" mono caps + segunda card ink "Reenviar mi enlace por correo".
- **`AccessFlow email`**: H1 "Reenviar / enlace." + `FormField` (preservado) + `SubmitButton` actualizado.
- **`AccessFlow sent_email`**: centrado. Mail icon en pill ink con ring gold `ring-4 ring-gold/[0.08]` + H1 "Revisa / tu correo." + caption con email destacado en `font-medium text-ink`.
- **`RequestFlow form`**: H1 "Solicitar / alianza." + 3 `FormField`/`FormSelect` (preservados) + `SubmitButton` actualizado.
- **`ReceiptView`**: BrandSuccessGlyph (sello) + H1 "Solicitud / registrada." + folio en card editorial blanca (`bg-survey-surface rounded-[22px] ring-1 ring-ink/[0.05]`) con eyebrow gold "FOLIO", mono `text-[34px] tracking-[0.16em]`, hairline interno, línea contextual razón social · tipo. Description final fuera del card. Removido el `sx-line` (hairline dorado de animación).
- **`SubmitButton`**: actualizado al patrón ink + cream-pure pill (consistente con `/acceso/expirado` y landing). `rounded-full`, pill cream-pure h-11 con ArrowUpRight 18px que rota 45° en hover, sombra cta-glow ink, `active:scale-[0.99]`.

**Font check:** `getComputedStyle()` en el H1 del modal Dialog confirma General Sans 600 / 40px aplicado vía `font-heading`. Cero ocurrencias nuevas de `font-display` introducidas (deuda #18 sigue abierta para los 11 sitios legacy).

### Pendientes / blockers

**Sin nuevos.** Cambios sin commitear esperando sign-off + commit + push del founder.

### Cómo retomar

- El `Dialog.Backdrop` se mantuvo en `bg-ink/82 backdrop-blur-sm` (no se tocó) para no afectar el contraste con el resto de la página.
- Si surge necesidad de añadir un 4to flow (ej. "Olvidé mi correo institucional"), seguir el patrón: H1 split-color + `MenuOption` o `FormField` o card editorial blanca con eyebrow mono.
- `MenuOption` quedó como subcomponente exportado dentro de `app/page.tsx`. Si se reusa en otro sitio, considerar moverlo a `components/landing/`.

---

## 2026-05-13 — Deuda #6 cerrada: `ValorPorCaja` mapping type + `parseValorPorCaja` (Plan B)

**Branch:** `master`  ·  **HEAD:** `ba968ec` (test(schemas): ValorPorCaja mapping type + parseValorPorCaja — deuda #6 Plan B)  ·  **Suite:** 496/496 verdes (+22 nuevos) · typecheck limpio
**Sesión:** ejecución de deuda media #6 vía `/goal`. Plan B aplicado (type-narrow opt-in con mapping type), sin breaking changes. Plan A queda para v2 si surge necesidad real.

### Lo que se hizo

**Diseño Plan B** (sin tocar el envelope, sin refactor masivo):
- El envelope `ExtraccionSchema.valor: z.unknown()` queda como está — el sitio común (route handlers, snapshots, loops genéricos) no conoce el caja_codigo en compile-time, así que el envelope no se puede narrowear estáticamente sin enumerar los 81 codigos.
- Para sites que SÍ conocen el codigo estáticamente, agregué dos APIs nuevas opt-in:
  - `parseValorPorCaja<C>(codigo: C, valor: unknown): ValorPorCaja<C>` — el call site pasa el codigo literal, recibe el shape narrow.
  - `parseExtraccion<C>(raw, hint?)` — hint opcional; sin hint, signature default `string` y backward-compatible.

**Cambios concretos** (`lib/schemas/extracciones.ts`):
- `interface SpecialValorMap`: mapea los 14 codigos composite a sus shapes (`to_*` → `Tolerancia`, `se_*` → `SituacionEspecial`, `co_email_telefono` → `EmailTelefono`, `op_eeff_auditados` → `EeffAuditados`, `pc_tasas_por_producto` → `TasasPorProducto`, `pc_plazos_por_producto` → `PlazosPorProducto`).
- `export type ValorPorCaja<C extends string>`: conditional type. `C extends keyof SpecialValorMap ? SpecialValorMap[C] : unknown`. Cajas generic-por-tipo y desconocidas caen al fallback `unknown` (mismo comportamiento que el envelope actual).
- `export function parseValorPorCaja<C>(codigo, valor)`: helper público. Runtime: `valorSchemaFor(codigo).parse(valor)`. Lanza `ZodError` si inválido.
- `parseExtraccion<C>(raw, hint?)`: hint opcional con validación runtime (`envelope.caja_codigo === hint`, sino throw `ExtraccionHintMismatchError`). Evita type lie cuando hint no coincide con codigo real.
- `export class ExtraccionHintMismatchError`: error custom con campos `expected` y `actual`.

**Tests** (`lib/schemas/extracciones.test.ts`, nuevo, 22 tests):
- 7 runtime válidos por caja especial (Tolerancia, SituacionEspecial, EmailTelefono, EeffAuditados, TasasPorProducto, PlazosPorProducto).
- 5 runtime inválidos lanzan ZodError (refines y validaciones internas).
- 1 caja generic (`ru_monto_min` int) + 1 caja desconocida (fallback unknown).
- 2 backward-compatibility sin hint (Extraccion & { valor: unknown }).
- 3 hint correcto vs mismatch (ExtraccionHintMismatchError con expected/actual expuestos).
- 3 type-level via `expectTypeOf` cubriendo SpecialValorMap + fallback unknown + wide string.

**Hallazgos durante implementación**:
- UUIDs hardcoded como `'11111111-...'` ya no pasan Zod v4 `z.string().uuid()` (requiere version + variant bits específicos). Migrados a `crypto.randomUUID()` para validez universal.
- Regex `co_email_telefono.telefono` es `^\+?52?\s?\d{10}$` que parsea `52?` como "5 seguido de 2 opcional", NO "52 opcional". Test inicial `'5555551234'` falló porque solo cuenta como `5` + 8 dígitos. Format válido: `'+525555551234'` o `'525555551234'`.

### Pendientes / blockers

**Sin nuevos.** Deuda #6 cerrada con Plan B aplicado. 3 decisiones documentadas en DEUDA_TECNICA item #6 footer:
- **Plan A** (DiscriminatedUnion sobre 81 codigos) queda para v2 si surge necesidad real de type-safety en loops genéricos.
- **`ValorTablaGenericaSchema` y `ValorObjetoGenericoSchema`** (cajas `tabla`/`objeto` sin schema específico) siguen con `z.record(string, z.unknown())`. Fuera del scope: son colecciones heterogéneas por diseño.
- **Migración de call sites a `parseValorPorCaja`**: opt-in. Cuando se agregue un site nuevo que conozca el codigo, usar el helper. Loops genéricos (`persistence.persistirExtraccionesBatch`) siguen con `valorSchemaFor(e.caja_codigo)` porque el codigo es runtime-only.

### Cómo retomar

- Para usar el narrow type en un site nuevo:
  ```typescript
  import { parseValorPorCaja, type EmailTelefono } from '@/lib/schemas/extracciones';
  const contacto: EmailTelefono = parseValorPorCaja('co_email_telefono', raw);
  ```
- Para validar un envelope completo conociendo el codigo:
  ```typescript
  const e = parseExtraccion(raw, 'to_historial_credito' as const);
  // e.valor: Tolerancia
  ```
- Si surge la necesidad de Plan A: el refactor requiere enumerar 81 codigos como literal union, convertir `ExtraccionSchema` a `z.discriminatedUnion('caja_codigo', [...])`, y tocar ~15 call sites. Esfuerzo 6-8h con tests. La lista actual de cajas vive en `lib/schemas/cajas.ts` (`CAJAS_CANON` + `CAJAS_EXTENSION_POR_TIPO`).

---

## 2026-05-13 — Redesign UI `/acceso/expirado` + descubierta deuda #18 (`font-display` rendering Satoshi)

**Branch:** `master`  ·  **HEAD:** `2b0bb99` (working tree con cambios sin commitear)  ·  **Suite:** 474/474 verdes · typecheck limpio
**Sesión:** founder reportó que `/acceso/expirado?razon=dominio_no_permitido` se veía "muy básica" sin alinear al design system. Iteración visual rápida en Claude Chrome con 4 rounds de feedback hasta cerrar visualmente.

### Lo que se hizo

**Redesign de `app/(auth)/acceso/expirado/page.tsx`:**
- Reescritura completa: de markup ad-hoc con `style={{...}}` inline a layout del design system (surface `bg-survey-bg` + card `bg-cream-pure rounded-[28px]` + `atmosphere-radial-gold-warm`, mismo patrón que `/entrevista/[id]/bienvenida`).
- Tipografía: H1 `font-heading text-[clamp(44px,7vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em]` con split-color (segunda línea `text-gold-deep`). Logo bumped a `h-10 md:h-12` (de h-7/h-9).
- 12 razones de error mapeadas a mensajes cortos de 1 frase (de ~25 palabras a 6-9 cada uno). Mantiene compatibilidad con todos los `?razon=*` que emiten `app/(auth)/acceso/[token]/route.ts` y `auth.ts` SSO callback.
- Acción única: card blanca `bg-survey-surface rounded-[22px] ring-1 ring-foreground/[0.04]` con label mono "Escríbele a", email visible (`contacto@verticemexico.com`), y pill ink con ArrowUpRight que rota 45° en hover. Toda la card es un `<a href={mailto}>` con subject + body pre-llenados.
- Removido del diseño anterior por petición del founder: eyebrow contextual, ícono shield top-right, footer "Vértice · Red de financieras", helper pill "¿Qué hago ahora?", botón secundario "Copiar correo", hairline separator entre body y CTA, hairline gold sobre H1, italic accent.

**Descubierta deuda #18 — `font-display` silently rendering Satoshi (project-wide):**
- Verificación con `getComputedStyle()` en Chrome reveló que el H1 con `className="font-display"` rendea Satoshi, no General Sans. `font-display` NO es una clase Tailwind válida en este proyecto: `--font-display` vive en `tokens.css:33` (`:root`) pero `@theme inline` en `globals.css` sólo expone `--font-heading`, `--font-sans` y `--font-mono`. Tailwind v4 sólo genera utilities `font-*` desde tokens registrados en `@theme`.
- Afecta 11 sitios consumers en el codebase (landing `app/page.tsx`, `app/terminos/page.tsx`, `app/entrevista/[sesion_id]/bienvenida/page.tsx`). Las utility classes `.text-hero`, `.text-display`, `.text-h2`, `.text-h3` (que sí funcionan) usan `font-family: var(--font-display)` directo, así que el landing hero *real* (que usa `.text-hero`) renderea General Sans. Pero los sites que combinan tamaño custom con `font-display` (manifest sections, terminos, bienvenida italic) caen a Satoshi.
- Fix sitio-por-sitio aplicado sólo a `/acceso/expirado` (`font-display` → `font-heading`). El resto queda como deuda #18 en `docs/DEUDA_TECNICA.md` con recomendación de fix global: registrar `--font-display` en `@theme inline`.

### Pendientes / blockers

- **[USER]** Decidir si quiere el fix global de deuda #18 ahora o post-piloto. Si ahora, sweep visual de los 11 sitios afectados.
- Nada más bloqueante. Cambios sin commitear esperando sign-off + commit + push del founder.

### Cómo retomar

- Si se quiere cerrar deuda #18 inmediatamente: agregar `--font-display: 'General Sans', 'Satoshi', ui-sans-serif, system-ui, sans-serif;` al bloque `@theme inline` en `app/globals.css` (línea ~23). Smoke visual landing + terminos + bienvenida.
- El page `/acceso/expirado` queda alineado al DS. Si surgen otras razones de error en `app/(auth)/acceso/[token]/route.ts` o `auth.ts`, agregar entrada al map `RAZONES` en `page.tsx:17-72`.

---

## 2026-05-13 — Cobertura tests admin + actions (deuda #5 cerrada)

**Branch:** `master`  ·  **HEAD:** `87abc5b` (test(actions): cobertura de admin auth + logout + instituciones — deuda #5)  ·  **Suite:** 474/474 verdes (+25 nuevos) · typecheck limpio
**Sesión:** ejecución de deuda alta #5 vía `/goal`. Auditoría inicial reveló que el item estaba mal calibrado: la deuda decía "23 archivos sin test" pero la realidad es que 5/9 actions y 2/2 routes admin críticos ya estaban cubiertos. Solo faltaban tests para 3 actions (`adminAuth`, `sesionLogout`, `adminInstituciones` parte editar/eliminar). Total: ~2.5h reales vs estimado 4-6h.

### Lo que se hizo

**Auditoría del estado real** (antes de escribir tests):
- `app/actions/` con 9 archivos `.ts`: 5 ya con `.integration.test.ts` adyacente (`instituciones`, `respuestas`, `sesiones`, `auth`, `adminMagicLinks`). 3 sin test (`adminAuth`, `sesionLogout`, `adminInstituciones`). 1 no aplica (`respuestas.contracts.ts` solo schemas declarativos).
- `app/admin/api/` routes: ambas cubiertas (`export/[entity]`, `search`).
- `app/admin/*/page.tsx` (RSC pages): sin tests; decisión documentada de cubrir vía smoke manual + Playwright si surge regresión post-piloto.

**Tests escritos:**
- `app/actions/adminAuth.unit.test.ts` (9 tests): unit tests porque adminAuth no toca DB. `loginAdmin` con happy path + happy con `next`, security (next arbitrario → `/admin`), rate-limit, admin_disabled, admin_invalid_token, IP fallback `x-forwarded-for → x-real-ip`, user-agent truncado 200 chars. `logoutAdmin` con `clearAdminCookie` + redirect. Patrón clave: `redirect` mockeado para lanzar `TestRedirectError` y parar control flow en cascada.
- `app/actions/sesionLogout.unit.test.ts` (2 tests): trivial. Verifica `clearSessionCookie` invocado + redirect a `/`. Segundo test es sanity guard contra futuros refactors que agreguen UPDATE sesiones SET status='abandonada' (decisión documentada en el archivo).
- `app/actions/adminInstituciones.integration.test.ts` (14 tests): integration porque editar/eliminar tocan DB real. `editarInstitucion` con 8 casos (happy, parcial, nombre_comercial vacío explícito → null, sin auth, id vacío, id inexistente, email duplicado 23505, email inválido Zod). `eliminarInstitucion` con 6 casos (happy, sin auth, id vacío/inexistente, bloqueado por sesiones FK, bloqueado por magic_tokens FK). `crearInstitucionConLink` ya en `instituciones.integration.test.ts`.

**Hallazgo durante implementación** (audit log):
- La tabla `audit_admin_actions` se crea en migración 0006 que NO está aplicada al branch test-integration. El primer run del integration test falló con `relation "audit_admin_actions" does not exist`. Solución: mockear `@/lib/auth/audit` con `withAuditLog = (action, meta, fn) => fn()` — pass-through directo. Los tests focalizan en business logic de la action (UPDATE/DELETE + pre-check FK + return shape), no en el audit log que tiene cobertura propia.
- Esta decisión deja el audit log SIN test E2E al pasar por `editarInstitucion`/`eliminarInstitucion`. Si se quiere validar el contenido del audit en el futuro, hay que aplicar 0006 al branch test (un alter table simple).

### Pendientes / blockers

**Sin nuevos bloqueantes.** Deuda #5 cerrada completa. 2 decisiones documentadas en DEUDA_TECNICA item #5 footer:
- RSC pages (`app/admin/*/page.tsx`) sin test unit/integration. Cubiertas por smoke manual del founder. Si surge regresión, Playwright focal post-piloto.
- Client form `nueva-form.tsx` sin test porque requiere `@testing-library/react` (deuda #12 lo declara como bloqueante). Cerrar al cerrar #12.

### Cómo retomar

- Si en una sesión futura aparece error `relation "audit_admin_actions" does not exist` en algún test integration: aplicar migración 0006 a la DB del branch test (`vertice-mvp/test-integration`). Toda la fila de migraciones 0000-0008 debería estar aplicada idempotentemente al branch test.
- Si se quiere extender cobertura a las RSC pages admin: el patrón es `app/admin/instituciones/page.integration.test.ts` con un mock de `next/cache` + DB real test, importar la default export, llamar como función async, verificar el output JSX vía snapshot o querying específico. Pero RSC tests son frágiles ante cambios visuales; preferir Playwright para flujos críticos.
- Si se quiere agregar audit log contenido al test de `eliminarInstitucion`: aplicar migración 0006 al branch test, quitar el mock de `@/lib/auth/audit` del archivo `adminInstituciones.integration.test.ts`, y agregar SELECT sobre `audit_admin_actions` después de cada action verificando que hubo INSERT con `action='instituciones.eliminar'`.

---

## 2026-05-13 — Sign-off prompts Opus generador + validador casos sintéticos (Fase 5 sub-paso iv)

**Branch:** `master`  ·  **HEAD:** `fd78e99` (commit consolidado del día con sign-off + barrida deuda + perf STT + Fase 8 + audit retention)  ·  **Suite:** 449/449 verdes · typecheck limpio
**Sesión:** sign-off founder de los 2 prompts que quedaban gateados (`OPUS_GENERADOR_CASOS_PROMPT_READY` y `OPUS_VALIDADOR_CASOS_PROMPT_READY`). Founder pidió rewrite "100% detallado, específico y alineado a la meta de cada uno, con búsqueda web de best practices Anthropic 2025-2026". Cierra deuda alta #1 completa.

### Lo que se hizo

**Research best practices (subagente general-purpose, ~3 min):**
- Consulta a docs.anthropic.com, anthropic-cookbook, blog Anthropic, AI SDK Vercel docs. Brief de ~2500 palabras con 7 bullets accionables.
- Hallazgos aplicados: XML tags canónicos (`role`, `context`, `constraints`, `methodology`, `output_format`, `examples`); instrucciones positivas en lugar de negativas (best-practices Claude 4.7: *"positive examples tend to be more effective"*); palabra "think/thinking" removida del system body (Opus 4.5+ keyword sensible que puede sobre-disparar extended thinking); patrón LLM-as-judge canónico (razonamiento criterio-por-criterio en orden fijo antes del veredicto, fallback "evidencia_insuficiente").

**Wire-up validado runtime AI SDK (`@ai-sdk/anthropic@3.0.77` + `ai@6.0.180`):**
- `effort` GA en provider options (no requiere beta header — quitado en commit del SDK upstream). Valores: low/medium/high/xhigh/max. xhigh válido solo para Opus 4.7.
- `cacheControl` requiere reestructurar de `system + prompt` a messages array → omitido en este sprint por consistencia con `sintesis_final.ts` que tampoco lo usa. Deuda nueva opcional para post-piloto.

**Rewrites de prompts:**
- `lib/prompts/opus_generador_casos.ts` (~570 LOC): estructura XML refinada, instrucciones positivas (reemplaza "PROHIBIDO em-dash" por "usa comas, dos puntos, paréntesis"), `<methodology>` con 7 pasos de razonamiento ordenado, `<roster_mx>` con 12 sectores + tamaños mid-market, 5 few-shots con arquetipos contrastantes (servicios profesionales CDMX, construcción Bajío, factoraje agro Sinaloa, comercio Yucatán, hotelería Quintana Roo) para anti-mode-collapse documentado en multishot doc. Pre-emit checklist conservado como positive. Runtime config movido al motor. `OPUS_GENERADOR_CASOS_PROMPT_READY = true`.
- `lib/prompts/opus_validador_casos.ts` (~340 LOC): LLM-as-judge canónico con `<criteria>` (4 checks numerados), `<methodology>` que cementa el orden de evaluación 1→2→3→4 antes del bool final, fallback "evidencia_insuficiente: <criterio>: <campo>" en lugar de "ante duda falla" (instrucción positiva), `<numeric_tolerances>` tabla con rangos por dimensión, "responde directamente" explícito para suprimir thinking con `effort=low`. 5 few-shots (1 pasa + 4 fallas por causa distinta incluyendo evidencia insuficiente). `OPUS_VALIDADOR_CASOS_PROMPT_READY = true`.

**Wire-up runtime (`lib/motor/casos_sinteticos.ts`):**
- Generador L131-176: `providerOptions.anthropic = { thinking: { type: 'adaptive' }, effort: 'high' }`. Comentario explicando que `high` es el mínimo Anthropic para intelligence-sensitive, subir a xhigh solo si evals muestran under-thinking.
- Validador L155-180: modelo cambiado de `claude-opus-4-7` a `claude-sonnet-4-6`, `providerOptions.anthropic = { effort: 'low' }`. Comentario aclarando que el archivo conserva prefijo `opus_` por convención pero el modelo runtime es Sonnet (latencia <2s declarada en header).

### Pendientes / blockers

**Sin nuevos.** El item #1 de deuda alta cierra completo. La validación empírica del pipeline real (con caso sintético generado vivo en entrevista) queda como parte del re-smoke voz founder, ya listado en `STATUS.md §3.1`.

### Cómo retomar

- Si el founder corre re-smoke con voz y aparece `solicitar_caso_sintetico` en una respuesta de Sonnet director: el pipeline ahora va a ejecutar real (no devuelve `pipeline_not_ready`). Generación Opus 4.7 ~8-15s + validación Sonnet 4.6 ~1.5s + persistencia en `casos_generados` con estado `'generado'` o `'validacion_fallida'`. Costo estimado por caso ~$0.10-0.15 USD (Opus generador con `effort=high` adaptive thinking domina el costo).
- Si las validaciones empíricas muestran que Opus genera casos OK pero Sonnet validador es demasiado estricto (false negatives): bajar `effort` no aplica (ya está en `low`); revisar few-shots del validador o aflojar tolerancias en `<numeric_tolerances>`.
- Si genera casos repetidos a pesar de los 5 arquetipos en few-shots: agregar más diversidad al `<roster_mx>` o inyectar un "evita estos arquetipos" más explícito en `buildGeneradorPrompt()`.

---

## 2026-05-13 — Latencia STT (parte 2): AudioWorklet + pre-mint token RSC + pre-warm mic + region iad1

**Branch:** `master`  ·  **Suite:** 449/449 verdes · typecheck limpio · next build OK
**Sesión:** ola grande de reducción de latencia click→primer transcript, después de 3 agentes en paralelo investigando best practices Deepgram, browser audio pipeline, y Vercel side. Costo $0 API extra.

### Lo que se hizo

**Quick wins (cero riesgo):**
- `lib/stt/use-deepgram-stream.ts`: timeslice del recorder ya no aplica (migrado a AudioWorklet, ver abajo). `AudioContext({latencyHint:'interactive', sampleRate:16000})` para reducir buffer interno + evitar resample del mic.
- `app/api/stt/token/route.ts`: `export const preferredRegion = 'iad1'` + `runtime = 'nodejs'`. Pin a us-east-1 match con Neon US + Deepgram US default (sin esto la Fluid Compute puede arrancar en gru1/cdg1 y pagar ~80-200ms transatlántico).

**AudioWorklet + linear16 PCM (deuda alta cerrada):**
- `public/stt/pcm-worklet.js` (nuevo): `AudioWorkletProcessor` que downsample 48kHz→16kHz y emite Int16 PCM crudo vía `port.postMessage(ArrayBuffer)` con transfer zero-copy. Outputea silencio (gain=0 → destination) para mantener el grafo activo cross-browser.
- `lib/stt/client.ts`: `STT_LIVE_CONFIG` agregado `encoding: 'linear16'`, `sample_rate: '16000'`, `channels: '1'` — Deepgram recibe PCM directo sin container.
- `lib/stt/use-deepgram-stream.ts`: refactor grande. Eliminado MediaRecorder + pickAudioMimeType + buffer-por-chunks. Agregado `setupPcmWorklet`, `ensureAudioGraph` (helper compartido para ctx + source entre worklet y analyser), `installWorkletHandler`. Cold-start buffer ahora es por bytes (`BUFFER_MAX_BYTES = 320_000` ≈ 10s @ 16kHz Int16). `visibilitychange` ahora suspend/resume del AudioContext en lugar de pausar el recorder.
- `lib/stt/drain-buffer.test.ts`: tests reescritos para `ArrayBuffer[]` + `BUFFER_MAX_BYTES`.
- Saca ~150-300ms del path crítico al eliminar buffering interno del MediaRecorder + container muxing del WebM/Opus.

**Pre-mint token Deepgram en RSC:**
- `app/entrevista/[sesion_id]/page.tsx`: `grantEphemeralToken(60)` ejecuta en `Promise.all` junto con `cargarRehidratacion`. Si el grant falla server-side (Deepgram down), loggea warn y pasa null — sin regresión. Token pasado al shell con `expiresAt: Date.now() + (expires_in - 5)*1000`.
- `lib/stt/use-deepgram-stream.ts`: nueva interface `InitialSttToken` + opción `initialToken`. Si el token aún vive (>5s margen vs expiresAt), `start()` lo usa directo y skip el POST `/api/stt/token`. Consumido una sola vez; siguientes starts fetchean normal.
- `entrevista-shell.tsx` + `HeroPregunta.tsx`: prop drilling del token RSC → hook.
- Saca ~200-400ms del PRIMER click del mic (post-mount).

**Pre-warm getUserMedia al mount:**
- `lib/stt/use-deepgram-stream.ts`: opción `prewarmMicOnMount`. Si `navigator.permissions.query({name:'microphone'})` reporta 'granted', el hook adquiere el stream al mount; `start()` lo reusa saltando getUserMedia. Validación de readyState antes de reusar (stale streams se descartan y fallback al getUserMedia normal). Cleanup en unmount si nunca se consumió.
- `HeroPregunta.tsx`: prendido para STT enabled. En cold-first-visit (permission='prompt') no hace nada — no quema el prompt sin gesture.
- Saca ~100-300ms del click cuando el user ya autorizó el mic (caso típico durante una sesión).

**Suma estimada vs baseline:** click → primer interim transcript shaved ~600-1200ms con estas optimizaciones combinadas (paralelizar token + AudioWorklet + pre-mint RSC + pre-warm mic + region pin + AudioContext interactive). Confirmar empíricamente con `metrics.timeToOpenMs` y `timeToFirstTranscriptMs` en re-smoke voz.

### Pendientes / blockers

- Pre-warm WS al mount (Plan B): documentado pero NO implementado en esta sesión. Requiere un estado intermedio "prewarmed_socket" en el hook y manejo separado de token-refresh durante el prewarm. Ganancia incremental ~300-800ms sobre lo logrado, pero complejidad alta. Lo dejo como "next sprint" antes que ship con regresión.
- Confirmar AudioWorklet en Safari móvil — el AudioWorklet es estándar pero algunos paths edge necesitan verificación (iOS gestures, `outputChannelCount` quirks). Probar en re-smoke voz.

### Cómo retomar

- Para activar Pre-warm WS: agregar opción `prewarmSocketOnMount` al hook, modo prewarm en `boot()` que abre WS + KeepAlive SIN setState('streaming'), `start()` reusa socket abierto y solo arranca worklet. Cuidado con token-refresh si el user tarda >55s antes de clickear.
- Para medir empíricamente: agregar al telemetry channel los valores de `metrics.timeToOpenMs` y `timeToFirstTranscriptMs` (ya expuestos por el hook).

---

## 2026-05-13 — Latencia mic click → streaming (paralelizar token fetch + press feedback)

**Branch:** `master`  ·  **Suite:** 449/449 verdes · typecheck limpio
**Sesión:** founder reportó delay perceptible entre presionar el MicButton y entrar a `status='streaming'`. Auditoría del pipeline y dos intervenciones quirúrgicas.

### Lo que se hizo

- `lib/stt/use-deepgram-stream.ts`: `fetchEphemeralToken()` ahora se dispara EN PARALELO con `getUserMedia` en `start()`. Antes corría serial dentro de `boot()` después de la adquisición del mic, sumando el POST `/api/stt/token` (CSRF + DB SELECT + Deepgram grant ~150-400ms) al wall-clock click→streaming. `boot()` ahora acepta un `tokenPromise` opcional pre-flying; los retries vía `scheduleRetry(boot)` siguen minteando token fresco al llamar `boot()` sin args (el token original 60s puede haber caducado en backoff). El `.catch(() => undefined)` silencia unhandled-rejection si `getUserMedia` falla antes que el token resuelva.
- `components/stt/MicButton.tsx`: agregado `cursor-pointer active:scale-95`. Press feedback inmediato en el frame del click (Tailwind anima vía la `transition-all duration-150` que ya tenía); sin esto el botón se sentía "muerto" hasta que React rerendereaba con el spinner.

### Impacto esperado

- Click → streaming: -150 a -400ms en el escenario mic-ya-autorizado (que es la mayoría de los casos durante una sesión, después del primer prompt).
- Primer activation: el token fetch queda completamente escondido detrás del permission prompt (~500-3000ms) — efectivamente 0 costo añadido.
- Cold-start buffer del recorder: menos chunks bufferean antes del WS open porque el socket abre antes; tiempo a primera transcripción también mejora.

### Pendientes / blockers

- Ninguno bloqueante. Validación empírica de la mejora pendiente para el re-smoke voz del founder (medible vía `metrics.timeToOpenMs` y `timeToFirstTranscriptMs` que el hook ya expone).

### Cómo retomar

- Si se quiere bajar aún más la latencia, el siguiente candidato es deferir `startAudioLevelMeter` al `socket.on('open')` (saca ~5-50ms del path crítico en primer arranque por la creación de AudioContext). Marginal — no priorizar.

---

## 2026-05-13 — Barrido de deuda técnica (Olas 0-5) + sincronización docs

**Branch:** `master`  ·  **Suite:** 449/449 verdes (+6 nuevos toggle) · typecheck limpio
**Sesión:** auditoría comparativa STATUS vs código real, sync docs canónicos, cierre de 7 deudas (4 cerradas completas + 2 parciales + 1 con plan revisado).

### Lo que se hizo

**Ola 0 — Sincronización docs (gaps detectados en auditoría):**
- `STATUS.md`: corregida contradicción §3.2 sobre sub-paso 5.iv (director Opus SIGNED OFF, solo generador/validador casos pendientes). Referencia explícita a `IMPLEMENTATION.md §22` desde §3.1. Migraciones DB extendidas a 0002, 0004, 0006, 0007, 0008. §8 actualizado con material vivo (design research admin redesign).
- `IMPLEMENTATION.md`: §19 Google SSO movido a §20 (resuelto en `cc7de99` + migración 0006). §22.1 corregida sobre `pdf_url` (no existía, ahora agregada en 0007). §22.1 listado completo de migraciones 0000-0007. Header con nota de revisión 2026-05-13.
- `docs/DEUDA_TECNICA.md`: deuda #3 (STT keyterms) marcada cerrada (`53485b9`, 33 términos). 3 deudas nuevas baja prioridad (#15 `@ts-nocheck` pragmas, #16 v2 `array<string>` enum, #17 v2 multi-turn memory).

**Ola 1.3 — Migración 0007:** `db/migrations/0007_add_pdf_url.sql` + columna en `db/schema.ts`. Aplicada al test branch para que integration tests pasen.

**Ola 2 — Deuda alta cerrada (3 items):**
- Deuda #2 bug O3 race condition (cerrada): nueva action `togglearMarcada(preguntaId)` atómica en `lib/state/entrevista.ts` (no cierra sobre prop stale). `HeroPregunta` cambió signature `onToggleMarcada: () => void`. 6 tests nuevos `lib/state/entrevista-toggle.test.ts`.
- Deuda #1 sub-paso 5.iv parcial (cableado completo): `lib/motor/casos_sinteticos.ts` (nuevo, ~220 LOC) con pipeline real Opus generador + validador + persistencia + cap global. Gated por `OPUS_GENERADOR_CASOS_PROMPT_READY` y `OPUS_VALIDADOR_CASOS_PROMPT_READY` (ambos `false`). Stub en `app/api/turn/route.ts` reemplazado. Pendiente: founder sign-off de los 2 prompts.
- Fase 8 storage Blob (75% cerrada): `lib/storage/blob.ts` (nuevo) con `uploadPdfToBlob` gated por `BLOB_READ_WRITE_TOKEN`. Dynamic import via Function constructor evita romper build si `@vercel/blob` no está instalado. `sintetizarSesion.ts` ahora persiste `pdf_url` via UPDATE atómico tras subida exitosa.

**Ola 3 — Deuda media (2 items):**
- Deuda #7 audit log retention (cerrada): migración `0008_audit_indexes.sql` + indexes Drizzle. Cron Inngest `purgar-audit-log` diario 03:00 UTC con 2 buckets (90d para `auth.*`/`exports.*`/`login*`, 365d para destructivas). DELETE batched 1000 filas.
- Deuda #6 `z.unknown()` (plan revisado): análisis reveló refactor completo es 6-8h (no 2-3h). Plan B (type-narrow generic) documentado como alternativa 2h. No bloqueante.

**Ola 4 — Deuda baja (4 items):**
- Deuda #8 `fuente: 'usuario_tipea'` discriminator (cerrada): cliente envía header `X-Vertice-Input-Source: voice|keyboard|mixed` computado desde `preguntas_con_stt`. Server mapea a enum `usuario_voz` o `usuario_tipea`.
- Deuda #9 chime mute toggle (cerrada): `lib/stt/chime.ts` con `isChimeMuted()`/`setChimeMuted()` + localStorage. `components/entrevista/ChimeMuteToggle.tsx` (nuevo) con hydration guard. Toggle en header del shell.
- Deuda #11 O2 STT `pauseDetected` (cerrada): `handleResult` reconoce `SpeechStarted` y `UtteranceEnd` de Deepgram VAD events. Polling sobre `lastAudioAtRef` se mantiene como fallback defensivo.
- Deuda #15 `@ts-nocheck` pragmas (parcial): removido de `app/api/stt/token/route.test.ts`. El de `use-deepgram-stream.test.ts` sigue gated por `@testing-library/react` no instalada.

**Ola 5 — Cierre administrativo IMPLEMENTATION.md:** §19 Google SSO migrado a §20 con decisiones arquitectónicas tomadas. Header con nota de revisión.

### Pendientes / blockers

**[USER] Provisioning (no cambia respecto a sesión previa, pero ahora 0007 y 0008 incluidas):**
- Aplicar migraciones DB `0002`, `0004`, `0006`, `0007`, `0008` a `vertice-mvp/main`.
- Provisionar Upstash Redis + las 7 keys prod (incluye `BLOB_READ_WRITE_TOKEN`).
- `npm i @vercel/blob` (necesario para activar Fase 8 storage real).
- Re-smoke voz + smoke prod + pilotos (ver `IMPLEMENTATION.md §22`).

**[USER] Sign-offs de prompts founder (bloquean deuda #1):**
- Validar `lib/prompts/opus_generador_casos.ts` y flippar `OPUS_GENERADOR_CASOS_PROMPT_READY = true`.
- Validar `lib/prompts/opus_validador_casos.ts` y flippar `OPUS_VALIDADOR_CASOS_PROMPT_READY = true`.

**Deuda restante (post-piloto):** #5 cobertura tests admin, #6 z.unknown plan B, #10 O2 BatchNav desync, #12 tests STT hook RTL, #13 Wave 2 admin, #14 mobile responsive, #15 (parte 2), #16 (v2), #17 (v2).

### Cómo retomar

1. Leer `STATUS.md §2` (Fase 5 al ~90%, Fase 8 al ~75%).
2. Revisar `docs/DEUDA_TECNICA.md` (todos los 🔴 alta están parcial o cerrados).
3. Si toca migraciones prod: `IMPLEMENTATION.md §22.1`.
4. Si toca firmar prompts Opus: `lib/prompts/opus_generador_casos.ts` + `opus_validador_casos.ts` — pipeline cableado, solo flippar 2 flags.

---

## 2026-05-13 — Fix modal Nueva institución: backdrop blur cubre todo

**Branch:** `master`  ·  **Suite:** typecheck limpio
**Sesión:** el modal de "Nueva institución" en `/admin/instituciones` dejaba el AdminHeader sticky (z-50) y otros containers visibles por encima del backdrop. El `fixed inset-0 z-[100]` del modal estaba contenido dentro del `AdminScrollArea` Viewport (hijo del `data-admin-shell fixed inset-0` del layout), no del viewport real del browser.

### Lo que se hizo

- `components/admin/nueva-institucion-modal.tsx`: portar `ModalContent` a `document.body` con `createPortal` para escapar del `AdminScrollArea`. Guard SSR via `typeof document === 'undefined'`.
- Subir backdrop de `bg-ink/45 backdrop-blur-[6px]` → `bg-ink/55 backdrop-blur-md` para mirror del command-palette del propio admin (consistencia visual del depth en modales del shell admin).
- E2E validado con Claude Chrome: DOM confirma `modalIsPortaled: true`, `z-index: 100`, `backdrop-filter: blur(12px)`, modal como último hijo de `<body>`. Visualmente: header sticky + cards + search + lista de instituciones todos blureados en 2do plano.

### Pendientes / blockers

Sin nuevos. (Nota observada, no parte del goal: click outside no cierra el modal porque el centering wrapper sibling captura el evento antes del backdrop. Preexistente, bajo prioridad).

### Cómo retomar

- Cambio aislado a un solo componente UI; no requiere migración ni env. Si abren otros modales admin con mismo síntoma (header en primer plano), aplicar el mismo patrón portal.

---

## 2026-05-13 — Segunda pasada de limpieza (workspace + tracked artifacts)

**Branch:** `master`  ·  **Suite:** typecheck limpio
**Sesión:** sweep amplio del workspace post-consolidación de docs. Eliminados artefactos tracked obsoletos y carpetas locales pesadas.

### Lo que se hizo

- **Branches locales borrados:** `feat/wire-opus-director` (PR #4 ya mergeado a master en `70189b5`) y `backup/admin-wave-1-local` (rediseño wave 1 ya en master).
- **Screenshots tracked archivados:** `.ui-design/reviews/` (42 archivos, 7 MB) → `docs/archive/reviews/admin-wave-1-screenshots/`. `.ui-design/` agregado al `.gitignore`.
- **Source material en raíz reorganizada:**
  - Borrados sin uso: `Vertice_GuionCasos_REFERENCE.pdf`, `guion_extracted.txt`, `guion_mini_extracted.txt` (-648 KB).
  - Movido `guion-casos-mini.pdf` → `docs/reference/guion-casos-mini.pdf` (referenciado en `db/seeds/safe_rails_casos.ts:1`, comentario actualizado).
- **Scripts archivados:** 9 smokes históricos (`pipeline_e2e_mini`, `smoke_3cajas_e2e/turn1`, `smoke_auth`, `smoke_motor`, `smoke_tools`, `test_sintesis_solo`, `d3_sintesis_smoke`, `smoke_batch_capture`) → `scripts/_archive/`. `tsconfig.json` excluye la carpeta para que sus imports relativos rotos no fallen typecheck. `scripts/` queda con 7 activos.
- **Rutas exploratorias:** `app/preview/consent/` eliminado (F1 ya promovido a real). `app/preview/ui/` y `app/demo/stt/` mantenidos como sandboxes dev-only.
- **Carpetas locales gitignored borradas:** `.next/` (171 MB), `.tmp_design_audit/`, `.claude/screens/`, `.audit/`, `.playwright-mcp/`, `.superpowers/`, `.tmp-f1-consent-preview.png`.
- **`.gitignore` actualizado:** agregado `.ui-design/` + patrón `/.tmp-*.png` para evitar que futuros artefactos temporales entren al repo.

### Pendientes / blockers

Sin nuevos. Los anteriores siguen vigentes (ver `STATUS.md` §3).

### Cómo retomar

- Próximo `npm run dev` regenera `.next/`.
- Si necesitas referencia de algún smoke histórico, está en `scripts/_archive/` (no se ejecuta, solo lectura).
- Si necesitas screenshots admin wave 1, están en `docs/archive/reviews/admin-wave-1-screenshots/`.

---

## 2026-05-13 — Limpieza del workspace + docs canónicos

**Branch:** `feat/promote-consent-f1-to-real`  ·  **HEAD aprox:** `6a7f4b0`
**Sesión:** consolidación de docs de progreso. Reemplazo de la maraña de CHECKPOINT.md, alpha-readiness, smoke-*, HANDOFF, bugs-*, plans, specs por dos documentos canónicos.

### Lo que se hizo

- Creada estructura `docs/archive/` con subcarpetas `checkpoints/`, `plans/`, `specs/`, `smokes/`, `bugs/`, `reviews/`, `handoff/`.
- Movidos a archive: `CHECKPOINT.md` raíz, `.claude/CHECKPOINT.md`, `.claude/CHECKPOINT_UI.md`, `docs/alpha-readiness-2026-05-12.md`, `docs/smoke-entrevista-real-2026-05-12.md`, `docs/HANDOFF.md`, `docs/sprint-2-upstash-checkpoint.md`, `docs/bugs-encontrados-2026-05-11-{stt,e2e}.md`, `docs/pr4-review-notes.md`, 5 plans + 4 specs + 1 checkpoint de `docs/superpowers/`, `.ui-design/reviews/admin_panel_20260511.md`.
- Renombrado `docs/deuda-tecnica-2026-05-12.md` → `docs/DEUDA_TECNICA.md` (doc vivo, no histórico).
- Creado `STATUS.md` en la raíz como source of truth: TL;DR, estado por fase, qué falta para producción, deuda técnica resumen, bugs documentados, convención para agentes.
- Creado `CHECKPOINTS.md` en la raíz con formato estándar y esta primera entrada de consolidación.
- Creado/actualizado `CLAUDE.md` del proyecto con anclaje obligatorio: leer STATUS.md primero, actualizarlo durante la sesión, agregar checkpoint al cerrar.

### Pendientes / blockers

- [USER] Provisionar Upstash Redis y pegar credenciales (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) en `.env.local`. Sprint 2 rate-limit code-complete con fallback; falta solo provisioning.
- [USER] Re-smoke entrevista entera con voz (≥10 turnos) midiendo p50/p95 + WER + USD.
- [USER] F2 validación en producción: dictar primer batch, capturar batch que Sonnet emite, validar formato.
- [USER] Aprovisionar keys Vercel + migraciones DB + alertas Axiom + smoke prod (ver `STATUS.md` §3.1).
- [USER] Commitear `.env.example`, `.env.local`, `lib/env.ts` modificados + esta limpieza de docs cuando los revises.

### Cómo retomar

1. Leer `STATUS.md` entero (5 min). Es la fuente de verdad de qué hace falta.
2. Revisar `CHECKPOINTS.md` (este doc) última entrada — siempre arriba.
3. Si la tarea toca código, ir a la fase correspondiente en `IMPLEMENTATION.md`.
4. Si la tarea es cerrar deuda, ir a `docs/DEUDA_TECNICA.md`.
5. Al terminar, agregar entrada nueva acá arriba y actualizar STATUS si corresponde.

---

## Histórico previo (consolidado)

Las sesiones previas a esta consolidación vivieron en archivos sueltos. Todos archivados en `docs/archive/`. Resumen cronológico inverso (más reciente arriba) para referencia rápida:

### 2026-05-13 — Sprint 2 Upstash rate-limit (code-complete, pending provisioning)
Refactor de `lib/security/rate-limit.ts` a async con Upstash Redis (con fallback in-memory). Suite 439/439 verde. Cambios laterales: middleware admin acepta `__Secure-vertice_auth` (Auth.js v6), mensajes UX en `acceso/expirado` para razones SSO, `AUTH_URL` opcional en `lib/env.ts`. Detalle: `docs/archive/checkpoints/2026-05-13-sprint-2-upstash.md`.

### 2026-05-12 eve — F2 implementación + E2E parcial
Cierre técnico de F2 (preguntas cortas + formato pregunta). Schema `auxiliar?` en `Pregunta`, bloque `<formato_pregunta>` en system prompt Sonnet con 8 reglas + 5 ejemplos, `PRIMER_BATCH_BIENVENIDA` reescrito (5 cajas → 2 preguntas tight). 423 tests verdes. Pendiente: dictado founder. Detalle: `docs/archive/handoff/2026-05-12-handoff.md`.

### 2026-05-12 PM — Pre-alpha hardening
Server-side gate `solicitar_review_seccion` en `lib/motor/review-gate.ts` (250 LOC, latencia esperada 120s → 30s). Guard O3 (1 batch por turno). STT cold-start audio buffer. STT keyterms regulatorios MX (20 acrónimos). Prompt Sonnet endurecido. 3 bugs modal admin nueva-institucion. +52 tests nuevos. Detalle: `docs/archive/smokes/2026-05-12-alpha-readiness.md`.

### 2026-05-12 AM — Smoke E2E real con voz
Primer smoke real con voz dictada en `/entrevista/[id]`. 2 turnos completos, sidebar 0→6 cajas. Identificados 3 bloqueantes (latencia 124s, WER acrónimos, duplicación STT) + 2 pendientes founder (F1 consent, F2 prompts). Detalle: `docs/archive/smokes/2026-05-12-smoke-entrevista-real.md`.

### 2026-05-11 — Smoke STT cerrado (PR #21)
7/7 escenarios STT validados en `/demo/stt` con voz real. 5 fixes principales: `socket.connect()` explícito SDK v5.1.0, JWT vía subprotocol `['bearer', token]`, `smart_format` omitido, TranscriptionPanel single contentEditable + snapshot pattern, Deepgram key role Member. Detalle: `docs/archive/bugs/2026-05-11-stt.md`.

### 2026-05-10 — UI refactor entrevista (cards unificadas)
Sesión larga de refactor visual: Stepper rewrite v5 (spine vertical + iconos), Card 1 navy header, layout 2col global, HeroPregunta rewrite, buttons design system landing, anti layout-shift (CLS 0.0066, zero horizontal shift). Detalle: `docs/archive/checkpoints/2026-05-10-ui-refactor-entrevista.md`.

### 2026-05-09 — UI refactor cards unificadas (plan)
Plan ejecutado en sesión siguiente. Detalle: `docs/archive/checkpoints/2026-05-09-ui-refactor-cards-unificadas.md`.

### 2026-05-08 — Design research + design system extraction
13 archivos +1983 líneas en `docs/design/`. Research mayo 2026 (5 agentes paralelos), browse manual awwwards, design system actual extraído, plan de refactor en 4 sprints para `/preview/ui`. Detalle: `docs/archive/checkpoints/2026-05-08-design-research.md`.
