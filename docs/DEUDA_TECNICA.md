# Deuda técnica — registro 2026-05-12

**Levantamiento**: sesión E2E del 2026-05-12 noche, post-commits `cc7de99` (Auth SSO) y `36026f7` (chime + anti em-dash).

**Estado del producto**: técnicamente listo para alpha. Esta deuda **no bloquea** el primer aliado piloto si se cubren los 7 items de infra prod (ver `docs/alpha-readiness-2026-05-12.md` §2.4). Cerrar en sesiones aparte, post-piloto si es posible.

**Convención**: cada item lleva archivo:línea (cuando aplique), impacto operativo, criterio de cierre y esfuerzo estimado. Marcar `[x]` cuando se cierre + commit hash al margen.

---

## 🔴 Alta prioridad — cerrar antes del 2do aliado

### 1. `solicitar_caso_sintetico` sigue stub — ✅ CERRADO (`fd78e99`, 2026-05-13)

- **Archivo**: `app/api/turn/route.ts:533-545` (invoca `procesarSolicitudCasoSintetico`); pipeline real en `lib/motor/casos_sinteticos.ts` (2026-05-13).
- **Estado**: pipeline activo. `OPUS_GENERADOR_CASOS_PROMPT_READY` y `OPUS_VALIDADOR_CASOS_PROMPT_READY` flippeados a `true` con sign-off founder (2026-05-13). Generador corre con Opus 4.7 + `effort=high` + adaptive thinking. Validador corre con Sonnet 4.6 + `effort=low` (sin extended thinking) para cumplir latencia <2s declarada en el header del prompt.
- **Cambios concretos (2026-05-13 sign-off)**:
  - **`lib/prompts/opus_generador_casos.ts`** reescrito aplicando best-practices Anthropic Claude 4.7: estructura XML canónica (role, context, constraints, methodology, output_format, examples), instrucciones positivas en lugar de negativas, palabra "think/thinking" removida del system body (Opus 4.5+ keyword), 5 few-shots con arquetipos contrastantes (servicios profesionales CDMX, construcción Bajío, factoraje agro Sinaloa, comercio Yucatán, hotelería Quintana Roo) para anti-mode-collapse. `OPUS_GENERADOR_CASOS_PROMPT_READY = true`.
  - **`lib/prompts/opus_validador_casos.ts`** reescrito como LLM-as-judge canónico: evaluación criterio-por-criterio en orden fijo antes de emitir bool, fallback "evidencia_insuficiente" en lugar de "ante duda falla", instrucción "responde directamente" para suprimir thinking con `effort=low`. 5 few-shots (pasa + 4 falla por causa distinta). `OPUS_VALIDADOR_CASOS_PROMPT_READY = true`.
  - **`lib/motor/casos_sinteticos.ts:131-176`**: agregado `providerOptions.anthropic` con `thinking: 'adaptive' + effort: 'high'` para generador; cambiado validador de Opus 4.7 a `claude-sonnet-4-6` con `effort: 'low'`.
- **Criterio de cierre**:
  - [x] Pipeline real cableado, gated por flags. *(2026-05-13)*
  - [x] Stub reemplazado en `app/api/turn/route.ts`. *(2026-05-13)*
  - [x] typecheck limpio. *(2026-05-13)*
  - [x] **Founder sign-off de `OPUS_GENERADOR_CASOS_PROMPT_READY`**. *(2026-05-13)*
  - [x] **Founder sign-off de `OPUS_VALIDADOR_CASOS_PROMPT_READY`**. *(2026-05-13)*
  - [x] 449/449 vitest verdes post sign-off. *(2026-05-13)*
  - [ ] Validación empírica con caso real en re-smoke voz (founder). *(Post-piloto, no bloquea el cierre del item)*
- **Esfuerzo**: estimado 1-2h → real ~2h.

### 2. Bug O3-marca race condition ✅ CERRADO (2026-05-13)

- **Reproducible**: click "Marcar respondida" + click "Siguiente pregunta" con gap <2s. Solo se da en velocidad >humana (browser automation). Usuario humano natural no lo dispara.
- **Síntoma original**: el contador global "X MARCADAS" cuenta solo la última pregunta marcada; las anteriores muestran banner "Respuesta marcada" individual pero quedan fuera del set global. El botón "Enviar respuestas" puede quedar deshabilitado ("Falta N pregunta") aunque el usuario marcó todas.
- **Causa raíz identificada**: `MarcarButton.onToggle={() => onToggleMarcada(!marcada)}` en `components/entrevista/HeroPregunta.tsx:340` cerraba sobre el prop `marcada` que podía estar stale entre renders sub-segundo. Cuando dos clicks ocurrían en frames cercanos, el segundo cómputo `!marcada` veía un valor desactualizado y emitía el valor que el primero ya había escrito (race-of-stale-closure, no race-of-zustand-set).
- **Fix aplicado (2026-05-13)**:
  - `lib/state/entrevista.ts`: nueva action `togglearMarcada(preguntaId)` que hace `set((s) => ({...}: !s.marcadas_respondidas[preguntaId]))`. Atómico contra el state actual del store; no depende del closure del componente.
  - `components/entrevista/HeroPregunta.tsx:Props`: signature `onToggleMarcada: () => void` (antes `(marcada: boolean) => void`). El componente NO computa el target; delega al store.
  - `app/entrevista/[sesion_id]/entrevista-shell.tsx`: pasa `onToggleMarcada={() => togglearMarcada(activePregunta.id)}` en lugar de `(m) => marcarRespondida(activePregunta.id, m)`.
  - `lib/state/entrevista-toggle.test.ts` (nuevo): 6 tests cubren idempotencia, secuencia sub-segundo sobre 3 preguntas (escenario exacto del bug), coexistencia con `marcarRespondida` explícito, state pre-seedeado, e invariantes (no toca `preguntas_con_stt` ni `cajas_llenas_por_grupo`).
- **Criterio de cierre**:
  - [x] Tests unit que reproducen el race con state pre-seedeado. *(`lib/state/entrevista-toggle.test.ts`, 6/6 verdes)*
  - [x] Fix verificado contra el patrón del bug (3 togglears secuenciales sub-frame).
  - [x] typecheck limpio.
  - [ ] Smoke en browser real con automation sub-segundo. *(Pendiente — opcional, los tests unit cubren la causa raíz)*
- **Esfuerzo**: estimado 1-2h → real ~1h.

### 3. STT keyterms incompletos ✅ CERRADO (`53485b9`)

- **Archivo**: `lib/stt/client.ts` — `STT_KEYTERMS` array.
- **Estado**: cerrado 2026-05-12 (commit `53485b9`). Array expandido de 20 a **33 términos** con cobertura completa de reguladores MX, tipos institucionales, métricas, procesos, compliance MX (PLD/KYC/AML), productos por garantía (quirografario/prendario/refaccionario/hipotecario/avío/habilitación) y operaciones (factoraje/leasing/arrendamiento/confirming/descuento). `Vértice` agregado para fix V→B confusion en Latam Spanish.
- **Criterio de cierre**:
  - [x] Agregar ≥10 términos del léxico crediticio MX al array. *(15 nuevos agregados)*
  - [x] Tests de `lib/stt/client.test.ts` actualizados (regression guard `contiene operaciones financieras frecuentes en dictado`). *(20/20 verdes, typecheck limpio)*
  - [ ] Re-smoke con voz tras deploy: dictar "Vértice", "factoraje", "leasing" para confirmar empíricamente. *(Pendiente del re-smoke founder, no bloquea el cierre del item)*
- **Esfuerzo**: estimado 15 min → real ~30 min con tests.

---

## 🟡 Media prioridad — cerrar en próximas 2-3 semanas

### 4. Em-dashes residuales en few-shots de prompts ✅ CERRADO (`786885f`)

- **Estado**: regla anti em-dash agregada al system prompt de Sonnet y Opus en `36026f7`. Validado E2E que el modelo ya no produce em-dashes en heros/auxiliares nuevos.
- **Residuo**: 43 em-dashes en `lib/prompts/sonnet_fase1.ts` distribuidos en few-shots (respuestas simuladas del entrevistado), comentarios técnicos `//`, y descripciones de reglas. La mayoría son inputs del entrevistado (correcto, así habla la gente) o comentarios (no afectan al modelo). Algunos casos restantes en descripciones de reglas que el modelo lee.
- **Riesgo**: bajo. La regla nueva es lo suficientemente clara. Validado en 8+ batches que el modelo respeta.
- **Criterio de cierre**:
  - [x] Sweep visual de los 43 em-dashes en `lib/prompts/sonnet_fase1.ts`. *(`786885f`)*
  - [x] Reemplazar por puntuación equivalente (coma, dos puntos, punto y aparte) en strings de regla y descripciones tool. Mantener em-dashes solo en `<respuesta_entrevistado>` (input simulado, OK). *(`786885f`)*
  - [x] Aplicar mismo sweep a `lib/prompts/opus_*.ts`. *(`786885f`: opus_director, opus_generador_casos, opus_sintesis_final, opus_validador_casos)*
  - [x] Validar suite de prompts tests sigue verde. *(443/443 verdes, typecheck limpio)*
- **Esfuerzo**: 30-45 min → real: ~25 min.
- **Notas del cierre**:
  - ~80 reemplazos totales en 5 archivos. Comentarios `//` y reglas que CITAN los símbolos (L670 sonnet, L154 opus_director, L114 opus_generador, L266 opus_sintesis) preservados a propósito.
  - `<respuesta_entrevistado>` L731 + L810 y `evidencia_textual` L829 de sonnet preservados (citas literales del input del entrevistado).
  - Rangos numéricos `12.A.1–12.A.11` migrados a `12.A.1 a 12.A.11` (formato natural en español, consistente con el resto del prompt).

### 5. Cobertura tests en `app/admin/` y `app/actions/` — ✅ CERRADO (`87abc5b`, 2026-05-13)

- **Estado**: auditoría real al cerrar el item descubrió que 5 de los 9 archivos `app/actions/*.ts` ya tenían `.integration.test.ts` adyacente (`instituciones`, `respuestas`, `sesiones`, `auth`, `adminMagicLinks`), y los 2 routes admin críticos (`api/export/[entity]`, `api/search`) también. Faltaban tests para los 3 actions restantes (`adminAuth.ts`, `sesionLogout.ts`, `adminInstituciones.ts` parte editar/eliminar). Cerrados en esta sesión.
- **Cambios (2026-05-13)**:
  - **`app/actions/adminAuth.unit.test.ts` (nuevo, 9 tests)**: `loginAdmin` happy path con/sin `next`, security check (next con prefijo arbitrario forzado a `/admin`), rate-limit alcanzado, admin disabled (env vacía), token inválido, IP fallback `x-forwarded-for → x-real-ip`, user-agent truncado a 200 chars. `logoutAdmin` con `clearAdminCookie` + redirect. Mock pattern: `redirect` lanza `TestRedirectError` para parar control flow en cascada.
  - **`app/actions/sesionLogout.unit.test.ts` (nuevo, 2 tests)**: `logoutSesion` llama `clearSessionCookie` + redirige a `/`, NO marca sesión como abandonada (decisión documentada, sanity check para futuros refactors).
  - **`app/actions/adminInstituciones.integration.test.ts` (nuevo, 14 tests)**: `editarInstitucion` (happy con razón social/tipo/email, parcial preserva campos, nombre_comercial vacío explícito → null, sin auth, id vacío, id inexistente, email duplicado 23505, email inválido Zod), `eliminarInstitucion` (happy sin actividad asociada, sin auth, id vacío, id inexistente, bloqueado por sesiones FK, bloqueado por magic_tokens FK). `crearInstitucionConLink` ya estaba cubierto en `instituciones.integration.test.ts` (A6). `withAuditLog` mockeado para no tocar `audit_admin_actions` (la migración 0006 que crea la tabla no aplica al branch test-integration; el audit log tiene cobertura propia).
- **Criterio de cierre**:
  - [x] Integration tests para `app/actions/instituciones.ts` (crear, editar, eliminar, listar). *(crear/wrap ya en `instituciones.integration.test.ts`; editar/eliminar en nuevo `adminInstituciones.integration.test.ts`)*
  - [x] Unit tests para `app/actions/adminAuth.ts` (login + logout). *(9 tests nuevos cubriendo todos los paths)*
  - [x] Route tests para `app/admin/api/export/[entity]/route.ts`. *(ya existía pre-2026-05-13: `app/admin/api/export/[entity]/route.integration.test.ts`)*
  - [x] Cobertura admin actions críticas: 7/7 actions con test (auth, respuestas, sesiones, instituciones, adminMagicLinks, adminAuth, sesionLogout, adminInstituciones). *(100% de actions críticas)*
- **Esfuerzo**: estimado 4-6h → real ~2.5h (gracias a auditoría: 5 actions ya cubiertas, no 23 archivos).
- **Notas del cierre**:
  - Decisión sobre RSC pages (`app/admin/*/page.tsx`): no se agregaron tests porque son Server Components que renderizan datos vía RSC. Smoke manual del founder en `/admin/instituciones`, `/admin/sesiones`, `/admin/magic-links` cubre el critical path. Si surge regresión en una page específica, agregar Playwright test focal post-piloto.
  - Decisión sobre `nueva-form.tsx` (client component): no se agregó test porque requiere `@testing-library/react` que no está instalada (deuda #12 lo señala como bloqueante). Cuando se cierre #12, agregar test del form.

### 6. `z.unknown()` en schemas críticos

- **Archivos**:
  - `lib/schemas/extracciones.ts:181` — `ExtraccionSchema.valor: z.unknown()`. Resuelto en runtime via `valorSchemaFor(caja_codigo)`.
  - `lib/schemas/extracciones.ts:100-101` — `ValorTablaGenericaSchema` y `ValorObjetoGenericoSchema` con `z.record(string, z.unknown())` para cajas tipo `tabla`/`objeto` sin schema específico.
  - `lib/schemas/review_seccion.ts`, `lib/schemas/perfil_decision_final.ts`, `lib/motor/tools.ts` — re-usan el shape `valor: z.unknown()`.
- **Mitigación actual**: runtime check via `valorSchemaFor(caja_codigo)` que sí tipa el valor según la caja específica. `parseExtraccion(raw)` hace envelope + valor en un paso (`lib/schemas/extracciones.ts:195`). Sin esto, datos malformados llegarían a DB.
- **Impacto**: tipado weak en TS — `extraccion.valor` es `unknown` al leer post-parse, fuerza casts en call sites. Refactors del pipeline pueden romper sin que tsc avise hasta runtime.
- **Estado del análisis (2026-05-13)**: revisado el alcance real. El refactor a `z.discriminatedUnion('caja_codigo', [...])` requiere ~52 variants explícitos (5 id + 44 núcleo + 32 extension). El envelope `ExtraccionSchema` actual NO es discriminated; convertirlo obliga a (a) listar todos los códigos como literals, (b) sincronizar con `CAJAS_CANON` + `CAJAS_EXTENSION_POR_TIPO`, (c) tocar todos los call sites que usan `ExtraccionSchema` (motor, persistence, snapshot, perfil_decision_final, review_seccion, tools, ~15 archivos). Esfuerzo real: 6-8h con tests, no las 2-3h estimadas originalmente.
- **Criterio de cierre (revisado)**:
  - **Opción A — refactor completo (6-8h)**: ZodDiscriminatedUnion explícito sobre los 52 códigos, eliminar `valorSchemaFor` runtime check, narrow types en todos los call sites.
  - **Opción B — mejora type-narrow (2h)**: mantener `valor: z.unknown()` en el envelope pero agregar generic type `parseExtraccion<C extends CajaCodigo>(raw, c?: C): Extraccion & { valor: ValorPorCaja<C> }` que tipa el resultado vía mapping type. Esto da type-safety en sites donde se conoce el caja_codigo (la mayoría) sin refactor masivo. Los sites que iteran sobre extracciones heterogéneas siguen viendo `unknown`.
  - **Decisión recomendada**: Opción B como paso intermedio; Opción A queda para v2 si el tipo `ValorPorCaja<C>` no cubre suficiente.
- **Esfuerzo realista**: 2h Opción B, 6-8h Opción A. **No bloquea piloto** (runtime check ya garantiza data correctness).

### 7. Audit log sin retention policy ✅ CERRADO (2026-05-13)

- **Archivo original**: `db/migrations/0006_sso_usuarios_audit.sql` — tabla `audit_admin_actions` (no `usuarios_admin_audit` como decía la deuda; nombre correcto en schema).
- **Estado**: cerrado 2026-05-13.
- **Cambios concretos**:
  - **Migración `0008_audit_indexes.sql`**: 2 indexes non-unique en `audit_admin_actions`. `(admin_user_id, created_at DESC)` acelera queries del panel admin "qué hizo X". `(action, created_at DESC)` acelera queries por action prefix + el cron de retention que filtra por action LIKE 'auth.%' etc.
  - **`db/schema.ts`**: agregada declaración Drizzle de los 2 indexes en la tabla `audit_admin_actions` para que `drizzle-kit` los regenere si se vuelve a sincronizar.
  - **`lib/inngest/functions/purgarAuditLog.ts` (nuevo)**: cron Inngest diario 03:00 UTC (21:00 CDMX) con 2 buckets:
    - Short (90 días): `auth.*`, `exports.*`, `login*` — alto volumen, bajo valor forensico.
    - Long (365 días): el resto, incluye `*.crear`, `*.editar`, `*.eliminar`, `*.revocar`, `magic_links.*` — destructivas o de mutación que pueden requerir forensics.
    DELETE batched de 1000 filas a la vez para no bloquear el panel admin; si quedan filas expiradas, el próximo run las limpia.
  - **`app/api/inngest/route.ts`**: function `purgarAuditLog` registrada junto a `sintetizarSesion`.
- **Criterio de cierre**:
  - [x] Definir retention policy (90d / 365d). *(2026-05-13)*
  - [x] Cron job Inngest para purgar. *(2026-05-13)*
  - [x] Indexes `(admin_user_id, created_at)` y `(action, created_at)`. *(2026-05-13)*
  - [x] typecheck limpio. *(2026-05-13)*
  - [ ] Aplicar migración 0008 a `vertice-mvp/main`. *(Pendiente — listado en `STATUS.md §3.1` junto a 0002/0004/0006/0007)*
- **Esfuerzo**: estimado 1h → real ~50 min.

---

## 🟢 Baja prioridad — backlog post-piloto

### 8. `fuente: 'usuario_tipea'` hardcoded en `/api/turn` ✅ CERRADO (2026-05-13)

- **Archivo original**: `app/api/turn/route.ts:269` (TODO ya removido).
- **Estado**: cerrado 2026-05-13. El enum DB `fuente_turno` ya tenía `'usuario_tipea'` y `'usuario_voz'` (de Fase 2 inicial), no requirió migración. La asimetría del item original (`usuario_dicta` vs `usuario_voz`) era solo de naming; el enum existente cumple el propósito.
- **Cambios concretos**:
  - `lib/state/entrevista.ts`: agregado `preguntas_con_stt: Record<string, boolean>` + action `marcarSttUsado(preguntaId)`. Reset en cada batch nuevo. En `enviarBatch`, computa `inputSource: 'voice' | 'keyboard' | 'mixed'` según cuántas preguntas del batch tienen el flag (todas→voice, ninguna→keyboard, mezcla→mixed).
  - `lib/state/entrevista.ts:fetch /api/turn`: agrega header `X-Vertice-Input-Source` con el valor computado.
  - `components/entrevista/HeroPregunta.tsx`: nueva prop `onSttAppend` invocada dentro del effect que aplica `appendTranscriptSegments`. Idempotente.
  - `app/entrevista/[sesion_id]/entrevista-shell.tsx`: wire del callback `marcarSttUsado(activePregunta.id)`.
  - `app/api/turn/route.ts`: lee header, mapea `voice|mixed → 'usuario_voz'`, default `keyboard → 'usuario_tipea'`. El caso 'mixed' colapsa a `usuario_voz` porque el componente voz es el discriminator más caro/notable; si en el futuro se necesita trackear mixto granular, agregar `usuario_mixto` al enum en una migración separada.
- **Criterio de cierre**:
  - [x] Cliente envía header `X-Vertice-Input-Source: voice|keyboard|mixed`. *(2026-05-13)*
  - [x] Server lee header y persiste el discriminator correcto. *(2026-05-13)*
  - [x] Migración para enum si hace falta. *(No hizo falta: `usuario_voz` ya existía en enum desde Fase 2)*
  - [x] typecheck limpio. *(2026-05-13)*
- **Esfuerzo**: estimado 1h → real ~45 min.

### 9. Chime audio mute toggle ✅ CERRADO (2026-05-13)

- **Estado**: cerrado 2026-05-13.
- **Cambios concretos**:
  - `lib/stt/chime.ts`: agregadas `isChimeMuted()` y `setChimeMuted(boolean)` que leen/escriben `localStorage['vertice:chime-muted']`. `playStartChime` y `playStopChime` ahora hacen early-return si muted. Dispatch de `vertice:chime-muted-change` CustomEvent para que la UI reactivamente se actualice sin polling.
  - `components/entrevista/ChimeMuteToggle.tsx` (nuevo): botón Volume2/VolumeX compacto con prop `surface: 'dark' | 'light'`. Hydration guard (placeholder shape estable) para evitar mismatch SSR vs cliente cuando el setting está muted de una sesión previa.
  - `app/entrevista/[sesion_id]/entrevista-shell.tsx`: toggle insertado en el header card 1 al lado del badge "Borrador autoguardado".
- **Criterio de cierre**:
  - [x] Setting persistido (localStorage) para mute.
  - [x] Botón toggle en el header del entrevista shell.
  - [x] typecheck limpio.
- **Esfuerzo**: estimado 30 min → real ~30 min.

### 10. O2 entrevista — BatchNav vs HeroPregunta desync animado

- **Documentado en**: `docs/bugs-encontrados-2026-05-11-e2e.md`.
- **Síntoma**: durante AnimatePresence del hero al cambiar de pregunta, el counter del nav inferior se actualiza unos ms antes que el hero. Cosmético, no afecta datos.
- **Esfuerzo**: 1h.

### 11. O2 STT — `pauseDetected` no dispara por MediaRecorder ✅ CERRADO (2026-05-13)

- **Documentado en**: `docs/archive/bugs/2026-05-11-stt.md`.
- **Síntoma original**: indicador visual de pausa nunca aparece. Decorativo, en `/demo/stt`. La causa raíz era que `lastAudioAtRef` se actualizaba con cada `ondataavailable` (cada AUDIO_CHUNK_MS) aunque el usuario no hablase, así que el polling sobre `lastAudioAtRef + PAUSE_MS` nunca disparaba `setPauseDetected(true)`.
- **Fix aplicado (2026-05-13)**: usar VAD events de Deepgram (`vad_events: 'true'` ya estaba en `STT_LIVE_CONFIG`).
  - `lib/stt/use-deepgram-stream.ts:DeepgramResultMessage` ampliada con campos `channel_index`/`last_word_end` para mensajes VAD (subset opcional, no rompe el shape Results).
  - `handleResult` ahora reconoce 2 mensajes nuevos: `SpeechStarted` → `setPauseDetected(false)`; `UtteranceEnd` → `setPauseDetected(true)`. Estos se emiten naturalmente por Deepgram tras `utterance_end_ms` de silencio (1000ms en config) y son la señal correcta de pausa.
  - El polling timer (`startPauseTimer` + `lastAudioAtRef`) se mantiene como fallback defensivo: si Deepgram dejara de emitir VAD events por config drift, el timer recupera la detección aunque imprecisa.
- **Criterio de cierre**:
  - [x] `handleResult` procesa `SpeechStarted` y `UtteranceEnd`.
  - [x] typecheck limpio.
  - [ ] Smoke en `/demo/stt`: hablar 5s, callar 2s, verificar que "Pausa >1.5s" se vuelve "sí" cuando dejas de hablar y "no" cuando retomas. *(Pendiente — requiere `DEEPGRAM_API_KEY` operativa)*
- **Esfuerzo**: estimado 30 min → real ~20 min.

### 12. Tests STT hook completos (jsdom + RTL)

- **Estado**: `lib/stt/use-deepgram-stream.ts` tiene tests aislados (`drain-buffer.test.ts`, `client.test.ts`) pero no del hook completo (lifecycle, retry, teardown, visibilitychange handler).
- **Impacto**: smoke manual del founder cubre lo esencial pero no es regression-safe.
- **Esfuerzo**: 4h.

### 13. Wave 2 admin redesign

- **Status**: post-piloto. No urgente.
- **Esfuerzo**: TBD.

### 14. Mobile/iPad responsive

- **Status**: post-piloto. Entrevista actual asume desktop.
- **Esfuerzo**: 6-8h.

### 15. `@ts-nocheck` pragmas en 2 tests STT — ✅ PARCIAL (`route.test.ts` cerrado 2026-05-13)

- **Archivos**:
  - `lib/stt/use-deepgram-stream.test.ts:1` — todavía con pragma. Bloqueado por dep `@testing-library/react` no instalada (depende de deuda #12).
  - `app/api/stt/token/route.test.ts:1` — pragma removido 2026-05-13. Fix paralelo: `POST()` ahora recibe un `Request` mock (matchea signature actual `POST(req: Request)`).
- **Estado**: pragmas agregadas en una sesión paralela mientras vitest 4 estabilizaba. Hoy el suite corre con `vitest@4.1.5` (ver `package.json:64`). El pragma de `route.test.ts` se removió sin instalar deps adicionales; el de `use-deepgram-stream.test.ts` requiere `@testing-library/react` que pertenece a deuda #12.
- **Impacto**: solo `use-deepgram-stream.test.ts` queda fuera del type-check; cualquier drift de tipos en `useDeepgramStream` no se atrapa hasta que se ejecuta el test.
- **Criterio de cierre**:
  - [x] Quitar `// @ts-nocheck` de `app/api/stt/token/route.test.ts:1`. *(2026-05-13)*
  - [ ] Quitar `// @ts-nocheck` de `lib/stt/use-deepgram-stream.test.ts:1`. *(Pendiente — bloqueado por #12)*
  - [x] `npx tsc --noEmit` sigue limpio post-cambio parcial. *(2026-05-13)*
  - [ ] Tests siguen verdes. *(Tests en `describe.skip`, no corren — validación cierra con #12)*
- **Esfuerzo**: estimado 30 min → real 15 min (parcial). Cierre completo bloqueado por #12.

### 16. TODO v2 — `array<string>` sin enum cerrado runtime

- **Archivo**: `lib/prompts/sonnet_fase1.ts:126` (`TODO(v2): Las cajas con tipo array<string> sin enum cerrado runtime...`).
- **Estado**: bloque XML `<formato_valores_por_caja>` describe los valores aceptados por cada caja, pero algunas cajas tipo `array<string>` (ej. `nm_productos_ofrecidos`, `nm_sectores_aceptados`, `gr_tipos_garantia`) declaran enum solo en docs, no runtime. El extractor de Sonnet puede emitir valores fuera del enum esperado sin que Zod los rechace.
- **Impacto**: silent drift en data normalizada. El admin viewer puede mostrar productos como `"credito_simple"` en una sesión y `"crédito simple"` en otra.
- **Criterio de cierre**:
  - [ ] Identificar las cajas afectadas (grep por `tipo_dato: 'array<string>'` en `CAJAS_CANON`).
  - [ ] Refactor `valorSchemaFor()` para devolver `z.array(z.enum([...]))` cuando hay enum declarado.
  - [ ] Backfill normalizado de datos existentes vía script idempotente.
- **Esfuerzo**: 2-3h.

### 17. TODO v2 — multi-turn memory para context window

- **Archivo**: `lib/state/entrevista.ts:161` (`TODO when we add multi-turn memory: emitir la conversación previa via...`).
- **Estado**: hoy cada turno arranca con un único `user` message (`mensaje_usuario`) sin contexto de turnos previos. Sonnet decide qué cajas atacar basado en el snapshot del mapa de incertidumbre que la tool `registrar_extraccion` retorna como `mapa_summary` + las extracciones persistidas, no en el historial conversacional crudo.
- **Impacto**: el modelo no puede recordar phrasing exacto de turnos anteriores ni referenciar lo que el aliado dijo "hace dos preguntas". Funciona porque el mapa de incertidumbre es suficientemente expressive, pero limita la naturalidad del flujo cuando el aliado dice cosas como "como te dije antes...".
- **Criterio de cierre**:
  - [ ] Diseñar el shape de "context previo" que se envía a Sonnet (último N turnos textual? sumario compactado?).
  - [ ] Trade-off de tokens vs calidad.
  - [ ] Wirar en cliente (estado Zustand) y en server (request shape de `/api/turn`).
- **Esfuerzo**: 3-4h. **v2 — no MVP**.

---

## Cómo usar este doc en sesión futura

1. Empezar con `npx vitest run` + `npx tsc --noEmit` para baseline limpio.
2. Elegir item por prioridad (🔴 antes que 🟡 antes que 🟢) o por dependencia (caso sintético desbloquea Opus generador prompts).
3. Para cada item:
   - Leer la sección completa (archivo:línea exacto).
   - Crear branch `tech-debt/<item-slug>`.
   - Implementar fix.
   - Marcar checklist `[x]` + agregar commit hash.
   - PR con referencia a este doc.
4. Cerrado el item, commit a este archivo marcando completado.

## Referencias

- `docs/alpha-readiness-2026-05-12.md` — reporte CTO + infra prod pendiente.
- `docs/HANDOFF.md` — punto de entrada cross-machine.
- `docs/smoke-entrevista-real-2026-05-12.md` — smoke real con voz.
- Memoria de proyecto: `~/.claude/projects/.../memory/project_pending_features_alpha.md`.
