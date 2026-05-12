# Handoff — empezar desde cero en otra compu

**Última actualización:** 2026-05-12 post pre-alpha hardening.
**Branch canónica:** `master` (`origin/master` está al día).
**Estado testing:** suite 44 archivos / 420 tests verdes · typecheck limpio · `next build` OK.

Este doc es el punto de entrada para retomar el proyecto en una computadora distinta. Lee en orden:

1. Este HANDOFF (5 min).
2. **`docs/alpha-readiness-2026-05-12.md`** — reporte CTO con qué está cerrado técnicamente y qué requiere acción founder antes del primer aliado. Punto de entrada para entender el estado actual.
3. `docs/smoke-entrevista-real-2026-05-12.md` — smoke real con voz que motivó los hardening fixes.
4. `docs/bugs-encontrados-2026-05-11-stt.md` — bugs STT del smoke aislado en `/demo/stt` (PR #21).
5. `docs/bugs-encontrados-2026-05-11-e2e.md` — bugs del E2E previo del motor.
6. `README.md` + `IMPLEMENTATION.md` — overview general del proyecto.

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

**Fase actual:** post pre-alpha hardening. Bloqueantes técnicos del smoke 2026-05-12 AM cerrados. Faltan 2 piezas creativas (F1/F2) + re-smoke + infra prod antes del primer aliado.

### 1. F1 — Rediseñar consent al Design System (1.5-2h) — REQUIERE INPUT FOUNDER

`app/entrevista/[sesion_id]/bienvenida/page.tsx` usa estilos inline + colores hardcoded. Migrar a tokens DS (`cream-pure`, `ink`, `gold`, hairlines), display H1 con clamp, eyebrow `gold-deep`, botón ink/cream solid pill, checkbox custom.

Referencia visual: `components/entrevista/HeroPregunta.tsx` + `app/entrevista/[sesion_id]/entrevista-shell.tsx`.
Detalle: `docs/smoke-entrevista-real-2026-05-12.md` sección "Founder feedback post-smoke" F1.

### 2. F2 — Prompts Sonnet: preguntas más cortas y formato pregunta (2-3h) — REQUIERE INPUT FOUNDER

Las preguntas que Sonnet emite (y `PRIMER_BATCH_BIENVENIDA` hardcoded) son listas largas o tienen preamble conversacional largo. Requisitos:
- Máx 2 líneas (~25 palabras).
- Empiezan con interrogativa (¿Qué…?, ¿Cómo…?, ¿Cuánto…?).
- Preamble separado al campo `auxiliar` (ya soportado por `splitPreguntaYAuxiliar` en `HeroPregunta.tsx`).
- Una pregunta = una caja idealmente.

Archivos: `lib/prompts/sonnet_fase1.ts` + `lib/state/entrevista.ts` (`PRIMER_BATCH_BIENVENIDA`).
Detalle con ejemplos malos vs buenos: `docs/smoke-entrevista-real-2026-05-12.md` sección F2.

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
