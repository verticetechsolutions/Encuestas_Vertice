# Smoke entrevista REAL — 2026-05-12

Primer end-to-end con voz dictada en `/entrevista/[sesion_id]` (no `/demo/stt`). Cerró el loop **magic link → bienvenida → consent → entrevista → mic → STT → textarea → autosave → /api/turn → Sonnet 4.6 → tools → DB → siguiente batch**.

**TL;DR**: el flujo funciona. Latencia turn-to-turn es **el bloqueante #1 para shipear** (124s en turn 1). WER en español tiene errores graves en acrónimos regulatorios. 2 follow-ups del E2E previo se confirmaron en producción.

## Lo que funciona end-to-end

- ✅ Magic link → bienvenida → consent → /entrevista. Cookie `vertice_session` correcta.
- ✅ Mic stream live concatena segmentos al textarea (`appendTranscriptSegments` funciona).
- ✅ Autosave dispara con cada keystroke STT-driven.
- ✅ "Marcar respondida" → "Enviar respuestas" → POST /api/turn → SSE stream.
- ✅ Sonnet emite `registrar_extraccion` (vimos cajas llenándose en sidebar: 0 → 4 → 6).
- ✅ Sonnet emite `generar_batch_preguntas` con preguntas contextualmente relevantes (siguió la conversación: "agroindustria como eje central — tiene mucho sentido si esos son los sectores con mayor volumen y rotación").
- ✅ AnimatePresence transitions entre preguntas funcionan visualmente.
- ✅ Botón state machine: "Marcar respondida" → "Enviar respuestas →" → "Generando siguiente batch…" → "Faltan N preguntas".

## Bloqueante: latencia turn

| Turn | Click "Enviar" → siguiente batch visible | Cajas llenadas |
|---|---|---|
| 1 | **124s** | 4 (identidad) |
| 2 | ~50-70s (no medido con precisión) | 2 (productos) |

Para una entrevista de 30-45 min con 20-30 turnos:
- Tiempo total = 30 min usuario hablando + (20 × ~90s) **= 60 min mínimo, hasta 80**.
- La subdirectora pasa de "entrevista de 30 min" a "1 hora sentada". **Romper.**

### Root cause hipotetizado

`app/api/turn/route.ts:467-487` — la herramienta `solicitar_review_seccion` invoca `processSolicitarReview` que llama Opus director con **`providerOptions.anthropic.thinking` budget 8K** (lib/motor/review.ts). Opus 4.7 con extended thinking típicamente 15-60s por llamada.

Sumando: Sonnet streaming inter-step (~3s/c) + Opus call (30-60s) + DB ops (~1s) + SSE consumo ≈ **60-90s motor puro**. Concuerda con 124s observado.

### Fixes posibles (por costo de implementación)

1. **Bajar thinking budget a 2-4K** (1 línea). Opus 4.7 razona aún bien con menos. Posible ahorro: 30-50% del tiempo Opus.
2. **Sonnet NO llama `solicitar_review_seccion` cada turno** (ajuste prompt en `lib/prompts/sonnet_fase1.ts`). Solo al cerrar sección o cada N turnos. Posible ahorro: 80% del tiempo en turnos sin review.
3. **Stream el batch en paralelo con Opus review** (cambio arquitectónico). Opus pasa a ser "post-mortem hint" del próximo turn. Mayor complejidad pero hace el UX fluido.
4. **Skip review si confianza promedio de extracciones > threshold** (lib/motor/review.ts). Si Sonnet capturó las cajas con alta confianza, Opus es overkill.

**Recomendación CTO**: aplicar #1 y #2 ahora. Medir. Si sigue >30s p50, implementar #3 antes de fase 2 (Vercel staging).

## Bug crítico: WER en acrónimos regulatorios

**Caso observado** (turn 1, dictado: "SOFOM regulada bajo CNBV y CONDUSEF"):

> Transcrito: "SOFOM regulada bajo **CNVB** y CONDUSEF"

`CNBV` (Comisión Nacional Bancaria y de Valores) → `CNVB` (transposición V/B). Sonnet recibe el texto crudo y puede no reconocer "CNVB" como el regulador → la extracción de `regulador_principal` queda incorrecta o vacía.

Mismos tipos de error esperables en: CONDUSEF, CNSF, IPAB, UIF, INDAVAL, CNH, CRE.

### Fixes posibles

1. **Keyterm prompt en Deepgram** — config `keyterm: 'CNBV,CONDUSEF,CNSF,SOFOM,SOFIPO,IPAB,UIF,DSCR'`. Deepgram lo soporta como hint en `STT_LIVE_CONFIG`. Bajaría WER en esos términos.
2. **Post-process client-side**: regex que normaliza variantes comunes ("CNVB" → "CNBV") antes de mandar a `/api/turn`. Lista corta de acrónimos mexicanos del sector financiero.
3. **Prompt Sonnet con tolerancia a errores fonéticos**: que reconozca "CNVB" como CNBV. Cambio en `lib/prompts/sonnet_fase1.ts`. Pero esto es band-aid; mejor arreglar la fuente.

**Recomendación**: aplicar #1 (keyterm). Es la fuente de la verdad y costo cero.

## Bug crítico: duplicación de frases en respuestas con muletillas

**Caso observado** (turn 2, dictado: "No tenemos ningún sector excluido, aceptamos a todos"):

> Transcrito: "No tenemos ni no tenemos ninguno. Aceptamos todos. Nada"

Deepgram interpretó las muletillas/auto-correcciones del hablante y produjo texto repetitivo + truncado. "Aceptamos a todos" perdió la "a"; agregó "Nada" sin contexto.

Esto es comportamiento esperable de un modelo STT con hablante natural (corrige a la mitad de la frase). Pero el texto resultante es **semánticamente erróneo** y va a `/api/turn` como respuesta válida.

### Fixes posibles

1. **UI: mostrar transcript en vivo al user mientras dicta** (ya lo hace el textarea, pero está lejos del foco visual del que habla — la pregunta es enorme arriba). Considerar UI feedback más cerca del mic.
2. **Habilitar `endpointing` o `utterance_end_ms` en Deepgram** para mejorar segmentación. Default es agresivo y puede estar concatenando muletillas.
3. **Sonnet prompt: detecta respuestas que parecen erróneas/inconsistentes y pide aclaración** ("¿confirmas que aceptan todos los sectores?"). Pero es band-aid de nuevo.

**Recomendación**: combinar UI feedback (#1) + utterance_end_ms tuning (#2). Validar empíricamente con 5+ dictados naturales.

## Confirmados del E2E previo

- **O1 entrevista (rehidratar reload)**: no probado en este smoke, pendiente.
- **O2 entrevista (BatchNav vs HeroPregunta desync)**: confirmado visualmente — al transicionar al siguiente batch, el counter de batch nav cambió antes que el contenido del hero. Cosmético.
- **O3 entrevista (múltiples generar_batch_preguntas en un turno)**: NO se reprodujo en estos 2 turnos. Cada turn produjo 1 solo batch.

## Confirmados del smoke STT previo

- **O1 STT (cold-start primera palabra)**: confirmado. Turn 2 textarea muestra "No tenemos ni no tenemos ninguno" — la primera palabra ("No" o lo que sea que dijiste) probablemente se perdió y Deepgram recompuso lo que pudo escuchar.
- **WER 7.5%**: confirmado a peor. Con respuestas conversacionales y muletillas, WER subió notable. Estimado 10-15%.

## Founder feedback post-smoke (2026-05-12)

Dos pendientes que surfaceó la fundadora al ver el flujo end-to-end por primera vez:

### F1. Rediseñar `/entrevista/[id]/bienvenida` (consent) al Design System

**Estado actual** (`app/entrevista/[sesion_id]/bienvenida/page.tsx`): página con `style={{ fontFamily: 'system-ui' }}` inline, colores hardcoded (`#f6f6f5`, `#1a1a1a`, `#444`), sin tokens del DS (cream-pure, ink, gold, hairlines), tipografía sin jerarquía de display, sin atmosphere espejo entrevista.

**Lo que tiene que cambiar**:
- Background: `bg-survey-bg` o `cream-pure` consistente con `/entrevista`.
- Typography: display H1 (Plex/Geist Sans) con clamp + eyebrow gold-deep. Body en Plex Mono o satoshi.
- Card aviso de privacidad: `bg-survey-card-2` + hairline `border-survey-hairline-strong`, no `#f6f6f5`.
- Botón "Iniciar entrevista": `bg-ink text-cream-pure` solid pill consistente con CTA del hero/entrevista.
- Checkbox: custom con accent gold, no default browser.
- Atmosphere: opcional SVG morphing o gradient sutil para que se sienta del mismo lenguaje visual que la entrevista.

**Referencias**: `app/entrevista/[sesion_id]/entrevista-shell.tsx` para tokens correctos. `components/entrevista/HeroPregunta.tsx` para typography ratios.

**Trabajo estimado**: 1.5-2h (refactor pequeño + 1-2 iteraciones visuales).

### F2. Mejorar prompts Sonnet: preguntas más cortas y con formato de pregunta

**Problema observado** (turn 1 + turn 2 de este smoke):

Turn 1 (pregunta hardcoded en `lib/state/entrevista.ts:PRIMER_BATCH_BIENVENIDA`):
> "Para arrancar, cuéntanos sobre tu institución: razón social, nombre comercial si lo manejan, qué tipo son (banco, sofom, sofipo, arrendadora, etc.), bajo qué entes están regulados (CNBV, CONDUSEF, UIF), y cuántos años llevan operando."

→ Es una lista, no una pregunta. Cubre 5 cajas. Es difícil de digerir y de contestar (cubrir todo en una sola respuesta es agotador, además de propenso a olvidar campos).

Turn 2 (generado por Sonnet via `generar_batch_preguntas`):
> "agroindustria como eje central — tiene mucho sentido si esos son los sectores con mayor volumen y rotación en el mercado que atienden. ¿En qué estados o regiones del país están originando hoy?"

→ Tiene preamble conversacional largo antes de la pregunta. La subdirectora tiene que leer 30 palabras antes de saber qué le están preguntando. **El preamble es agradable pero entierra la pregunta**.

**Lo que tiene que cambiar**:
- Hardcoded del primer batch: dividir en 2-3 preguntas separadas, cada una 1-2 líneas máximo, formato de pregunta clara (terminar en `?`). Reescribir `PRIMER_BATCH_BIENVENIDA` en `lib/state/entrevista.ts`.
- Prompt Sonnet (`lib/prompts/sonnet_fase1.ts`): añadir/reforzar instrucción que las preguntas que emita via `generar_batch_preguntas` cumplan:
  - **Máximo 2 líneas (≈25 palabras).**
  - **Empiezan con interrogativa** (¿Qué…?, ¿Cómo…?, ¿Cuánto…?).
  - **Preamble conversacional, si lo necesita, va separado** (campo `auxiliar` ya existe — `splitPreguntaYAuxiliar` lo separa visualmente). El "Y/Si/¿..." pattern del split sirve para esto.
  - **Una pregunta = una caja idealmente**, no varias en cascada con "y / y / y".
- Pasarle ejemplos few-shot a Sonnet de preguntas BIEN formuladas vs preguntas MAL formuladas (anti-patterns).

**Trabajo estimado**: 2-3h (prompt tuning + ajuste de `PRIMER_BATCH_BIENVENIDA` + validar con smoke).

---

## Recomendación CTO (qué hacer la próxima sesión)

**Esta sesión:** STOP. Tenemos data suficiente.

**Siguiente sesión, en orden** (priorizando founder feedback antes que latencia porque UX inmediato es lo que mata o salva la primera impresión de un aliado):

0. **F1 — Rediseño consent al DS** (1.5-2h). Prerequisito para que la primera pantalla no rompa el visual lenguaje.
0b. **F2 — Prompts Sonnet preguntas cortas** (2-3h). El segundo eslabón de UX inmediato. Sin esto, el flow se siente "ChatGPT con lista de campos" en vez de "entrevista guiada".

1. **Latencia turn (1-3h trabajo):**
   - Reducir Opus thinking budget en `lib/motor/review.ts` de 8K a 2K. Medir.
   - Ajustar prompt Sonnet para que llame `solicitar_review_seccion` solo al cerrar sección.
   - Re-correr smoke 2 turns. Objetivo: <30s p50.

2. **STT keyterms (30 min):**
   - Agregar `keyterm: 'CNBV,CONDUSEF,CNSF,SOFOM,SOFIPO,IPAB,UIF,DSCR,CETES'` a `STT_LIVE_CONFIG`. Verificar con dictado de acrónimos.

3. **Cold-start STT (2h):**
   - Implementar buffer de audio. Arrancar MediaRecorder al click, drenar al socket.open. (Bug O1 STT documentado).

4. **Después de eso, smoke real otra vez** — entrevista entera con dictado, medir latencias finales, costo en USD por entrevista (sumar facturas Anthropic + Deepgram).

5. **Si latencia y costo OK, mover a fase 2**: Vercel staging.

**No hacer antes:**
- Wave 2 admin redesign.
- Mobile/iPad.
- O2 entrevista cosmético.
- O3 entrevista (no se reprodujo).
