# STATUS — Vértice Encuesta

> **Source of truth del proyecto.** Cualquier agente o sesión que toque este repo lee este documento primero y lo actualiza al cerrar tarea relevante. Si hay duda entre este doc y otros, **gana este doc** (excepto `IMPLEMENTATION.md` para detalles de contrato técnico de las fases).

**Última actualización:** 2026-05-14 (Fase 8 cerrada — `@vercel/blob` instalado + Resend notif email + admin viewer PDF link + smoke E2E 7/7 verde)
**Branch canónica:** `master`
**HEAD aproximado:** `0f5f473` (feat(fase8): cerrar storage Blob + Resend notif + admin PDF link) · working tree limpio · ramas vivas: ninguna activa
**Suite:** 509/509 tests verdes (+13 nuevos email) · typecheck limpio · migración 0007 aplicada a `vertice-mvp/main`

---

## 1. TL;DR

**Fase:** pre-alpha técnica. Toda la infraestructura crítica está implementada y testeada. **% completado: ~85%.**

**Qué bloquea producción (en orden):**

1. Re-smoke entrevista entera con voz (≥10 turnos) midiendo latencia p50/p95 + costo USD.
2. Provisionar Upstash Redis + pegar credenciales en `.env.local` (rate-limit en serverless).
3. Aprovisionar 7 keys/recursos prod en Vercel (Blob, Resend, Anthropic, Deepgram, Inngest, Axiom, Sentry).
4. Aplicar migraciones DB `0002`, `0004`, `0006`, `0008` a `vertice-mvp/main` (`0007` ya aplicada 2026-05-14).
5. Smoke E2E post-deploy contra prod.
6. Pilotos: 2-3 aliados con magic link + soporte directo founder.

**Criterio go-alpha:** p50 < 30s · WER < 5% en acrónimos MX · costo < $5 USD/entrevista.

---

## 2. Estado por fase

> Mapeo a `IMPLEMENTATION.md`. Mantener `IMPLEMENTATION.md` como contrato del proyecto; este resumen es para vista rápida.

| Fase | Tema | Estado | Nota |
|---|---|---|---|
| 1 | Setup base | ✅ Cerrada | — |
| 2 | Schema + migraciones Drizzle/Neon | ✅ Cerrada | Migraciones 0001-0006 |
| 3 | Schemas Zod credit box | ✅ Cerrada (95%) | TODO menor: founder sweep criticidad/tipo de 32 extension cajas |
| 4 | Auth + onboarding (magic link + admin SSO Google) | ✅ Cerrada | E2E 6/6, Auth.js v6 con dominios permitidos |
| 5 | Motor conversacional (Sonnet 4.6 + Opus 4.7) | ✅ ~95% | Director + síntesis + generador casos + validador casos SIGNED OFF (2026-05-13). Pipeline activo con Opus 4.7 generador (`effort=high` + adaptive thinking) + Sonnet 4.6 validador (`effort=low`, latencia <2s). Pendiente solo: validación empírica con caso real en re-smoke voz |
| 6 | Integración Deepgram STT | ✅ ~95% | Cableado al motor real validado, smoke 7/7 verde |
| 7 | UI entrevista (preguntas + sidebar + autosave) | 🟡 ~85% | F1 consent promovido, F2 prompts cortos commiteado; falta validación con voz |
| 8 | Síntesis final con Inngest (PDF + email) | ✅ Cerrada (2026-05-14) | `@vercel/blob@2.3.3` instalado, step `notificar-admin` cableado a Resend (`sendSintesisCompleta`), admin viewer renderea botón "Descargar PDF" cuando `pdf_url` existe + fallback grácil cuando no. Smoke E2E `scripts/smoke_fase8.ts` 7/7 verde. Falta sólo: provisionar `BLOB_READ_WRITE_TOKEN` (founder action en Vercel) |
| 9 | Vista admin | ✅ Cerrada | Wave 1 productiva. Wave 2 redesign queda como post-alpha |
| 10 | Telemetría + deploy + pilotos | 🟡 ~30% | Logs Axiom wirados; falta keys prod + alertas + smoke prod + pilotos |

---

## 3. Lo que falta para producción

### 3.1 Acciones de founder (bloqueantes)

> **Checklist canónico detallado:** [`IMPLEMENTATION.md` §22 Pre-deploy](IMPLEMENTATION.md#22--pre-deploy-checklist-fase-10) (7 subsecciones con owner y criterio de done explícitos). Lo que sigue es el resumen ejecutivo.

- **Re-smoke entrevista entera con voz** (60-90 min). ≥10 turnos cubriendo varios grupos. Medir p50/p95 + WER + USD. Criterio go/no-go alpha definido arriba.
- **Validar F2 en producción**: dictar Q1 + Q2 con mic real, capturar el batch que Sonnet emite tras el primer turn, validar formato (≤30 palabras, empieza con interrogativa, auxiliar opcional ≤200 chars).
- **Provisionar Upstash Redis** (3 min). Crear DB `vertice-ratelimit` en Free tier, copiar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` a `.env.local`. Sin esto el rate-limit cae al fallback in-memory que NO funciona correctamente en Vercel multi-instance.
- **Aprovisionar Vercel + dominio**: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` + dominio verificado con DKIM/SPF/DMARC, `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY` (role Member), `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `AXIOM_TOKEN`, `SENTRY_DSN`.
- **Rotación** `ADMIN_PANEL_TOKEN` + `AXIOM_TOKEN` con scope mínimo (`Ingest` solamente).
- **Migraciones DB** `0002`, `0004`, `0006`, `0007`, `0008` aplicadas a `vertice-mvp/main` (idempotentes). La `0007` agrega `perfil_decision_final.pdf_url` para Fase 8 storage; la `0008` agrega indexes en `audit_admin_actions` para cron retention.
- **3 alertas Axiom** configuradas: Sonnet threshold > 40%, latencia Opus > 12s, Inngest sintesis fail > 5%.
- **Smoke prod end-to-end** post-deploy (1 entrevista completa contra prod, no localhost).
- **Pilotos iniciales**: lista de 2-3 aliados financieros + magic link + email bienvenida + ventana soporte directo founder + feedback form post-sesión.

### 3.2 Trabajo técnico pendiente (puede ejecutarlo un agente)

- **Commit Sprint 2 Upstash final**: una vez provisionado, agregar las dos vars a `lib/env.ts` como optional + commit + push. El código ya está code-complete con fallback.

---

## 4. Deuda técnica

Ver registro detallado y vivo en [`docs/DEUDA_TECNICA.md`](docs/DEUDA_TECNICA.md). 14 items con archivo:línea, impacto y criterio de cierre.

**Resumen:**

| # | Item | Prioridad | Esfuerzo |
|---|---|---|---|
| 1 | `solicitar_caso_sintetico` sigue stub (sub-paso 5.iv parcial) | ✅ Cerrado (2026-05-13, sign-off founder + rewrite prompts + cableado Sonnet validador) | — |
| 2 | Bug O3-marca race condition (browser automation) | ✅ Cerrado (2026-05-13) | — |
| 3 | STT keyterms incompletos | ✅ Cerrado (`53485b9`, 33 términos) | — |
| 4 | Em-dashes residuales en few-shots | ✅ Cerrado (`786885f`) | — |
| 5 | Cobertura tests en `app/admin/` y `app/actions/` | ✅ Cerrado (2026-05-13, +25 tests sobre adminAuth/sesionLogout/adminInstituciones) | — |
| 6 | `z.unknown()` en schemas críticos | ✅ Cerrado (`ba968ec`, 2026-05-13, Plan B aplicado: ValorPorCaja mapping + parseValorPorCaja helper) | — |
| 7 | Audit log sin retention policy | ✅ Cerrado (2026-05-13) | — |
| 8 | `fuente: 'usuario_tipea'` hardcoded en `/api/turn` | ✅ Cerrado (2026-05-13) | — |
| 9 | Chime audio mute toggle | ✅ Cerrado (2026-05-13) | — |
| 10 | O2 entrevista — BatchNav vs HeroPregunta desync | 🟢 Baja | 1h |
| 11 | O2 STT — `pauseDetected` no dispara via MediaRecorder | ✅ Cerrado (2026-05-13) | — |
| 12 | Tests STT hook completos (jsdom + RTL) | 🟢 Baja | 4h |
| 13 | Wave 2 admin redesign | 🟢 Baja | TBD |
| 14 | Mobile/iPad responsive | 🟢 Baja | 6-8h |
| 15 | `@ts-nocheck` pragmas en 2 tests STT (`use-deepgram-stream.test.ts`, `stt/token/route.test.ts`) | 🟢 Baja | 30 min |
| 16 | TODO v2: `array<string>` sin enum cerrado runtime (`sonnet_fase1.ts:126`) | 🟢 Baja (v2) | 2-3h |
| 17 | TODO v2: multi-turn memory para context window (`lib/state/entrevista.ts:161`) | 🟢 Baja (v2) | 3-4h |
| 18 | `font-display` class silently rendering Satoshi (project-wide) | ✅ Cerrado (2026-05-13, fix global en `@theme inline` de globals.css) | — |

**Regla:** 🔴 antes que 🟡 antes que 🟢. La 🔴 alta no bloquea el primer aliado pero sí el segundo.

---

## 5. Bugs documentados, no fixeados (post-piloto)

- **O1 entrevista** — `/entrevista` no rehidrata desde DB al reload. Cobertura de tests cerrada (`lib/state/entrevista-init.test.ts`); falta validar UX end-to-end en smoke real.
- **O2 entrevista** — BatchNav vs HeroPregunta desync animado. Cosmético.
- **O3 entrevista** — múltiples `generar_batch_preguntas` por turno. Mitigado por server-side guard en `app/api/turn/route.ts` (1 batch por turno) pero deja de ser data loss potencial al fixearlo.
- **O1 STT** — cold-start primera palabra. Mitigado por audio buffer pre-socket (`lib/stt/use-deepgram-stream.ts`). Validar empíricamente en re-smoke.
- **O2 STT** — `pauseDetected` no dispara via MediaRecorder. Decorativo.

---

## 6. Estructura de docs viva

```
Vertice_Encuesta/
├── STATUS.md                  ← este doc, source of truth
├── CHECKPOINTS.md             ← log de sesiones cronológico
├── CLAUDE.md                  ← anclaje agentes
├── README.md                  ← overview proyecto
├── IMPLEMENTATION.md          ← contrato técnico de las 10 fases
├── docs/
│   ├── DEUDA_TECNICA.md       ← registro vivo de deuda técnica
│   ├── axiom_dashboard.md     ← referencia dashboards observabilidad
│   ├── design/                ← Design System vivo (tokens, research, recipes)
│   └── archive/               ← histórico (checkpoints, smokes, bugs, plans, specs)
└── ...
```

---

## 7. Convención para agentes

> **Toda sesión sigue este loop**, salvo que el usuario diga lo contrario:

1. **Al empezar:** leer este doc (STATUS.md) + `CHECKPOINTS.md` última entrada. Si la tarea toca código de una fase, leer la sección correspondiente en `IMPLEMENTATION.md`.
2. **Durante:** si descubres bloqueante nuevo, item de deuda técnica, o cambio de fase, **actualiza este doc inmediatamente** (sección §2, §3, §4 o §5 según aplique). No esperes al final.
3. **Al cerrar:** agregar una entrada nueva en `CHECKPOINTS.md` (formato en el header del doc). Mover a `STATUS.md` cualquier item que dejó de ser checkpoint y pasó a ser estado canónico.
4. **Al cerrar deuda técnica:** marcar `[x]` en `docs/DEUDA_TECNICA.md` con commit hash, y bajar el item de la tabla en §4 de este doc al estado cerrado.
5. **Nunca** crear un nuevo doc de progreso paralelo (alpha-readiness-X, smoke-Y, handoff-Z). Si la información es perenne, va en STATUS o DEUDA. Si es snapshot de sesión, va en CHECKPOINTS.

---

## 8. Histórico archivado

Todo lo anterior a esta consolidación vive en `docs/archive/`:

- `docs/archive/checkpoints/` — 5 checkpoints históricos (design research, ui refactor cards unificadas, ui refactor entrevista, post-smoke real 2026-05-12, sprint-2-upstash)
- `docs/archive/smokes/` — alpha-readiness + smoke entrevista real
- `docs/archive/bugs/` — bugs encontrados STT + E2E
- `docs/archive/handoff/` — HANDOFF original
- `docs/archive/plans/` + `specs/` — 9 plans y specs históricos de superpowers
- `docs/archive/reviews/` — reviews admin panel + PR4 + screenshots admin wave 1

Material vivo no archivado (research vigente):

- `docs/design/research/admin-dashboard-2026-redesign.md` — input para Wave 2 admin (deuda #13).

Consultable pero no canónico. Si necesitas info histórica, búscala ahí. Si necesitas el estado actual, está en este doc.
