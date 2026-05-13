# Alpha Readiness Report — 2026-05-12

**Auditor**: CTO/Architect
**Última suite**: 44 archivos, 420 tests verdes (~95s).
**Typecheck**: limpio (preexistentes ya cerrados).
**Build prod**: compila + linting OK (`npx next build`).

---

## TL;DR

**Listo para alpha con voz cuando:**
1. Tú apliques F1 + F2 (founder feedback de prompts/diseño consent — ver §3).
2. Tú hagas un re-smoke de entrevista entera (≥10 turnos con voz) y midamos p50/p95 + costo USD.
3. Tú aprovisiones las 5 keys de producción en Vercel y apliques migraciones DB.

Todo lo que NO requiere tu input está cerrado en esta sesión. Detallo abajo.

---

## 1. Cambios cerrados en esta sesión (técnicos, no requieren tu input)

### 1.1 Latency turn — gate server-side para `solicitar_review_seccion`
**Archivo**: `lib/motor/review-gate.ts` (nuevo, ~250 LOC) + `app/api/turn/route.ts` (wired).

**Por qué**: smoke 2026-05-12 midió 124s/turn 1, 60-70s/turn 2. Root cause: Sonnet emite `solicitar_review_seccion` prematuramente — cada turno con sus cajas vacías o parciales — invocando Opus 4.7 (con thinking adaptive 15-60s) sin que la sección esté realmente lista.

**Arquitectura del fix**: gate server-side antes de Opus. Tres precondiciones:
- **G1** (`already_closed`): no hay review previa con `decision_opus ∈ {avanzar, caso_sintetico}` para `(sesion_id, grupo_ui)`. Excepción: `profundizar` previa permite round 2.
- **G2** (`snapshot_not_in_grupo`): el `extracciones_snapshot` debe contener al menos UNA caja del `grupo_ui`. Sin esto, Sonnet ni siquiera trabajó el grupo.
- **G3** (`critical_cajas_actionable`): para cada caja crítica del grupo, debe estar terminal (`llena | no_aplica | declinada`) O declarada en `cajas_no_clausuradas` con `turnos_intentados ≥ MIN_TURNS_PARA_DECLINAR=2`.

Si falla cualquier gate → tool_result error estructurado con `cajas_pendientes` y `sugerencia` por caja. Sonnet lo lee y retrocede a `generar_batch_preguntas`. **El call caro a Opus se SKIP.**

**Impacto esperado**: latencia turn p50 baja de ~120s → ~30s (sin Opus salvo cierre real de grupo, lo que sucede ~5-6 veces por sesión vs cada turno).

**Tests**: `lib/motor/review-gate.test.ts` (16 unit) + `app/api/turn/route.e2e.test.ts` tests 13-14 (gate ok/reject + processSolicitarReview wiring).

### 1.2 Prompt Sonnet — trigger explícito + mutual exclusion
**Archivo**: `lib/prompts/sonnet_fase1.ts` (tool description + §2 instructions).

Cambios alineados con el gate:
- Precondiciones obligatorias listadas (G1+G2+G3) en la tool description.
- `solicitar_review_seccion` y `generar_batch_preguntas` **mutuamente exclusivas por turno**.
- Anti-patrón explicitado: si recibes `error: review_preconditions_not_met`, NO re-emitas en el mismo turno.
- Eliminado el fuzzy "parcial_estable" — solo estados canónicos del mapa.

### 1.3 Guard O3 — 1 batch por turno
**Archivo**: `app/api/turn/route.ts` closure `batchEmittedThisTurn`.

**Por qué**: con `stopWhen=8`, Sonnet podía emitir múltiples `generar_batch_preguntas` en un turno; el cliente conservaba SOLO el último (`No break` en lib/state/entrevista.ts). Los intermedios se perdían silenciosamente.

**Fix**: server-side closure flag per-request. Primer call: persiste + retorna ok. Subsecuentes: error tool_result + no mutation. Log warn.

**Tests**: `route.e2e.test.ts` test 15.

### 1.4 STT keyterms regulatorios
**Archivo**: `lib/stt/client.ts` (`STT_KEYTERMS` lista cerrada + `keyterm` param en `STT_LIVE_CONFIG`).

**Por qué**: smoke vio `CNBV → CNVB` (transposición V/B). Lista cementada: `CNBV, CONDUSEF, CNSF, IPAB, UIF, SHCP, BANXICO, SOFOM, SOFIPO, SOCAP, IFC, IFPE, DSCR, CETES, TIIE, UDIS, SAT, RESICO, RFC, INDAVAL` — 20 términos.

**Tests**: `lib/stt/client.test.ts` (10 unit, regression guard contra cambio silencioso).

### 1.5 Cold-start STT — audio buffer pre-socket
**Archivo**: `lib/stt/use-deepgram-stream.ts` (refactor del flow start/boot).

**Por qué**: smoke vio "Estoy probando" truncado a "probando". MediaRecorder arrancaba al `socket.open` (~200-400ms después del click), perdiendo la primera palabra.

**Arquitectura del fix**:
- `bufferedChunksRef` — array de Blobs con cap acotado (`BUFFER_MAX_CHUNKS=40` = 10s @ 250ms).
- `socketOpenRef` — flag estable. Handler único de `ondataavailable` decide buffer-vs-send según el flag.
- En `start()`: instala handler → `recorder.start()` AHORA, sin esperar a boot.
- En `socket.on('open')`: drena buffer FIFO ANTES de marcar `socketOpenRef=true`. Preserva orden.
- En `socket.on('close')` (retry): recorder sigue corriendo, chunks vuelven a caer al buffer. El próximo socket open drena.
- `drainBufferToSocket` — pure helper exportado para test. Peek + shift solo tras `sendMedia` success (defensa contra socket muerto mid-drain).

**Edge cases cubiertos**:
- Token endpoint falla → recorder se queda corriendo, chunks bufferean, scheduleRetry los drena al reintento.
- Usuario stop() durante connecting → `teardown` limpia buffer + recorder + socket.
- Track muerto en `recorder.start()` → catch + teardown + error message.
- Socket muere mid-drain → drainBufferToSocket retorna count parcial, resto queda en buffer para próximo intento.

**Tests**: `lib/stt/drain-buffer.test.ts` (6 unit, FIFO + throw + cap).

### 1.6 Reload rehydrate entrevista (O1) — cobertura de tests
**Archivos**: `lib/state/entrevista-init.test.ts` (10 unit).

El fix server-side (`lib/motor/rehidratacion.ts`) ya estaba commiteado (94dfa7e) y tiene 6 integration tests (`lib/motor/rehidratacion.integration.test.ts`). Lo que faltaba: cobertura del path client-side donde el store `init()` consume el payload de rehidratación y seedea drafts/batch/llenas_por_grupo sin contaminar con `PRIMER_BATCH_BIENVENIDA` hardcoded.

**Cubre**: rehidratación + drafts orphan filter + preview coexiste + cargarPrimerBatch idempotente.

### 1.7 SSE → UIMessageChunk converter (F2) — extracción + test
**Archivos**: `lib/state/sse-to-ui-chunks.ts` (nuevo helper extraído) + `lib/state/sse-to-ui-chunks.test.ts` (7 unit).

El bug F2 (`startsWith` crash en `readUIMessageStream`) fue fixed inline en `lib/state/entrevista.ts` pero sin test directo. Extraje a helper puro `sseBytesToUIChunks` y agregué regression guard contra:
- chunk inválido → throw.
- JSON malformado → throw.
- SSE event partido entre paquetes → reensambla OK.
- 7 chunk types canónicos del SDK emitidos por el motor.

---

## 2. Lo que requiere TU acción (founder)

### 2.1 F1 — Rediseño consent al Design System (1.5-2h)
**Path**: `app/entrevista/[sesion_id]/bienvenida/page.tsx`.
Hoy: `style="system-ui"` inline, colores hardcoded.
Objetivo: tokens DS (`cream-pure`, `ink`, `gold-deep`, hairlines), display H1 con clamp, eyebrow, botón solid pill ink/cream, checkbox custom.
**Por qué no lo hice**: es trabajo creativo de diseño que requiere iteración visual contigo. Spec completa en `docs/smoke-entrevista-real-2026-05-12.md` §F1.

### 2.2 F2 — Prompts Sonnet: preguntas cortas + formato pregunta (2-3h)
**Paths**: `lib/prompts/sonnet_fase1.ts` (instrucciones de formato pregunta) + `lib/state/entrevista.ts:PRIMER_BATCH_BIENVENIDA`.
Hoy: el primer batch hardcoded es una lista de 5 campos en una frase. Sonnet genera preguntas con preamble largo enterrando el `?`.
Objetivo: máx 2 líneas (~25 palabras), empieza con interrogativa, una pregunta = una caja idealmente, preamble separado al campo `auxiliar`.
**Por qué no lo hice**: requiere tu juicio editorial + few-shots curados. Spec completa en `docs/smoke-entrevista-real-2026-05-12.md` §F2.

### 2.3 Re-smoke entrevista entera con voz (60-90 min)
Después de F1+F2, corres entrevista completa en localhost:3000 dictando con mic real, ≥10 turnos cubriendo varios grupos.
**Medir**: latencia turn p50/p95 (objetivo < 30s p50), WER muestral (sobre acrónimos MX), costo USD (Anthropic + Deepgram).
**Criterio go/no-go alpha**: si p50 < 30s + WER < 5% en acrónimos + costo < $5 USD/entrevista, go.

### 2.4 Pre-deploy infra (Fase 10 — `IMPLEMENTATION.md` §22)
Antes del primer aliado real:
- **Aprovisionar Vercel Blob** + setear `BLOB_READ_WRITE_TOKEN` (storage de PDFs de síntesis).
- **`RESEND_API_KEY`** + dominio `vertice.mx` (o el elegido) verificado en Resend con DKIM+SPF+DMARC.
- **`ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`** en Vercel env (Production).
- **`SENTRY_DSN`** + source maps activos.
- **Migraciones DB** `0002`, `0004` aplicadas a `vertice-mvp/main`.
- **Rotación** `ADMIN_PANEL_TOKEN` + `AXIOM_TOKEN` con scope mínimo (`Ingest` solamente).
- **3 alertas Axiom** configuradas (Sonnet threshold > 40%, latencia Opus > 12s, Inngest sintesis fail > 5%).
- **Smoke prod end-to-end** post-deploy (1 entrevista completa contra prod, no contra localhost).

### 2.5 Pilotos iniciales (post-prod-smoke)
- Lista de 2-3 aliados financieros.
- 1 magic link + 1 email bienvenida + ventana soporte directo founder.
- Feedback form post-sesión.

---

## 3. Lo que NO bloquea alpha pero conviene cerrar después

| Item | Estado | Esfuerzo |
|---|---|---|
| O2 entrevista (BatchNav vs HeroPregunta desync animado) | Cosmético, no afecta datos | 1h |
| O2 STT (`pauseDetected` vía `vad_events` real) | Decorativo en `/demo/stt` | 30 min |
| Sub-paso 5.iv (Opus director prompt) | Founder + CTO co-escritura | 3-4h |
| Wave 2 admin redesign | Sin urgencia para alfa | — |
| Mobile/iPad | Sin urgencia para alfa | — |
| Tests STT hook completos (jsdom + RTL) | Smoke manual suple por ahora | 4h |

---

## 4. Cómo verificar antes de salir

```powershell
# Suite completa (debería: 44 archivos, 420 tests verdes)
npx vitest run

# Typecheck (debería: 0 errores)
npx tsc --noEmit

# Build prod (debería: ✓ Compiled successfully)
npx next build
```

---

## 5. Smoke manual breve sugerido (15 min)

Antes de F1/F2, podemos validar que los fixes técnicos funcionan en el flujo sin tocar UX:

1. `npm run dev` (puerto 3000).
2. Admin → `/admin/instituciones` → "Generar URL" en una institución existente.
3. Magic link → bienvenida → consent → entrevista.
4. Dicta 1 respuesta corta (verifica STT keyterm + cold-start: la primera palabra debe llegar completa).
5. Click "Enviar respuestas". Espera el siguiente batch.
   - **Validación key**: que NO veas latencia >60s en este primer turn. Si baja a <30s, el gate funcionó.
6. Dicta segunda respuesta corta. Repite.
7. Recarga la página mid-flujo. Validar que la pregunta actual + draft persisten (no vuelve a la bienvenida).

Si los 4 puntos pasan, los fixes técnicos están entregados. Falta F1/F2 + tu re-smoke largo.

---

**Estado actual**: ⚠ **No listo para entregar al primer aliado** sin F1 + F2 + tu re-smoke + keys prod.
**Estado actual**: ✓ **Listo para tu prueba manual breve** (paso 5 arriba) que confirma latencia + STT funcionan.
