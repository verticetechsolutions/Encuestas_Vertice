## Checkpoint 2026-05-12 post-smoke entrevista real

**Sesión:** primer smoke E2E real con voz dictada en `/entrevista/[sesion_id]` (no aislado). 2 turnos completos, sidebar avanzó 0→6 cajas. PR #21 (STT smoke completo + 5 fixes) mergeado a master en sesión anterior. Identificados 3 bloqueantes técnicos + 2 pendientes founder.

**Repo:** Vertice_Encuesta  ·  **Branch:** master (a la altura de origin/master `49a2a8e`)  ·  **Cambios:** 0 staged, 0 sin commit. Solo untracked: `.ui-design/` (IDE) y `docs/smoke-entrevista-real-2026-05-12.md` (nuevo doc de findings).

### Lo que se hizo

1. **Smoke E2E real `/entrevista/[id]` con voz** (no `/demo/stt`). Flow: magic link Banco Demo → bienvenida → consent → entrevista → mic → STT → textarea → autosave → POST /api/turn → Sonnet emite tools → DB persiste → siguiente batch.
2. **2 turnos completos dictados**:
   - Turn 1 (identidad institucional): respuesta dictada `Somos Banco Demo Vértice SA. Nombre comercial, banco... SOFOM regulada bajo CNVB y CONDUSEF. Llevamos ocho años operando en el mercado de crédito empresarial mexicano.` Sidebar: 0 → 4 cajas. **Latencia 124s** desde click "Enviar respuestas" → siguiente batch visible.
   - Turn 2 (productos de crédito): respuesta `No tenemos ni no tenemos ninguno. Aceptamos todos. Nada` (dictado original "no tenemos sectores excluidos, aceptamos a todos" — Deepgram metió duplicación + truncamiento). Sidebar: 4 → 6 cajas. Latencia ~50-70s. Sonnet emitió pregunta de follow-up contextualmente relevante: "agroindustria como eje central — tiene mucho sentido si esos son los sectores con mayor volumen y rotación... ¿En qué estados o regiones del país están originando hoy?"
3. **Doc nuevo escrito**: `docs/smoke-entrevista-real-2026-05-12.md` con findings completos, root causes, fixes propuestos, founder feedback, y plan ordenado para la siguiente sesión.

### Pendientes / blockers

**Founder feedback nuevo (anotado en este checkpoint):**
- [USER] **F1 — Rediseñar `/entrevista/[id]/bienvenida` (consent) al Design System.** Actualmente usa `style={{ fontFamily: 'system-ui' }}` inline + colores hardcoded (`#f6f6f5`, `#1a1a1a`, `#444`). Debe migrar a tokens del DS (cream-pure, ink, gold, hairlines), display H1 con clamp, eyebrow gold-deep, botón ink/cream solid pill, checkbox custom. Detalle: `docs/smoke-entrevista-real-2026-05-12.md` sección "Founder feedback post-smoke" F1. Estimado 1.5-2h.
- [USER] **F2 — Mejorar prompts Sonnet: preguntas más cortas y formato pregunta.** Las preguntas que emite Sonnet (y la hardcoded `PRIMER_BATCH_BIENVENIDA` en `lib/state/entrevista.ts`) son listas largas o tienen preamble conversacional largo antes de la interrogativa. Founder pidió: máx 2 líneas (~25 palabras), empiezan con interrogativa, preamble separado al campo `auxiliar` (ya soportado por `splitPreguntaYAuxiliar` en `HeroPregunta.tsx`), una pregunta = una caja idealmente. Editar `lib/prompts/sonnet_fase1.ts` + `lib/state/entrevista.ts`. Estimado 2-3h.

**Bloqueantes técnicos identificados en el smoke:**
- [USER] **Latencia turn 124s (turn 1) / ~50-70s (turn 2)**. Root cause hipotetizado: `solicitar_review_seccion` → Opus director con thinking budget 8K (`lib/motor/review.ts`). Para entrevista 30 min × 20-30 turns × 90s motor = 1h+ sentada la subdirectora. **Fix recomendado**: (1) bajar thinking budget a 2K, (2) ajustar prompt Sonnet para que llame review solo al cerrar sección, no cada turno. Estimado 1-3h.
- [USER] **WER en acrónimos regulatorios**: `CNBV` → `CNVB` (transposición V/B). Rompe extracción de `regulador_principal`. Mismo riesgo: CONDUSEF, CNSF, IPAB, UIF, CNH. **Fix recomendado**: añadir `keyterm: 'CNBV,CONDUSEF,CNSF,SOFOM,SOFIPO,IPAB,UIF,DSCR,CETES'` a `STT_LIVE_CONFIG` en `lib/stt/client.ts`. Estimado 30 min.
- [USER] **Duplicación de frases con muletillas STT**: dictar respuestas naturales con auto-corrección produjo texto repetitivo y truncado ("No tenemos ni no tenemos ninguno"). Sonnet recibe semántica errónea. **Fix recomendado**: UI feedback live cerca del mic + tunear `utterance_end_ms` en Deepgram. Estimado: validación empírica primero.

**Bugs documentados previamente que se confirmaron:**
- O1 STT (cold-start primera palabra) — confirmado en turn 2.
- O2 entrevista (BatchNav vs HeroPregunta desync durante AnimatePresence) — confirmado visualmente. Cosmético.
- O3 entrevista (múltiples `generar_batch_preguntas` por turno) — NO se reprodujo en los 2 turnos. Sigue como "open" sin evidencia nueva.
- O1 entrevista (reload no rehidrata) — no probado en este smoke; pendiente.

### Próximos pasos sugeridos

Orden recomendado (priorizando UX inmediato del founder sobre infra latencia, porque la primera impresión de un aliado se gana o pierde en la primera pantalla):

1. **F1 — Rediseño consent al DS** (1.5-2h). Prerrequisito visual.
2. **F2 — Prompts Sonnet preguntas cortas** (2-3h). Segundo eslabón de UX inmediato.
3. **Latencia turn** (1-3h): bajar Opus thinking 8K→2K + ajustar prompt Sonnet para que `solicitar_review_seccion` corra solo al cerrar sección.
4. **STT keyterms** (30 min): añadir keyterm list a `STT_LIVE_CONFIG`.
5. **Cold-start STT** (2h): buffer MediaRecorder al click, drenar al socket.open.
6. **Re-smoke entrevista real**: medir latencia post-fixes y costo USD/entrevista (Anthropic + Deepgram).
7. Si pasa: Vercel staging (fase 2 del plan CTO).

**No hacer aún**: wave 2 admin redesign, mobile/iPad, O2/O3 entrevista cosméticos, migración SDK Deepgram v2.

### Cómo retomar

1. Leer `docs/smoke-entrevista-real-2026-05-12.md` — tiene findings completos + plan ordenado.
2. Si se ataca F1 (consent redesign): leer `app/entrevista/[sesion_id]/bienvenida/page.tsx` actual + tokens en `app/design-system/tokens.css` + referencia visual en `components/entrevista/HeroPregunta.tsx`.
3. Si se ataca F2 (prompts): leer `lib/prompts/sonnet_fase1.ts` y `lib/state/entrevista.ts` (PRIMER_BATCH_BIENVENIDA hardcoded). Ver ejemplos de pregunta MAL vs BIEN en el doc smoke.
4. Si se ataca latencia: leer `app/api/turn/route.ts` (turn loop), `lib/motor/review.ts` (Opus call), `lib/prompts/sonnet_fase1.ts` (cuándo Sonnet llama review).
5. Dev server actual: hay un proceso en `:3000` (no iniciado por mí, no veo logs) y uno orphan en `:3001` (iniciado por mí, sin tráfico). Si vuelves: matar ambos y arrancar uno limpio.
6. `master` está limpio (a la altura de `origin/master 49a2a8e`). Cookie `vertice_session` en el browser apunta a sesion `7746c975-b3a0-49d5-8bba-16cdf4bfa87c` (Banco Demo, 2 turnos consumidos, 6/54 cajas). Si la quieres reciclar, sigue ahí; si quieres limpia, generar otro magic link via `/admin/instituciones/930b78e0...`.
