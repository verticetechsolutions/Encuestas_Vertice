# Deuda técnica — registro 2026-05-12

**Levantamiento**: sesión E2E del 2026-05-12 noche, post-commits `cc7de99` (Auth SSO) y `36026f7` (chime + anti em-dash).

**Estado del producto**: técnicamente listo para alpha. Esta deuda **no bloquea** el primer aliado piloto si se cubren los 7 items de infra prod (ver `docs/alpha-readiness-2026-05-12.md` §2.4). Cerrar en sesiones aparte, post-piloto si es posible.

**Convención**: cada item lleva archivo:línea (cuando aplique), impacto operativo, criterio de cierre y esfuerzo estimado. Marcar `[x]` cuando se cierre + commit hash al margen.

---

## 🔴 Alta prioridad — cerrar antes del 2do aliado

### 1. `solicitar_caso_sintetico` sigue stub

- **Archivo**: `app/api/turn/route.ts:533-545`
- **Estado**: `execute` returna `{ ok: true, todo_step_posterior: true }` sin invocar pipeline real. `OPUS_GENERADOR_CASOS_PROMPT_READY = false` en `lib/prompts/opus_generador_casos.ts:519`.
- **Impacto**: si Opus director decide `caso_sintetico` para destrabar una caja resistente, Sonnet recibe un ack vacío y no destraba. Sesión avanza con la caja en `decline_to_answer`. El cap de 5 casos por sesión limita el daño pero el feature está apagado de facto.
- **Criterio de cierre**:
  - [ ] Flippar `OPUS_GENERADOR_CASOS_PROMPT_READY = true` tras validar prompt + few-shots con founder.
  - [ ] Reemplazar stub por invocación al pipeline (referenciar `lib/motor/` scaffolding existente o crear nuevo módulo).
  - [ ] Wirar validador (`lib/prompts/opus_validador_casos.ts`, flag también está en false).
  - [ ] Test e2e con caso sintético real disparado por una respuesta evasiva persistente.
- **Esfuerzo**: 3-4h (sub-paso 5.iv del plan original).

### 2. Bug O3-marca race condition

- **Reproducible**: click "Marcar respondida" + click "Siguiente pregunta" con gap <2s. Solo se da en velocidad >humana (browser automation). Usuario humano natural no lo dispara.
- **Síntoma**: el contador global "X MARCADAS" cuenta solo la última pregunta marcada; las anteriores muestran banner "Respuesta marcada" individual pero quedan fuera del set global. El botón "Enviar respuestas" puede quedar deshabilitado ("Falta N pregunta") aunque el usuario marcó todas.
- **Localización tentativa**: race entre `marcarRespondida()` (Zustand `set()` síncrono, `lib/state/entrevista.ts:428`) y la navegación que cambia `pregIndex` via `setPregIndex` (`app/entrevista/[sesion_id]/entrevista-shell.tsx:98-102`).
- **Hipótesis**: closure de `activePregunta.id` se mantiene estable pero algún effect derivado resetea silently. Investigar React 19 transitions interactuando con `set()`.
- **Fix candidato**: envolver `setPregIndex` en `startTransition` o `flushSync` antes de cambiar pregunta, garantizando que el `set()` previo se commitee. Alternativa: usar `useTransition` en el callback.
- **Criterio de cierre**:
  - [ ] Test unit que reproduzca el race con timers fake.
  - [ ] Fix verificado en automation (browser_batch sub-segundo) sin desincronizar.
- **Esfuerzo**: 1-2h.

### 3. STT keyterms incompletos

- **Archivo**: `lib/stt/client.ts` — `STT_KEYTERMS` array (20 términos actuales: CNBV, CONDUSEF, CNSF, IPAB, UIF, SHCP, BANXICO, SOFOM, SOFIPO, SOCAP, IFC, IFPE, DSCR, CETES, TIIE, UDIS, SAT, RESICO, RFC, INDAVAL).
- **Faltantes confirmados en dictado del 2026-05-12**:
  - `Vértice` (transcribed como "Bértice", V→B confusion)
  - `factoraje` (transcribed como "facturaje", palabra inexistente)
  - `leasing`, `arrendamiento puro`, `quirografario`, `refaccionario`, `prendario`, `avio`, `habilitación`, `descuento`, `confirming`, `crédito simple`
- **Criterio de cierre**:
  - [ ] Agregar ≥10 términos del léxico crediticio MX al array.
  - [ ] Tests de `lib/stt/client.test.ts` actualizados (regression guard contra cambio silencioso).
  - [ ] Re-smoke con voz tras deploy: dictar "Vértice", "factoraje", "leasing" — transcribirse bien.
- **Esfuerzo**: 15 min.

---

## 🟡 Media prioridad — cerrar en próximas 2-3 semanas

### 4. Em-dashes residuales en few-shots de prompts

- **Estado**: regla anti em-dash agregada al system prompt de Sonnet y Opus en `36026f7`. Validado E2E que el modelo ya no produce em-dashes en heros/auxiliares nuevos.
- **Residuo**: 43 em-dashes en `lib/prompts/sonnet_fase1.ts` distribuidos en few-shots (respuestas simuladas del entrevistado), comentarios técnicos `//`, y descripciones de reglas. La mayoría son inputs del entrevistado (correcto, así habla la gente) o comentarios (no afectan al modelo). Algunos casos restantes en descripciones de reglas que el modelo lee.
- **Riesgo**: bajo. La regla nueva es lo suficientemente clara. Validado en 8+ batches que el modelo respeta.
- **Criterio de cierre**:
  - [ ] Sweep visual de los 43 em-dashes en `lib/prompts/sonnet_fase1.ts`.
  - [ ] Reemplazar por puntuación equivalente (coma, dos puntos, punto y aparte) en strings de regla y descripciones tool. Mantener em-dashes solo en `<respuesta_entrevistado>` (input simulado, OK).
  - [ ] Aplicar mismo sweep a `lib/prompts/opus_*.ts`.
  - [ ] Validar suite de prompts tests sigue verde.
- **Esfuerzo**: 30-45 min.

### 5. Cobertura tests en `app/admin/` y `app/actions/`

- **Estado**: 23 archivos críticos sin test adyacente (identificados por Explore agent 2026-05-12). Ejemplos: `app/actions/adminAuth.ts`, `app/actions/instituciones.ts`, `app/admin/api/export/[entity]/route.ts`, `app/admin/instituciones/[id]/page.tsx`.
- **Impacto**: regresiones en admin panel pasan silenciosas. Smoke manual del founder cubre los flujos críticos (generar magic link, crear institución, ver sesiones) pero no es regression-safe.
- **Criterio de cierre**:
  - [ ] Integration tests para `app/actions/instituciones.ts` (crear, editar, eliminar, listar) usando DB de test.
  - [ ] Integration tests para `app/actions/adminAuth.ts` (login, logout, session refresh).
  - [ ] Route tests para `app/admin/api/export/[entity]/route.ts` (CSV format + permisos).
  - [ ] Cobertura mínima 60% en `app/admin/` + `app/actions/`.
- **Esfuerzo**: 4-6h.

### 6. `z.unknown()` en schemas críticos

- **Archivos**:
  - `lib/schemas/extracciones.ts` — `ValorTablaGenericaSchema`, `ValorObjetoGenericoSchema`, `ExtraccionSchema.valor`.
  - `lib/schemas/review_seccion.ts` — campos `valor` en snapshots.
  - `lib/schemas/perfil_decision_final.ts` — idem.
  - `lib/motor/tools.ts` — `registrar_extraccion.valor`.
- **Mitigación actual**: runtime check via `valorSchemaFor(caja_codigo)` que sí tipa el valor según la caja específica. Sin esto, datos malformados llegarían a DB.
- **Impacto**: tipado weak en TS. Cualquier refactor del pipeline puede romper sin que tsc avise.
- **Criterio de cierre**:
  - [ ] Convertir `valor: z.unknown()` a discriminated union sobre `caja_codigo`.
  - [ ] Eliminar el uso de `valorSchemaFor` runtime check si el union ya cubre.
  - [ ] tsc limpio + tests pass.
- **Esfuerzo**: 2-3h.

### 7. Audit log sin retention policy

- **Archivo**: `db/migrations/0006_sso_usuarios_audit.sql` — tabla `usuarios_admin_audit` crece sin límite.
- **Impacto**: a 1 mes con 10 admins activos, ~30k rows. A 1 año, 400k+. Sin index strategy, las queries del panel admin se vuelven lentas.
- **Criterio de cierre**:
  - [ ] Definir retention policy (sugerencia: 90 días para login events, 1 año para acciones destructivas).
  - [ ] Cron job (Inngest) para purgar rows viejas.
  - [ ] Indexes en `(actor_id, created_at)` y `(action_type, created_at)`.
- **Esfuerzo**: 1h.

---

## 🟢 Baja prioridad — backlog post-piloto

### 8. `fuente: 'usuario_tipea'` hardcoded en `/api/turn`

- **Archivo**: `app/api/turn/route.ts:269`
- **Estado**: cada respuesta del entrevistado se persiste con `fuente: 'usuario_tipea'` independientemente de si vino de teclado o de STT (voz dictada). Comentado como `// TODO Fase 6 voz: discriminar según source request`.
- **Impacto**: telemetría imprecisa para análisis post-mortem (¿qué porcentaje de respuestas son dictadas vs tipeadas?). No afecta funcionalidad.
- **Criterio de cierre**:
  - [ ] Cliente envía header `X-Vertice-Input-Source: voice|keyboard|mixed`.
  - [ ] Server lee header y persiste el discriminator correcto.
  - [ ] Migración para enum `('usuario_tipea','usuario_dicta','usuario_mixto')` si no existe.
- **Esfuerzo**: 1h.

### 9. Chime audio mute toggle

- **Estado**: chime start/stop wirado en `lib/stt/chime.ts` + `lib/stt/use-deepgram-stream.ts` (`36026f7`). Volumen pico 0.08, sine wave. No hay forma de silenciarlo desde la UI.
- **Impacto**: minor. Algunos entrevistados podrían encontrar el chime intrusivo.
- **Criterio de cierre**:
  - [ ] Setting persistido (localStorage) para mute.
  - [ ] Botón toggle en el header del entrevista shell.
- **Esfuerzo**: 30 min.

### 10. O2 entrevista — BatchNav vs HeroPregunta desync animado

- **Documentado en**: `docs/bugs-encontrados-2026-05-11-e2e.md`.
- **Síntoma**: durante AnimatePresence del hero al cambiar de pregunta, el counter del nav inferior se actualiza unos ms antes que el hero. Cosmético, no afecta datos.
- **Esfuerzo**: 1h.

### 11. O2 STT — `pauseDetected` no dispara por MediaRecorder

- **Documentado en**: `docs/bugs-encontrados-2026-05-11-stt.md`.
- **Síntoma**: indicador visual de pausa nunca aparece. Decorativo, en `/demo/stt`.
- **Fix**: usar Deepgram `vad_events` en lugar de calcular pausa client-side.
- **Esfuerzo**: 30 min.

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
