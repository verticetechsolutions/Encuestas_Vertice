# Handoff — empezar desde cero en otra compu

**Última actualización:** 2026-05-12 post-smoke entrevista real.
**Branch canónica:** `master` (`origin/master` está al día).

Este doc es el punto de entrada para retomar el proyecto en una computadora distinta. Lee en orden:

1. Este HANDOFF (5 min).
2. `docs/smoke-entrevista-real-2026-05-12.md` — último smoke, findings y plan ordenado.
3. `docs/bugs-encontrados-2026-05-11-stt.md` — bugs STT del smoke aislado en `/demo/stt` (PR #21).
4. `docs/bugs-encontrados-2026-05-11-e2e.md` — bugs del E2E previo del motor.
5. `README.md` + `IMPLEMENTATION.md` — overview general del proyecto.

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

### 2026-05-12 (esta sesión, sin commitear código nuevo aún)

- **Smoke E2E real con voz dictada en `/entrevista/[id]`** (no `/demo/stt`). 2 turnos completos, sidebar avanzó 0→6 cajas. Confirmó que el loop magic-link → bienvenida → consent → mic → STT → autosave → /api/turn → Sonnet → tools → DB → siguiente batch funciona end-to-end.
- **3 bloqueantes técnicos identificados**: latencia turn 124s, WER en acrónimos regulatorios (`CNBV → CNVB`), duplicación de frases con muletillas.
- **2 pendientes founder anotados** (F1: rediseñar consent al DS, F2: prompts Sonnet preguntas cortas).
- **Doc nuevo**: `docs/smoke-entrevista-real-2026-05-12.md` con detalle.

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

### 1. F1 — Rediseñar consent al Design System (1.5-2h)

`app/entrevista/[sesion_id]/bienvenida/page.tsx` usa estilos inline + colores hardcoded. Migrar a tokens DS (`cream-pure`, `ink`, `gold`, hairlines), display H1 con clamp, eyebrow `gold-deep`, botón ink/cream solid pill, checkbox custom.

Referencia visual: `components/entrevista/HeroPregunta.tsx` + `app/entrevista/[sesion_id]/entrevista-shell.tsx`.
Detalle: `docs/smoke-entrevista-real-2026-05-12.md` sección "Founder feedback post-smoke" F1.

### 2. F2 — Prompts Sonnet: preguntas más cortas y formato pregunta (2-3h)

Las preguntas que Sonnet emite (y `PRIMER_BATCH_BIENVENIDA` hardcoded) son listas largas o tienen preamble conversacional largo. Requisitos:
- Máx 2 líneas (~25 palabras).
- Empiezan con interrogativa (¿Qué…?, ¿Cómo…?, ¿Cuánto…?).
- Preamble separado al campo `auxiliar` (ya soportado por `splitPreguntaYAuxiliar` en `HeroPregunta.tsx`).
- Una pregunta = una caja idealmente.

Archivos: `lib/prompts/sonnet_fase1.ts` + `lib/state/entrevista.ts` (`PRIMER_BATCH_BIENVENIDA`).
Detalle con ejemplos malos vs buenos: `docs/smoke-entrevista-real-2026-05-12.md` sección F2.

### 3. Latencia turn (1-3h)

124s en turn 1 / ~60s en turn 2 = inaceptable. Root cause: `solicitar_review_seccion` invoca Opus director con thinking budget 8K cada turno.

Fix: (a) bajar thinking a 2K en `lib/motor/review.ts`, (b) ajustar prompt Sonnet en `lib/prompts/sonnet_fase1.ts` para que llame review solo al cerrar sección.

### 4. STT keyterms (30 min)

Añadir `keyterm: 'CNBV,CONDUSEF,CNSF,SOFOM,SOFIPO,IPAB,UIF,DSCR,CETES'` a `STT_LIVE_CONFIG` en `lib/stt/client.ts`. Resuelve WER de acrónimos regulatorios mexicanos.

### 5. Cold-start STT (2h)

Bug O1 STT: primera palabra cortada en cada turno. Fix: arrancar MediaRecorder al click del mic (no esperar `socket.open`), buffer chunks, drenar al open. Lugar: `lib/stt/use-deepgram-stream.ts:325-329`.

### 6. Re-smoke entrevista

Tras fixes 1-5, re-correr entrevista completa con voz. Medir:
- Latencia turn p50/p95 (objetivo <30s p50).
- WER muestral (objetivo <5% en acrónimos).
- Costo USD por entrevista (sumar facturas Anthropic + Deepgram).

### 7. Vercel staging

Solo si #6 pasa. Migrar `.env.local` keys a Vercel env vars (rotar todas las actuales antes — están en historia de git). Smoke completo en staging.

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
