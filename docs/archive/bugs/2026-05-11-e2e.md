# Bugs encontrados en E2E manual — 2026-05-11

Ejercitado el flujo completo magic-link → entrevista → /api/turn → siguiente
batch contra Sonnet 4.6 real con Chrome (claude-in-chrome MCP). 3 bugs
bloqueantes ya fueron arreglados in-session (commits separados); 3 follow-ups
quedan abiertos.

## Fixed in-session

### F1. Falta el botón "Enviar respuestas" en `entrevista-shell`
- **Síntoma**: El usuario marcaba la pregunta como definitiva pero no había
  forma de enviar el turno. `enviarBatch` del store nunca se invocaba desde
  el JSX. Comentario L15 declaraba la action row pero no se implementó.
- **Fix**: Botón solid ink en card-2 footer, ghost-slot anti-shift, estados
  `Faltan N pregunta(s)` / `Enviar respuestas →` / `Enviando…` /
  `Generando siguiente batch…`. Tutear, cursor-pointer en enabled.
- **Archivo**: `app/entrevista/[sesion_id]/entrevista-shell.tsx`

### F2. `Cannot read properties of undefined (reading 'startsWith')`
- **Síntoma**: Al enviar el turno, el cliente crasheaba parseando el stream.
  El server respondía 200 con SSE correcto, el bug era client-side.
- **Causa**: `readUIMessageStream` (AI SDK v6) espera
  `ReadableStream<UIMessageChunk>` (objetos), no bytes SSE crudos. La línea
  hacía `res.body as unknown as ReadableStream<never>` ocultando el mismatch.
- **Fix**: Replicar el pipeline de `DefaultChatTransport.processResponseStream`:
  `parseJsonEventStream({stream: res.body, schema: uiMessageChunkSchema})` +
  TransformStream que unwrap `{success, value/error}`.
- **Archivo**: `lib/state/entrevista.ts`

### F3. Sonnet termina turno tras 1 tool_call sin batch ni review
- **Síntoma**: Tras Enviar, Sonnet ejecutaba `registrar_extraccion` (cajas
  persistidas OK, panel actualizado) pero terminaba ahí. Cliente mostraba
  "El motor terminó el turno sin pedir review ni generar siguiente batch."
- **Causa**: AI SDK v6 `streamText` default es `stopWhen: stepCountIs(1)` —
  cierra tras la primera tool_call sin devolver tool_results al modelo para
  continuar.
- **Fix**: `stopWhen: stepCountIs(8)` en route.ts. Cubre el peor caso
  realista (extracción + review opcional + batch + buffer).
- **Archivo**: `app/api/turn/route.ts`

## Open follow-ups

### O1. Reload de `/entrevista/[id]` no rehidrata desde DB
- **Severidad**: Media (UX, no bloquea)
- **Síntoma**: Al reload, el store hace `init()` + `cargarPrimerBatch()`
  IGNORANDO los turnos ya persistidos en DB. Si el usuario ya respondió 5
  cajas de identidad y recarga, se le presenta de nuevo la pregunta hardcoded
  de bienvenida.
- **Lugar**: `app/entrevista/[sesion_id]/entrevista-shell.tsx:114-131`
- **Fix sugerido**: Al `init`, leer último turno agente con su batch_id de DB
  (vía Server Action / route handler nuevo) y rehidratar `batch_actual` +
  `cajas_llenas_por_grupo` desde el snapshot real, en vez de hardcoded.

### O2. `BatchNav` y `HeroPregunta` desincronizados durante AnimatePresence
- **Severidad**: Baja (cosmético, no afecta datos)
- **Síntoma**: Tras click rápido en `Siguiente`, el counter de BatchNav
  (`X / N`) avanza inmediatamente, pero el counter interno de HeroPregunta
  (`Pregunta XX de YY`) y la `aria-label` del textarea quedan en el valor
  previo durante los ~220ms de la transición de AnimatePresence (`mode="wait"`).
- **Causa**: AnimatePresence mantiene el HeroPregunta saliente en DOM mientras
  el nuevo monta. Las queries DOM (find tool, querySelector) ven al saliente.
- **Lugar**: `app/entrevista/[sesion_id]/entrevista-shell.tsx:305-327`
- **Fix sugerido**: Pasar `numero` y `aria-label` desde un derived state que
  actualice al INICIO del exit, no esperar al mount del entrante. Alternativa:
  cambiar `mode="wait"` a `mode="popLayout"` para que ambos coexistan
  visualmente sin colisión, o reducir duration a 100ms.

### O3. Con `stopWhen=8`, Sonnet emite múltiples `generar_batch_preguntas`
- **Severidad**: Media (data loss potencial — el usuario nunca ve el batch
  intermedio)
- **Síntoma**: En el turno post-identidad, Sonnet ejecutó:
  `registrar_extraccion` (5 cajas) → `generar_batch_preguntas` (Productos de
  crédito, 3 preguntas) → ... → `generar_batch_preguntas` (Números del negocio,
  3 preguntas). El store usa el ÚLTIMO batch extraído del stream (L474-480 con
  comentario "No break"), entonces el cliente ve Números sin nunca haber visto
  Productos.
- **Lugar**: `lib/state/entrevista.ts:474-480` + system_prompt de Sonnet
- **Fix sugerido (prompt)**: Reforzar en `lib/prompts/sonnet_fase1.ts` que
  `generar_batch_preguntas` se llama UNA SOLA VEZ por turno, después de
  registrar_extraccion. Si necesita avanzar más, debe usar
  `solicitar_review_seccion` y dejar que la próxima vuelta del usuario
  encadene.
- **Fix sugerido (código)**: Hacer break temprano en el for-await del store
  cuando llega el primer `generar_batch_preguntas`, o validar server-side que
  el step graph no permita 2 batches en un turno.
- **Trade-off de stopWhen**: bajar a `stepCountIs(3)` evita esto pero recorta
  el espacio para review_seccion + extracción + batch. Probablemente la mejor
  ruta es prompt-side.
