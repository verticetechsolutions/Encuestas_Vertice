# Smoke E2E STT — Bugs encontrados 2026-05-11

Ejercitado el flujo `/demo/stt` con voz real contra Deepgram Nova-3 multilingual usando claude-in-chrome MCP. Cubre 7 escenarios: happy path, code-switch ES↔EN con jerga financiera, pausa, tab switch, edición inline, mic denegado, reload mid-stream.

3 bugs **bloqueantes** fixeados in-session (commits sugeridos abajo). 2 bugs **menores** corregidos. 2 **follow-ups** abiertos.

## Fixed in-session

### F1. Deepgram API key sin scope `tokens:write`
- **Síntoma**: `/api/stt/token` retornaba 502 con `token_grant_failed`. `getUserMedia` OK, status pegado en `connecting` para siempre.
- **Causa**: la key `DEEPGRAM_API_KEY` original era role **Default** (solo `usage:write`). El endpoint `/v1/auth/grant` requiere role **Member** o superior para mintar JWTs efímeros. `POST https://api.deepgram.com/v1/auth/grant` retornaba `403 {"err_code":"FORBIDDEN","err_msg":"Insufficient permissions."}`.
- **Fix**: nueva key generada vía console.deepgram.com con role **Member** (mínimo necesario por menor privilegio). Comentario: `vertice-stt-2026-05-11`. Reemplazada en `.env.local:7`. La vieja key (`vertice-form`) queda sin uso productivo — recomiendo revocarla.

### F2. `@deepgram/sdk@5.1.0` requiere `socket.connect()` explícito
- **Síntoma**: socket abre (`status='streaming'` nunca dispara), WebSocket interno nunca se construye. Status pegado en `connecting`.
- **Causa**: SDK v5 introdujo el wrapper `createWebSocketConnection` que crea ReconnectingWebSocket con **`startClosed: true`** deliberadamente. El caller TIENE que llamar `socket.connect()` después de registrar handlers para que `reconnect()` resetee `_shouldReconnect=true` y abra el ws real. Sin esto, `_connect()` retorna early en la primera línea (`if (this._connectLock || !this._shouldReconnect) return;`) y nunca llega a `new WebSocket(url, protocols, options)`.
- **Fix**: agregado `socket.connect()` al final de `boot()` en `lib/stt/use-deepgram-stream.ts:357` después de los `socket.on(...)`.
- **Archivo**: `lib/stt/use-deepgram-stream.ts`

### F3. Browser WebSocket no entrega `Authorization` header
- **Síntoma**: incluso con `socket.connect()` corriendo, Deepgram cerraba el handshake con code `1006` (abnormal closure).
- **Causa**: el SDK pasa `Authorization: Bearer <jwt>` como header HTTP, pero **browser WebSocket no soporta custom headers** (solo Node.js `ws` package). Deepgram nunca recibe el token y rechaza.
- **Fix**: pasar el JWT también vía **subprotocol** `['bearer', token]` al `dg.listen.v1.connect({..., protocols: ['bearer', token]})`. El SDK pasa este array al constructor `new WebSocket(url, this._protocols, options)`. Deepgram acepta el subprotocol como auth válido (verificado con raw WebSocket: open + `protocol: "bearer"` sostenido 8s).
- **Archivo**: `lib/stt/use-deepgram-stream.ts:248`

### F4. Selección bloqueada por `contentEditable` per-segmento
- **Síntoma**: en `TranscriptionPanel`, imposible seleccionar texto cruzando segmentos. Cada `<span contentEditable>` creaba editing-context aislado en el browser → drag-to-select no cruzaba la barrera.
- **Fix v1 (insuficiente)**: opt-in via doble-click. Resolvía la selección entre segmentos en modo NO edit, pero en edit mode seguía limitando selección a UN solo segmento.
- **Fix v2 (final)**: **un solo `<div contentEditable>` wrapper** envuelve TODOS los segmentos en modo edit. Drag-to-select y Ctrl+A funcionan sobre el texto completo. Al `blur`: walk segmentos por `data-segment-id` markers, diffea cada uno contra snapshot, dispara `onEdit(id, newText)` para los cambiados.
- **Archivo**: `components/stt/TranscriptionPanel.tsx`

### F5. React `NotFoundError: Failed to execute 'insertBefore' on 'Node'` durante streaming
- **Síntoma**: tras F4, llegaba un nuevo segmento del stream mientras el user estaba en modo edit y React colapsaba con `insertBefore` apuntando a un nodo que ya no era hijo del padre.
- **Causa**: React reconciliando hijos dentro de un `<div contentEditable>` cuyo DOM fue tocado externamente (user editing + browser normalizando text nodes). Los refs de virtual DOM divergían del DOM real.
- **Fix**: 3 defensas:
  1. **Wrapper siempre montado** (no condicional sobre `isEmpty`) — evita swap de `<p>` ↔ `<div contentEditable>` cuando llega el primer segmento.
  2. **Snapshot inmutable durante edit** (`snapshotRef.current = transcripts.history` al entrar). Mientras edita, render usa snapshot — segmentos nuevos del stream NO se renderizan hasta blur.
  3. **`editKey` cambia al `blur`** — React unmount/remount el wrapper, descarta el DOM editado por user y monta uno fresco desde state.
- **Archivo**: `components/stt/TranscriptionPanel.tsx`

## Minor corrections

### M1. `smart_format=true` aplicaba title-case agresivo a preposiciones españolas
- **Síntoma**: "Subdirector De Crédito De Banco Demo" (incorrecto). Deepgram capitalizaba `De`, `Del`, `Con` interpretando "X de Y de Z" como nombres propios multi-palabra (sesgo del modelo entrenado sobre todo en EN).
- **Fix**: omitido `smart_format` del config (Deepgram **rechaza `smart_format=false`** con close 1006 — solo acepta `true` o ausencia del param). Acrónimos como `DSCR`, `SOFOM` los conserva el lenguaje `multi` solo. `punctuate: 'true'` se mantiene por separado para puntos y comas.
- **Archivo**: `lib/stt/client.ts:28`

### M2. `/api/stt/token` catch traga error real
- **Síntoma**: catch silente — frontend solo veía `token_grant_failed` y el origen real (403 Deepgram, network, etc.) era invisible. Hizo F1 mucho más lento de diagnosticar (curl manual al endpoint Deepgram).
- **Fix**: `logger.error('stt.token_grant_failed', { sesion_id, error_message })` antes del 502.
- **Archivo**: `app/api/stt/token/route.ts:73`

## Open follow-ups

### O1. Primera palabra/sílaba se pierde al inicio del dictado
- **Severidad**: media. Sistemáticamente la primera palabra se corta si hablas inmediatamente al click del mic.
- **Síntoma**: dicta "Estoy probando" → captura "Es" como primer segmento. Otra prueba: dicta "Hola, soy el subdirector" → captura "Hola, hola, hola" (filler) seguido de la frase real, mismo gap.
- **Causa**: cold-start gap entre `socket.open` y `MediaRecorder.start()`. El recorder arranca DESPUÉS de que el ws abre (line 309 del hook). Si el user empieza a hablar inmediatamente, audio del primer ~200–400ms no se manda.
- **Fix sugerido**: arrancar `MediaRecorder` **al click del mic** (no al socket.open). Bufferear los chunks en memoria. Cuando socket abre, drenar el buffer enviando los chunks acumulados primero. Trade-off: hay que cancelar el recorder si el token endpoint falla.
- **Archivos**: `lib/stt/use-deepgram-stream.ts:320-329` (la lógica del open handler), `lib/stt/use-deepgram-stream.ts:385-388` (donde se construye el recorder).

### O2. `pauseDetected` nunca dispara
- **Severidad**: baja. Feature decorativo en `/demo/stt`, no implementado en `HeroPregunta`.
- **Síntoma**: el indicador "Pausa >1.5s" se queda en `no` aunque te calles 3s+.
- **Causa**: `lastAudioAtRef.current = Date.now()` se actualiza con cada `MediaRecorder.ondataavailable`. Pero MediaRecorder emite chunks de Opus también en silencio (codec encodea blobs de silencio no-cero). El timer del hook nunca cruza el threshold de 1500ms.
- **Fix sugerido**: usar **`vad_events: true`** (ya está en `STT_LIVE_CONFIG`). Deepgram emite eventos `SpeechStarted` y `UtteranceEnd` que sí son detección VAD real. Cambiar `pauseDetected` para basarse en esos eventos en lugar de timestamps de MediaRecorder.
- **Archivos**: `lib/stt/use-deepgram-stream.ts:208-237` (`handleResult`), `lib/stt/use-deepgram-stream.ts:268-278` (`startPauseTimer`).

## Cosas que SÍ funcionaron limpio

- Happy path en español: 3 segmentos, todos los términos capturados correctamente.
- Code-switch ES↔EN: `covenant`, `leverage`, `stress test`, `DSCR`, `equity ratio`, `revenue`, `margin call` — Nova-3 multi captura todo. WER ~7.5% en frases largas (3 errores fonéticos menores tipo "veces" → "meses").
- Acrónimos uppercase preservados sin `smart_format` (DSCR, SOFOM).
- Tab switch (visibilitychange): `MediaRecorder.pause/resume` funcionó limpio, ambos segmentos pre/post-switch completos.
- Mic denegado: `classifyMicError(NotAllowedError)` → mensaje en español visible, icono `AlertTriangle`, status `error`. UX correcto.
- Reload mid-stream: cleanup del `useEffect` cierra socket + tracks + recorder sin warnings ni ECONNRESET. Esperado que se pierdan transcripts en `/demo/stt` (no persiste a DB; bug O1 del E2E previo cubre el caso productivo `/entrevista`).
- Editar mientras grabas: snapshot pattern aguantó. No crash. Segmentos nuevos del stream se quedaron pendientes hasta blur.

## Commits sugeridos

```
fix(stt): wire socket.connect() para abrir ws con SDK v5+ wrapper

feat(stt): subprotocol auth ['bearer', token] para browser WS

fix(stt): single contentEditable wrapper en TranscriptionPanel
  + snapshot pattern para evitar React insertBefore crash

chore(stt): omitir smart_format (preposiciones ES en title-case)

chore(stt/route): logear error real en token_grant_failed

chore(env): rotar DEEPGRAM_API_KEY a role Member
```

## Para el siguiente E2E

- Validar STT en `/entrevista/[sesion_id]` real (no `/demo/stt`). Verificar que `HeroPregunta` (line 94-118) concatena segmentos al textarea, que `cargarPrimerBatch` no rompe stream, y que reset al cambiar de pregunta funciona.
- Smoke iOS Safari (riesgo de `MediaRecorder` con `audio/mp4` y PWA standalone).
- Atacar O1 (cold-start) antes de prod — pérdida de primera palabra es notable para founders.
