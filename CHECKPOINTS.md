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
