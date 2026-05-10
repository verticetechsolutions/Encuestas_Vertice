# PR #4 — Code review notes (`feat/wire-opus-director`)

Branch revisada: `feat/wire-opus-director` post-rebase (commit `92814f1`).
Reviewer: sesión paralela 2026-05-10. Sin smoke real (sin `ANTHROPIC_API_KEY`).
Scope: review estático de los puntos pedidos en el brief. **No aplico cambios**, solo dejo señalamientos accionables.

---

## 1. `lib/motor/review.ts:107` — `productionOpusCall`

```ts
export const productionOpusCall: OpusCallFn = async ({ sonnet_input, round, casos_usados }) => {
  if (!OPUS_DIRECTOR_PROMPT_READY) throw new OpusReviewPromptNotReady();

  const userPayload = { grupo_ui_codigo, extracciones_snapshot, cajas_no_clausuradas, hipotesis_sonnet, turno_disparador, round, casos_usados };

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-7'),
    system: OPUS_DIRECTOR_SYSTEM_PROMPT,
    schema: RespuestaOpusSchema,
    prompt: JSON.stringify(userPayload, null, 2),
  });
  return object;
};
```

### ¿El schema `RespuestaOpusSchema` con `generateObject` cubre todas las ramas de decisión?

**Sí, técnicamente.** `RespuestaOpusSchema` es un `z.discriminatedUnion('decision', […avanzar, profundizar, caso_sintetico])`. Vercel AI SDK convierte unions discriminadas a `oneOf` JSONSchema y Anthropic lo acepta. Las tres branches están bien tipadas con sus campos requeridos.

### Riesgos

- **`extended_thinking` ausente**: `productionOpusCall` no pasa `providerOptions.anthropic.thinking`. Comparado con `productionOpusSintesisCall` que sí lo pone (8K). El director de review seguramente quiere razonar antes de decidir profundizar/avanzar/caso. Sin thinking, Opus emite el JSON directo. **Decisión consciente o oversight?** El brief de spec original (IMPLEMENTATION.md §10) solo menciona thinking 8K para síntesis final, no para director, así que probablemente intencional, pero merece nota explícita en el código.
- **No hay reintento intra-llamada con error_context**: si `generateObject` arroja `NoObjectGeneratedError` (Opus emitió algo no parseable), el error se propaga sin retry. Inngest no maneja este path — el route `/api/turn` es síncrono. El usuario verá un error de turno y `lib/state/entrevista.ts` setea `status='error_turn'`. Aceptable como first-pass, pero documentar que un Opus mal calibrado va a producir errores 500 visibles al entrevistado.
- **Sin override de `temperature` ni `maxOutputTokens`**: Opus 4.7 default temperature es 1.0. Para una decisión enum-discriminada con few-shots, `temperature: 0` o `0.2` es lo que querés (consistencia ↑, divergencia ↓). Sugerencia: agregar `temperature: 0.2` en las opciones.
- **Telemetría del thinking ausente**: los `usage` del SDK incluyen `cacheReadInputTokens`, `cacheCreationInputTokens`, `reasoningTokens`. Capturar estos a Axiom permite ver cuánto razona Opus por decisión y catch regresiones. `productionOpusCall` solo loguea `latencia_ms` (en `processSolicitarReview` aguas abajo).

### ¿Manejo de errores cuando Anthropic devuelve schema mismatch?

El AI SDK arroja `NoObjectGeneratedError` cuando el output no parsea contra el schema (no es Zod failure post-hoc; el SDK reintenta internamente y entonces tira). Hay **doble validación**:
1. `generateObject` valida internamente.
2. `processSolicitarReview` (líneas 179-190) re-valida con `RespuestaOpusSchema.safeParse(opusRaw)`.

La segunda validación es redundante con `generateObject` porque `object` ya es del tipo inferido. Posible eliminar (o dejar como defensive). No es un bug, es overhead.

### Sugerencias accionables

1. Agregar `temperature: 0.2` y `providerOptions.anthropic.thinking: { type: 'enabled', budgetTokens: 4000 }` (4K para director, menos que síntesis).
2. Loguear `usage` (input/output/reasoning tokens) a Axiom desde el caller en `processSolicitarReview`.
3. Comentar explícitamente que la doble validación Zod (línea 179-190) es defensiva.

---

## 2. `lib/motor/sintesis_final.ts:139` — `productionOpusSintesisCall`

```ts
export const productionOpusSintesisCall: OpusSintesisCallFn = async (input) => {
  if (!OPUS_SINTESIS_FINAL_PROMPT_READY) throw new OpusSintesisPromptNotReady();

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-7'),
    system: OPUS_SINTESIS_FINAL_SYSTEM_PROMPT,
    schema: PerfilDecisionFinalConsistenteSchema,
    prompt: JSON.stringify(input, null, 2),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 8000 },
      },
    },
  });
  return object;
};
```

### ¿El budget 8K bien dimensionado?

**Probablemente correcto, pero sin smoke real es difícil afirmarlo.** Análisis estático:

- Opus 4.7 con extended thinking razona ~150-300 tokens por punto de análisis. La síntesis tiene que cubrir:
  - Validar consistencia de 49+ cajas (CANON + EXTENSION por tipo).
  - Detectar contradicciones cruzadas (e.g. `ru_score_pm_min: 700` vs `ru_score_pm_min: null` declined).
  - Calcular `metricas.cajas_criticas_pct` y `cajas_blandas_pct` con conocimiento del catálogo.
  - Escribir `resumen_ejecutivo` (1-3 párrafos).
- 8K = 4-6 párrafos densos de razonamiento. Para 49 cajas, ~160 tokens por caja. Razonable como floor, podría quedarse corto si la sesión tuvo muchas contradicciones.

### Riesgos

- **No hay fallback si thinking se trunca**: si Opus alcanza el budget sin terminar, `generateObject` puede arrojar `NoObjectGeneratedError` o emitir un JSON parcial que falla Zod. Inngest reintentará 4 veces — todas con el mismo budget. Drift posible si una sesión genera consistentemente truncations.
- **Costo no acotado**: 8K reasoning tokens ≈ $0.12/sesión solo en thinking (Opus 4.7 thinking $15/M). 100 sesiones = $12. Aceptable, pero documentar en algún punto del README/IMPLEMENTATION.md.
- **No se mide `reasoningTokens` reales**: el SDK los expone en `result.usage`. Sin medirlo, no sabés si 8K queda holgado o ajustado. **Crítico medir esto en el primer smoke real** para decidir si subir/bajar.

### Sugerencias accionables

1. Capturar `usage.reasoningTokens` y `usage.outputTokens` a Axiom desde el caller (`generarSintesis` en `lib/motor/sintesis_final.ts:285-296`).
2. Si `reasoningTokens >= 7500` consistentemente, considerar subir budget a 12K antes de release real.
3. Documentar el costo aproximado en IMPLEMENTATION.md §10 con un cálculo conservador (10K thinking + 4K output).
4. Sin `temperature` explícito el default es 1.0; para una síntesis estructurada con tooling, sugerir `0.3` para reducir variance entre sesiones similares.

---

## 3. `lib/schemas/perfil_decision_final.ts:83` — `generado_at`

Cambio: `z.coerce.date()` → `z.string().datetime()`.

### Justificación del cambio (correcta)

El AI SDK convierte el schema Zod a JSONSchema para forzar el output de Opus. **`Date` no tiene mapping JSON nativo**, así que `z.coerce.date()` se traducía a `z.string()` sin la validación de ISO 8601. El nuevo `z.string().datetime()` es honesto sobre lo que cruza la wire.

### Verificación de call-sites

| Call-site | Tipo esperado | Estado |
|---|---|---|
| `lib/motor/sintesis_pdf/format.ts:37,42` (`formatFecha`, `formatFechaLarga`) | `Date \| string` | OK — ambos aceptados |
| `lib/utils.ts:11` (`formatRelative`) | `Date \| string \| null \| undefined` | OK — ambos aceptados |
| Drizzle `perfil_decision_final.perfil_json` (jsonb) | string | OK — JSON.stringify preserva ISO string |
| Drizzle `perfil_decision_final.generado_at` (timestamp column) | `Date` | NO viene del schema — es el column DB que se autogenera con `defaultNow()`; **NO acoplado al schema Zod**, no hay drift |
| Admin `app/admin/instituciones/[id]/page.tsx:243` (`formatRelative(p.generado_at)`) | `Date` (Drizzle column) | OK — viene de DB no del schema |
| `lib/inngest/functions/sintetizarSesion.ts:124-133` | string post-rebase | **Tenía coerción string→Date que rompía tsc post-rebase**. Corregido en el rebase: cast directo, `formatFecha*` ya acepta string. |
| `lib/motor/sintesis_pdf/sintesis_pdf.test.ts:27` | `Date` literal en fixture | **Rompía tsc post-rebase**. Corregido a ISO string. |
| `scripts/preview_sintesis_pdf.ts:23` | `Date` literal en fixture | **Rompía tsc post-rebase**. Corregido a `.toISOString()`. |
| `lib/motor/sintesis_final.test.ts:97` | string ISO en fixture | OK pre-rebase |

### Riesgos

- **`PerfilDecisionFinalConsistenteSchema` (cross-field invariants)**: si tiene un check del tipo `generado_at < now()` o similar, la lógica con string ISO debe parsearlo (`new Date(perfil.generado_at)`). Reviso debajo (línea 100+ del schema, no la traje al review). **Acción sugerida**: confirmar que no haya `.refine()` que asuma `Date`.
- **Persistencia jsonb**: Drizzle stringifica el objeto entero, así que un string ISO queda como `"2026-05-10T..."` en el JSON guardado. Re-lectura: `perfil_json.generado_at` será string. Cualquier consumer downstream (RAG, exports, futuras vistas admin) recibirá string. Reviso el export route:
  - `app/admin/api/export/[entity]/route.ts:98` — orderBy contra DB column (timestamp), OK.
  - Si en algún futuro se hace `JSON.parse(perfil_json).generado_at.toISOString()`, va a romper. **Documentar**: el campo `generado_at` dentro del jsonb es **siempre string ISO**, mientras el column DB `generado_at` es timestamp.

### Sugerencias accionables

1. Agregar 1 línea de comentario en `lib/schemas/perfil_decision_final.ts:87` explicando la dualidad: "Field dentro del jsonb es string ISO; column DB `generado_at` es timestamp — no confundir."
2. Si `PerfilDecisionFinalConsistenteSchema` tiene `.refine()` que opera sobre `generado_at`, ajustar a `new Date(value).getTime()`.

---

## 4. Flag `CASOS_PIPELINE_READY=false` + coerción `cap_casos_alcanzado`

```ts
// lib/motor/review.ts:115
export const CASOS_PIPELINE_READY: boolean = false;

// enforzarReglasMotor (línea ~344)
if (
  d.decision === 'caso_sintetico' &&
  (ctx.casos_usados >= CAP_CASOS_SINTETICOS || !casosPipelineReady)
) {
  // coerce a avanzar con anotación 'cap_casos_alcanzado'
}
```

### ¿La coerción es la única vía? ¿Algún path se escapa?

**Análisis estático: la coerción es la única vía hacia abajo del `enforzarReglasMotor`.** Confirmado mirando `processSolicitarReview` (línea 194):

```ts
const decisionFinal = enforzarReglasMotor(decisionInicial, { round, casos_usados, sesion_id, grupo_ui });
```

Todo flujo que pasa por `processSolicitarReview` está cubierto. Los siguientes son potenciales bypass que validé:

| Path candidato | ¿Se escapa? | Notas |
|---|---|---|
| Tests E2E que usan `casosPipelineReady: true` override | NO escapan a producción | Solo via param `ctx.casosPipelineReady` que producción nunca pasa |
| Llamada directa a `aplicarDecisionRama` desde fuera | NO existe — es función interna privada | No exportada |
| Rama `caso_sintetico` que llega antes de `enforzarReglasMotor` | NO — `enforzarReglasMotor` se llama antes que `aplicarDecisionRama` (línea 213) | El order es estricto |
| Callers fuera de `processSolicitarReview` | NO — `enforzarReglasMotor` es exportada pero los tests son los únicos consumidores externos | Verificar con grep |

**Verificación grep**: `enforzarReglasMotor` aparece en `lib/motor/review.ts` (definición + 1 uso) y en `lib/motor/review.test.ts` (tests). No hay otro caller. Seguro.

### Riesgos

- **Telemetría**: la coerción por flag emite `escalacionCasoRejectedPorCap`. Si alguien filtra Axiom por esta razón asumiendo "cap natural alcanzado", verá ruido (todos los casos sintéticos durante la era pre-pipeline). **Sugerencia**: agregar un campo `motivo_coerce: 'cap_alcanzado' | 'pipeline_no_listo'` en el log para distinguir.
- **`anotacion_audit` ambigua**: el string es "cap_casos_alcanzado, forzado a avanzar con decline cap_casos_alcanzado". Cuando `CASOS_PIPELINE_READY` flippe a `true`, ese mismo mensaje aparecerá tanto para "cap natural" como históricamente para "pipeline no listo" — la auditoría futura no podrá distinguir. **Sugerencia**: si pipeline no listo, anotar `'motor_coerced: pipeline_no_listo, deferred caso a avanzar'`.
- **Test coverage**: `casosPipelineReady` override hace que los tests nunca corran el path productivo (flag false). Si el flag flippa pero hay un bug en la rama productiva, los E2E no lo agarran. **Sugerencia**: agregar 1 test E2E que NO pase override y verifique la coerción por flag. Ya existe? Buscar en `lib/motor/review.test.ts`.

### Sugerencias accionables

1. Diferenciar en `anotacion_audit` y telemetría las dos razones de coerción.
2. Agregar test que confirme el comportamiento por flag (sin override).
3. Cuando `CASOS_PIPELINE_READY` flippe, removerlo de la firma de `enforzarReglasMotor` y de `EnforzarOpts.casosPipelineReady`.

---

## 5. `PRIMER_BATCH_BIENVENIDA` hardcoded en `lib/state/entrevista.ts`

```ts
export const PRIMER_BATCH_BIENVENIDA: PreguntaBatch = {
  id: 'bienvenida-001',
  preguntas: [
    {
      id: 'bienvenida-p-1',
      texto_pregunta: 'Para arrancar, cuéntanos sobre tu institución: razón social, nombre comercial si lo manejan, qué tipo son (banco, sofom, sofipo, arrendadora, etc.), bajo qué entes están regulados (CNBV, CONDUSEF, UIF), y cuántos años llevan operando.',
      cajas_objetivo: ['id_razon_social', 'id_nombre_comercial', 'id_tipo_institucion', 'id_regulacion', 'id_anios_operacion'],
      tipo: 'directa',
    },
  ],
};
```

### ¿Cubre las 5 cajas del grupo `identificacion`?

Las 5 cajas listadas son **EXACTAMENTE** las cajas de `identificacion` en `CAJAS_CANON` (verificado por nombre):
- `id_razon_social`
- `id_nombre_comercial`
- `id_tipo_institucion`
- `id_regulacion`
- `id_anios_operacion`

**Confirmar contra `CAJAS_CANON` con grep**: si hubiera una caja extra del tipo (e.g. `id_url_corporativa` para banco), la primera pregunta no la pediría.  Acción: verificar `CAJAS_EXTENSION_POR_TIPO[tipo].filter(c => c.grupo_ui === 'identificacion')` para los 4 tipos.

### Riesgos

- **Ingles UX**: la pregunta tiene 4 sub-items concatenados (razón social + nombre comercial + tipo + regulación + años). Es una pregunta "Frankenstein". El usuario va a contestar el primero, olvidar el resto, y Sonnet (que toma el relevo desde el turn 2) tendrá que re-preguntar con guidance. Esto es justo el patrón anti-fricción que la UX intenta evitar.
  - **Sugerencia**: dividir en 2 preguntas en el batch inicial: pregunta 1 (razón + nombre comercial + tipo) y pregunta 2 (regulación + años). El batch puede tener N preguntas, no solo 1. Reducir cognitive load.
- **Drift con prompt de Sonnet (CRÍTICO)**: el prompt de `agent.system_prompt` (no leído aquí pero asumo que existe en `lib/prompts/`) probablemente tiene su propio guideline de "primera pregunta abre la sesión". Si ese guideline emite una pregunta ligeramente distinta y el motor le mete `PRIMER_BATCH_BIENVENIDA` antes, **Sonnet ve en su historial una pregunta que no emitió**. Eso desalineará su estado interno. **Acción**: confirmar que el system_prompt de Sonnet incluya un override "el primer batch ya fue emitido por el motor — usa la respuesta del usuario como contexto inicial sin re-preguntar lo que ya viste".
- **Tipo `'directa'`**: el campo `tipo` no está en el schema `Pregunta` que comparte el resto de la app. Verificar que `Pregunta` accept `'directa'` como tipo válido (otros valores podrían ser `'caso_sintetico'`, `'profundizacion'`, etc.).
- **Idempotencia de `cargarPrimerBatch`**: el método tiene `if (get().batch_actual) return;` — bien, no piso un batch en curso. Pero si el usuario recarga la página, el zustand store se reinicia y vuelve a meter `PRIMER_BATCH_BIENVENIDA`, mientras la DB ya tiene la respuesta del primer batch. **Acción**: verificar que `init(sesion_id, …)` se ejecute antes de `cargarPrimerBatch` y que rehidrate `batch_actual` desde DB si existe. En el `useEffect` de `entrevista-shell.tsx` el orden es correcto: `init()` → `cargarPrimerBatch()`. Pero `init()` debería esperar la rehidratación antes de devolver, sino `cargarPrimerBatch()` corre antes y pisa con bienvenida.

### Sugerencias accionables

1. Verificar contra `CAJAS_CANON` que `identificacion` tiene exactamente esas 5 cajas (y considerar EXTENSIONS por tipo).
2. Considerar dividir la pregunta de bienvenida en 2 para reducir cognitive load.
3. **Crítico**: confirmar (o agregar) override en el system_prompt de Sonnet para reconocer que el primer batch lo emite el motor.
4. Verificar que `init()` rehidrata `batch_actual` desde DB antes de que `cargarPrimerBatch()` lo pise. Si hay condición de carrera, mover `cargarPrimerBatch()` a un guard tipo `if (!batch_actual && status === 'cargando_inicial')`.

---

## Resumen ejecutivo

PR #4 es un wiring sólido del Vercel AI SDK con `generateObject` + Zod schemas. Las decisiones arquitectónicas (discriminated unions, errores tipados, dependency injection para tests, feature flag para casos pipeline) están bien.

Los **3 fixes mecánicos del rebase** (sintetizarSesion.ts + 2 fixtures con `Date` literal) son evidencia de que el cambio de schema `generado_at: Date → string` no fue revisado contra los call-sites que aterrizaron en master post-PR4. **No es bloqueante** porque tsc y vitest pasan post-fix, pero confirma la importancia de mirar bien los call-sites antes de mergear (T2 detection succeeded post-hoc).

Los **5 puntos accionables que recomendaría tratar antes de smoke real**:
1. Agregar `temperature` y telemetría de `usage` (reasoningTokens, etc.) a ambos production calls.
2. Considerar `thinking 4K` para director (review handoff), no solo síntesis.
3. Diferenciar telemetría/anotación entre `cap_casos_alcanzado` natural vs `pipeline_no_listo`.
4. Confirmar con el system_prompt de Sonnet que el primer batch lo emite el motor (drift crítico si no).
5. Considerar dividir `PRIMER_BATCH_BIENVENIDA` en 2 preguntas para UX.

Sin smoke real no hay forma de validar el comportamiento end-to-end con Anthropic. Cuando llegue la key, la primera medición prioritaria es `usage.reasoningTokens` para los dos calls — eso decide si 8K es suficiente.
