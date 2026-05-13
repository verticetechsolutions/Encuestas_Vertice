# Handoff — empezar desde cero en otra compu

**Última actualización:** 2026-05-12 — checkpoint E2E F2 (dictado pendiente).
**Branch canónica:** `master` (`origin/master` al día con commit F2).
**Estado testing:** suite 44 archivos / **423 tests** verdes · typecheck limpio en archivos F2 · `next build` OK.

> ⚠️ **Checkpoint activo — RETOMAR AQUÍ**: el commit F2 cerró prompts Sonnet + schema + UI wiring, validó renderizado en `/preview/ui` y en sesión real (primer batch). **Lo pendiente es el dictado del founder + captura del batch que Sonnet emite tras turn 1, para validar formato y latencia**. Detalle completo en sección "Checkpoint E2E F2" al final.

Este doc es el punto de entrada para retomar el proyecto en una computadora distinta. Lee en orden:

1. Este HANDOFF (5 min).
2. **`docs/alpha-readiness-2026-05-12.md`** — reporte CTO con qué está cerrado técnicamente y qué requiere acción founder antes del primer aliado. Punto de entrada para entender el estado actual.
3. **`docs/deuda-tecnica-2026-05-12.md`** — inventario priorizado de items para cerrar en sesiones aparte (14 items, ninguno bloquea el primer piloto pero deben cerrarse antes del 2do/3er aliado).
4. `docs/smoke-entrevista-real-2026-05-12.md` — smoke real con voz que motivó los hardening fixes.
5. `docs/bugs-encontrados-2026-05-11-stt.md` — bugs STT del smoke aislado en `/demo/stt` (PR #21).
6. `docs/bugs-encontrados-2026-05-11-e2e.md` — bugs del E2E previo del motor.
7. `README.md` + `IMPLEMENTATION.md` — overview general del proyecto.

---

## Setup desde cero

```bash
# 1. Clonar
git clone git@github.com:verticetechsolutions/vertice.git Vertice_Encuesta
cd Vertice_Encuesta

# 2. Confirmar master al día
git pull origin master
git log -1 --oneline   # debería empezar por 49a2a8e o más reciente

# 3. Dependencias
npm install            # Node 20+, npm 10+ recomendado

# 4. .env.local YA viene en el repo trackeado (decisión multi-machine dev, commit 212b0d0)
# Verificar que tiene: ANTHROPIC_API_KEY, DEEPGRAM_API_KEY (role Member), DATABASE_URL Neon, ADMIN_PANEL_TOKEN, RESEND_API_KEY, INNGEST_*, AXIOM_*, SENTRY_*.
cat .env.local | head -3

# 5. Dev server
npm run dev            # puerto 3000 (Turbopack)
```

Si `:3000` está ocupado, Next arranca en `:3001` automáticamente y avisa en stdout.

---

## ¿Qué se hizo en las últimas sesiones?

### 2026-05-12 eve — F2 implementación + E2E parcial (commit F2)

Cierre técnico de F2 (preguntas cortas + formato pregunta). Detalle de diseño y reglas en `<formato_pregunta>` dentro de `lib/prompts/sonnet_fase1.ts`.

**Cambios commiteados:**
- **Schema `auxiliar?` en `Pregunta`** (`lib/schemas/pregunta-batch.ts` + `lib/motor/tools.ts`) — campo opcional ≤200 chars para preamble/framing renderizado debajo del hero. Backwards-compat: batches viejos siguen funcionando vía heurístico `splitPreguntaYAuxiliar` legacy en HeroPregunta.
- **Bloque `<formato_pregunta>` en system prompt** — 8 reglas terse + 5 ejemplos bad→good (open/numérica/booleana/follow-up/sensible) + descripción tool actualizada. Bullet de `<role>` ajustado: yes/no permitido SOLO cuando caja_objetivo es booleana.
- **Heros de los 3 few-shots existentes recortados** al formato nuevo (preguntas ≤25 palabras, auxiliar separado).
- **`PRIMER_BATCH_BIENVENIDA` reescrito**: 1 pregunta-Frankenstein (5 cajas) → 2 preguntas tight con auxiliar (Q1 identidad: razón social + nombre comercial + tipo; Q2 regulación: reguladores + años).
- **Forward del campo `auxiliar`** en `app/api/turn/route.ts` (persist a `ultimo_batch`) y en `lib/state/entrevista.ts:extractBatchFromUIMessage` (consume del stream).
- **`HeroPregunta.tsx:resolverPreguntaYAuxiliar`** — prefiere campo explícito sobre split heurístico.
- **`FIXTURE_BATCH_MOCK`** actualizado al formato nuevo (preview/QA UI).
- **Tests +3** en `pregunta-batch.test.ts` (auxiliar opcional, auxiliar válido, rechazo >200 chars).

**E2E parcial validado:**
- ✓ UI renderizado en `/preview/ui`: 3 preguntas fixture renderizan hero corto + auxiliar gris debajo.
- ✓ Live entrevista en `/entrevista/[id]` con magic link real: PRIMER_BATCH_BIENVENIDA renderiza Q1 ("¿Cómo se llama tu institución y qué tipo es?") y Q2 ("¿Bajo qué reguladores operan y desde cuándo?") con sus auxiliares.

**Pendiente del checkpoint** (ver sección "Checkpoint E2E F2" al final):
- Dictado del founder de Q1 + Q2 con mic real.
- Captura del batch que Sonnet emite tras turn 1.
- Validación de formato (≤30 palabras, empieza con interrogativa, auxiliar opcional).
- Medición de latencia turn p50.

### 2026-05-12 PM — Pre-alpha hardening (commiteado en master)

Cierre técnico de los bloqueantes identificados en el smoke AM. Ver detalle completo en `docs/alpha-readiness-2026-05-12.md`.

**Fixes arquitectónicos:**
- **Server-side gate `solicitar_review_seccion`** (`lib/motor/review-gate.ts`, ~250 LOC) — rechaza review prematura ANTES de invocar Opus (call de 30-60s con thinking adaptive). 3 precondiciones: G1 already_closed, G2 snapshot_not_in_grupo, G3 critical_cajas_actionable. Latencia turn p50 esperada: 120s → ~30s.
- **Guard O3 — 1 batch por turno** en `app/api/turn/route.ts` (closure flag). Subsecuentes calls reciben tool_result error sin mutar state.
- **STT cold-start audio buffer** (`lib/stt/use-deepgram-stream.ts`) — MediaRecorder arranca al click del mic (no al socket.open). Buffer in-memory de hasta 10s, drena FIFO al open. Helper `drainBufferToSocket` puro.
- **STT keyterms regulatorios MX** (`lib/stt/client.ts`) — 20 acrónimos cementados (CNBV, CONDUSEF, SOFOM, DSCR, etc.). Sesga Nova-3 para reducir transposiciones (CNBV → CNVB).
- **Prompt Sonnet endurecido** (`lib/prompts/sonnet_fase1.ts`) — trigger explícito para review_seccion + mutual exclusion con generar_batch_preguntas por turno. Anti-patrón documentado.
- **SSE → UIMessageChunk converter extraído** (`lib/state/sse-to-ui-chunks.ts`) — regression guard contra bug F2.

**Modal admin nueva-institucion (3 bugs):**
- React 19 `useActionState` invocado fuera de transición → cambiar a `<form action={formAction}>` nativo + hidden input para Select shadcn.
- Dual-color seam visible en success stage (modal colapsa a 1 col pero el shape layer dual-tone persistía) → condicionar composición por stage.
- State pegado entre aperturas (success quedaba "stuck" al cerrar/reabrir) → extraer `ModalContent` que solo monta cuando `open=true`. Cada apertura = hook fresh.

**Test pack +52 tests nuevos:**
- `lib/motor/review-gate.test.ts` (16) — pure G1/G2/G3 + orquestación con DB mockeada.
- `app/api/turn/route.e2e.test.ts` (3 nuevos: tests 13-15) — gate ok/reject + 1-batch guard.
- `lib/stt/client.test.ts` (10) — keyterms regression guard.
- `lib/stt/drain-buffer.test.ts` (6) — FIFO drain + cap + throw recovery.
- `lib/state/entrevista-init.test.ts` (10) — store rehydration path (O1 client-side coverage).
- `lib/state/sse-to-ui-chunks.test.ts` (7) — converter regression (F2).

**Pendiente acción founder** (bloqueantes restantes para alpha — ver alpha-readiness §2):
- F1 rediseño consent al DS (1.5-2h).
- F2 prompts Sonnet cortos + formato pregunta (2-3h).
- Re-smoke entrevista entera con voz (medir p50/p95/USD).
- Vercel keys prod + migraciones DB + alertas Axiom.

### 2026-05-12 AM — Smoke E2E real con voz

- **Smoke E2E real con voz dictada en `/entrevista/[id]`** (no `/demo/stt`). 2 turnos completos, sidebar avanzó 0→6 cajas. Confirmó que el loop magic-link → bienvenida → consent → mic → STT → autosave → /api/turn → Sonnet → tools → DB → siguiente batch funciona end-to-end.
- **3 bloqueantes técnicos identificados**: latencia turn 124s, WER en acrónimos regulatorios (`CNBV → CNVB`), duplicación de frases con muletillas. Cerrados en hardening PM (ver arriba).
- **2 pendientes founder anotados** (F1: rediseñar consent al DS, F2: prompts Sonnet preguntas cortas). Siguen abiertos.
- **Doc**: `docs/smoke-entrevista-real-2026-05-12.md` con detalle del smoke.

### 2026-05-11 (commiteado en master)

- **PR #21 mergeado** (`49a2a8e feat(stt): smoke E2E completo + 5 fixes`).
- 7/7 escenarios STT en `/demo/stt` validados con voz real.
- Fixes principales:
  - `DEEPGRAM_API_KEY` rotada a role Member (la anterior `vertice-form` Default no tenía `tokens:write`).
  - `@deepgram/sdk@5.1.0` ahora requiere `socket.connect()` explícito post-handlers (el wrapper interno crea el WS con `startClosed:true`).
  - Browser WebSocket no entrega `Authorization` header → JWT via subprotocol `['bearer', token]`.
  - `TranscriptionPanel`: single contentEditable wrapper + snapshot pattern + editKey force remount.
  - `STT_LIVE_CONFIG`: omitido `smart_format` (causaba title-case agresivo en preposiciones españolas).
- Doc detallado: `docs/bugs-encontrados-2026-05-11-stt.md`.

### Antes (master histórico)

- Motor wirado: Opus director + síntesis Opus 4.7 con adaptive thinking. PR #4 (`70189b5`).
- E2E manual del motor con Sonnet 4.6 real, 3 bloqueantes resueltos (botón Enviar, SSE→UIMessageChunk, stopWhen=8). Doc: `docs/bugs-encontrados-2026-05-11-e2e.md`.
- Admin redesign editorial + organic + Apple (`e2856a2`).
- Magic links + admin panel funcional.

---

## Próxima sesión: qué atacar (en orden)

**Fase actual:** post F2 commit, E2E parcialmente validado (UI + primer batch). Falta dictado founder para cerrar smoke. Resto del path a alpha intacto.

### 0. Retomar checkpoint E2E F2 (15-20 min) — REQUIERE FOUNDER

Ver sección "Checkpoint E2E F2" al final del doc con pasos exactos. Sin esto no sabemos si Sonnet respeta el nuevo formato en producción.

### 1. F1 — Rediseñar consent al Design System (1.5-2h) — REQUIERE INPUT FOUNDER

`app/entrevista/[sesion_id]/bienvenida/page.tsx` usa estilos inline + colores hardcoded. Migrar a tokens DS (`cream-pure`, `ink`, `gold`, hairlines), display H1 con clamp, eyebrow `gold-deep`, botón ink/cream solid pill, checkbox custom.

Referencia visual: `components/entrevista/HeroPregunta.tsx` + `app/entrevista/[sesion_id]/entrevista-shell.tsx`.
Detalle: `docs/smoke-entrevista-real-2026-05-12.md` sección "Founder feedback post-smoke" F1.

### 2. F2 — ✓ CERRADO en commit F2 (2026-05-12 eve)

Implementación cerrada. Pendiente solo validar en producción (ver checkpoint al final).

### 3. Re-smoke entrevista entera con voz (60-90 min) — REQUIERE FOUNDER

Tras F1+F2, correr entrevista completa con dictado real, ≥10 turnos cubriendo varios grupos. Medir:
- Latencia turn p50/p95 (objetivo <30s p50 con gate review activo).
- WER muestral (objetivo <5% en acrónimos con keyterms wirados).
- Costo USD por entrevista (sumar facturas Anthropic + Deepgram).

**Criterio go alpha:** p50 < 30s + WER < 5% + costo < $5 USD/entrevista.

### 4. Pre-deploy infra Vercel (Fase 10 — IMPLEMENTATION.md §22)

Solo si #3 pasa. Requiere acceso founder:
- `BLOB_READ_WRITE_TOKEN` (storage PDF síntesis) + wirar `generar-pdf` step.
- `RESEND_API_KEY` + dominio verificado (DKIM+SPF+DMARC).
- `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `INNGEST_*`, `AXIOM_TOKEN`, `SENTRY_DSN` en Vercel env Production.
- Migraciones DB `0002` + `0004` aplicadas a `vertice-mvp/main`.
- Rotación `ADMIN_PANEL_TOKEN` + scope mínimo `AXIOM_TOKEN`.
- 3 alertas Axiom (Sonnet threshold > 40%, latencia Opus > 12s, Inngest fail > 5%).
- Smoke prod end-to-end (1 entrevista completa contra prod).

### 5. Pilotos iniciales (post-prod-smoke)

2-3 aliados con magic link + soporte directo founder + feedback form.

**Cerrado en hardening PM 2026-05-12 (NO retrabajar):**
- ✓ Latencia turn — gate server-side review_seccion (`lib/motor/review-gate.ts`).
- ✓ STT keyterms regulatorios MX (`lib/stt/client.ts`).
- ✓ Cold-start STT — audio buffer pre-socket (`lib/stt/use-deepgram-stream.ts`).
- ✓ Guard O3 — 1 batch por turno (`app/api/turn/route.ts`).
- ✓ Modal admin nueva-institucion — 3 bugs (transition + seam + reset).

**No hacer aún**: wave 2 admin redesign, mobile/iPad, O2/O3 entrevista cosméticos, migración SDK Deepgram v2.

---

## State de datos / DB

- DB: Neon Postgres. Connection string en `.env.local` (`DATABASE_URL`).
- DB test: separada (`DATABASE_URL_TEST`) — los tests `*.integration.test.ts` la truncan. NO usar la principal.
- Institución demo: `Banco Demo Vertice SA` (id `930b78e0-8323-45a9-85de-2d4fc76594cb`).
- Sesión activa para demo: id `7746c975-b3a0-49d5-8bba-16cdf4bfa87c`, status `abierta`, 6/54 cajas llenadas en 2 turnos.
- Para empezar entrevista limpia: `/admin/instituciones/930b78e0-...` → "Generar URL" → consume el link.

---

## Acceso admin

`ADMIN_PANEL_TOKEN` en `.env.local`. POST a `/admin/login` con el campo `token` lo intercambia por cookie de admin session. URL admin: `http://localhost:3000/admin`.

---

## Backup branches relevantes

- `backup/admin-wave-1-local` — 8 primitivos admin de wave 1 (SidebarNav, DataTable, etc.) descartados a favor del rediseño remoto en sesión anterior. Si alguna vez se quiere cherry-pickear algún primitivo, está ahí. Borrar cuando se confirme que no se rescatará nada.

---

## Bugs documentados, no fixeados (no urgentes)

- **O1 entrevista (`/entrevista` no rehidrata desde DB al reload)** — UX bloqueante real. `docs/bugs-encontrados-2026-05-11-e2e.md:42-52`.
- **O2 entrevista (BatchNav vs HeroPregunta desync durante AnimatePresence)** — cosmético.
- **O3 entrevista (múltiples `generar_batch_preguntas` por turno con `stopWhen=8`)** — data loss potencial. No se reprodujo en smoke 2026-05-12 pero sigue documentado.
- **O1 STT (cold-start primera palabra)** — confirmado en smoke 2026-05-12. Cae en prioridad 5 arriba.
- **O2 STT (`pauseDetected` nunca dispara via MediaRecorder)** — decorativo. Fix con `vad_events`.

---

## Si algo no funciona en la compu nueva

- Dev no arranca: verifica Node >= 20 y `npm install` corrió OK. Tests con `npm test`.
- `/api/stt/token` retorna 502: verifica que `DEEPGRAM_API_KEY` en `.env.local` sea la key con role Member (`c692761f...`), no la vieja `vertice-form` (`d527d345...`).
- `/api/turn` 503 con `sonnet_fase1_prompt_not_ready`: el flag `SONNET_FASE1_PROMPT_READY` en `lib/prompts/sonnet_fase1.ts` se quedó en false. Debería estar true.
- Magic link da `acceso_expirado`: revocaste o consumiste. Genera otro desde `/admin/instituciones/[id]` "Generar URL".

---

## Checkpoint E2E F2 — retomar aquí (2026-05-12 eve)

### Qué quedó cerrado

Commit F2 (master @ origin). 8 archivos:
- `lib/schemas/pregunta-batch.ts` + `.test.ts` (+3 tests)
- `lib/motor/tools.ts`
- `lib/prompts/sonnet_fase1.ts` (bloque `<formato_pregunta>` + ejemplos + role bullet + heros recortados + tool desc)
- `lib/state/entrevista.ts` (`PRIMER_BATCH_BIENVENIDA` reescrito + interface + extract)
- `lib/state/fixture-batch-mock.ts`
- `components/entrevista/HeroPregunta.tsx` (`resolverPreguntaYAuxiliar`)
- `app/api/turn/route.ts` (forward `auxiliar` al persistir)

Validado pre-checkpoint:
- ✓ Suite 423 tests verdes (en commit F2; typecheck limpio para archivos F2).
- ✓ `next build` OK.
- ✓ UI render en `/preview/ui`: las 3 preguntas del fixture mock muestran hero corto + auxiliar gris debajo, sin "Por ejemplo:" embebido.
- ✓ Live entrevista con magic link real consumido: PRIMER_BATCH_BIENVENIDA renderiza Q1 ("¿Cómo se llama tu institución y qué tipo es?" + auxiliar) y Q2 ("¿Bajo qué reguladores operan y desde cuándo?" + auxiliar). Counter "PREGUNTA 02 DE 02" correcto.

### Qué falta (3 pasos)

#### Paso 1 — Setup en compu nueva

```bash
# Clonar / sync
git pull origin master
git log -1 --oneline  # debería empezar por el hash del commit F2

npm install
# Verifica .env.local presente (trackeado, multi-machine)

# Importante: la compu previa tenía algo escuchando en :3000.
# Lo más probable es que en compu nueva el dev arranque limpio en :3000.
# Si :3000 está libre: npm run dev → :3000.
# Si :3000 ocupado: arranca en :3001/3003 — Next avisa.
npm run dev
```

⚠️ Hay WIP del admin (`telefono_contacto` features, `InstitucionAdminActions` component, nueva migración `0005`) que está untracked/unstaged en la compu previa. En la compu nueva NO va a estar. El admin panel sigue funcionando para lo que necesitas (generar magic link), pero si querés ese WIP, hay que recuperarlo del device anterior o re-implementarlo.

⚠️ Errores typecheck preexistentes en `app/actions/instituciones.integration.test.ts` y `scripts/invitar.ts` por la columna `telefono_contacto` agregada al schema en WIP del usuario. NO son del F2. Si querés que typecheck pase 100%, hay que agregar `telefono_contacto: null` a los fixtures de esos tests. Fuera de scope del E2E.

#### Paso 2 — Generar magic link nuevo y consumir

El link generado en compu previa (`ezj2tF4vu-8_jJCTaGguO6Hg3QG9klII`) probablemente expiró o se consumió. Genera uno nuevo:

```
1. Abrí http://localhost:3000/admin (token cookie sigue si misma compu;
   si no, postear a /admin/login con ADMIN_PANEL_TOKEN del .env.local).
2. Ir a /admin/instituciones/930b78e0-8323-45a9-85de-2d4fc76594cb
   (institución demo: Banco Demo Vertice SA).
3. Click "Generar URL". La URL aparece en bodyText de la página.
4. Abrir esa URL en otra tab. Si la URL apunta a otro port que tu dev,
   ajustá el host (DB es compartida, el token sirve).
5. Bienvenida → "Iniciar entrevista" (o auto-salta a /entrevista/[id] si
   ya consentiste antes en esa sesión).
```

Sesión que viste en compu previa: `7746c975-b3a0-49d5-8bba-16cdf4bfa87c`. Si quedó con turn 0 (sin respuestas marcadas), el magic link nuevo te lleva a esa misma sesión y verás PRIMER_BATCH_BIENVENIDA otra vez. Si la sesión ya recibió turn, vas a ver el batch que Sonnet emitió — eso ya es el dato que necesitamos validar.

#### Paso 3 — Smoke + capturar batch Sonnet

```
1. En Q1, click al mic, dictar algo natural. Ejemplo:
   "Banco Demo Vértice SA, banco. Llevamos 8 años."
   Click "Marcar respondida".
2. Click "Siguiente" → Q2. Dictar:
   "Regulados por CNBV, CONDUSEF y UIF. Desde hace 8 años."
   Click "Marcar respondida".
3. Click "Enviar respuestas".
4. Esperar el siguiente batch (latencia esperada ~30-90s con gate review).
```

**Qué medir:**
- **Latencia turn**: cronometrar click "Enviar" → batch nuevo visible. Objetivo p50 <30s. Si 60-90s, gate de review está disparando — esperable.
- **Formato del batch nuevo**: cada `texto_pregunta` debe (a) empezar con interrogativa, (b) ≤30 palabras, (c) terminar en `?`, (d) usar `auxiliar` solo cuando aporta contexto, no relleno.
- **WER en acrónimos** (CNBV/CONDUSEF/UIF): deberían transcribirse bien con keyterms wirados. Si aún hay errores tipo "CNVB", documentar.

**Cómo capturar el batch que Sonnet emitió:**

```javascript
// En DevTools de la entrevista tab, después de ver el batch nuevo:
JSON.stringify({
  batch: window.__nextZustand?.entrevista?.batch_actual ?? 'no-store-exposed',
  // o desde DOM:
  hero: Array.from(document.querySelectorAll('h2')).map(h => h.textContent),
  auxiliares: Array.from(document.querySelectorAll('article p')).map(p => p.textContent),
}, null, 2)
```

O más simple: tomar screenshots de cada pregunta del nuevo batch + el counter.

**O via DB**:
```sql
SELECT metadata->'ultimo_batch'->'batch' AS batch
FROM sesiones
WHERE id = '<session_id>';
```

#### Anti-patrones a vigilar (si Sonnet rompe formato)

Documentar si ves:
- Hero con más de 30 palabras
- Hero con preamble baked-in ("Para entender mejor X, ¿...")
- Pregunta multi-caja con "y/o también"
- Auxiliar de relleno tipo "Una pregunta rápida." que no aporta
- Yes/no en caja no-booleana

Si pasa: agarrar el ejemplo concreto y reportar. Quizá la corrección es agregar un 6to ejemplo bad→good al bloque `<ejemplos_formato_pregunta>` que cubra ese anti-patrón específico.

#### Bonus si hay tiempo: latencia turn

Re-medir contra baseline pre-hardening (124s en turn 1 del smoke 2026-05-12 AM). Objetivo go-alpha: p50 <30s + WER <5% en acrónimos + costo <$5 USD/entrevista.
