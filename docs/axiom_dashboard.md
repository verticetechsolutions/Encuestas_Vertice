# Axiom dashboard — Phase 5 step 5 review handoff

Métricas derivadas del review handoff Sonnet→Opus. Spec v2 §5.2 + gaps D y F.
Las queries usan APL (Axiom Processing Language). Dataset: `vertice-prod` (o
`vertice-dev` para staging — env var `AXIOM_DATASET`).

## Eventos crudos emitidos

| Event name | Nivel | Emisor | Payload |
|---|---|---|---|
| `review.disparado` | info | `processSolicitarReview` | `ReviewDisparadoPayload` |
| `review.opus_decidio` | info | `processSolicitarReview` | `ReviewOpusDecidioPayload` |
| `review.profundizacion_rejected` | warn | `enforzarReglasMotor` | `ReviewRejectionPayload` |
| `review.escalacion_caso_rejected_por_cap` | warn | `enforzarReglasMotor` | `ReviewRejectionPayload` |
| `review.siguiente_grupo_corregido` | warn | `enforzarReglasMotor` | `ReviewSiguienteGrupoCorregidoPayload` |
| `review.opus_call_fallido` | error | `processSolicitarReview` | `ReviewOpusCallFallidoPayload` |
| `review.opus_response_invalida` | error | `processSolicitarReview` | `ReviewOpusCallFallidoPayload` |
| `review.profundizacion.caja_collateral` | info | (TODO step posterior — emite cuando Sonnet re-extrae caja fuera de `cajas_a_reabordar`) | `ReviewProfundizacionCajaCollateralPayload` |
| `extraccion.contradice_sin_previa` | warn | (TODO step posterior — emite cuando flag `contradice_extraccion_previa` no encuentra previa) | `ExtraccionContradiceSinPreviaPayload` |
| `decline_to_answer.registrado` | info | `declinarCaja` | `DeclineRegistradoPayload` |
| `caso.consumido_por_grupo` | info | (TODO step posterior — emite tras consumir caso vía review desde §4.2.3) | `CasoConsumidoPorGrupoPayload` |
| `sesion.lista_para_sintesis` | info | `dispatchSesionListaParaSintesis` | `SesionListaParaSintesisPayload` |
| `sesion.sintesis_failed` | error | (TODO Inngest handler — sintesis_final falla) | `SesionSintesisFailedPayload` |

Tipos en `lib/observability/axiom.ts`. Helpers en `logger.review.*`,
`logger.decline.*`, `logger.caso.*`, `logger.sesion.*`, `logger.extraccion.*`.

## Métricas derivadas (spec v2 §5.2)

Ventana por defecto en todas: 24h móvil. Ajustar según necesidad del panel.

### (a) % review al primer round = avanzar limpio

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| where round == 1
| summarize
    avanzar_round_1 = countif(decision == "avanzar"),
    total_round_1 = count()
| extend pct = round(100.0 * todouble(avanzar_round_1) / todouble(total_round_1), 2)
| project pct
```

Interpretación: cuántas reviews cierran limpio en primer intento. Sano: >50% en
producción.

### (b) % profundización = round 1 con decision='profundizar'

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| where round == 1
| summarize
    profundizo = countif(decision == "profundizar"),
    total_round_1 = count()
| extend pct = round(100.0 * todouble(profundizo) / todouble(total_round_1), 2)
| project pct
```

**Alarma** (spec v2 §5.3): si `pct > 40` sostenido durante 24h con n≥20 sesiones,
el threshold de Sonnet (§1.2) está mal calibrado. Ticket → revisar bucket
"parcial_estable" y considerar subir el cap de turnos antes de disparar review.

### (c) % escalación a caso desde review

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| summarize
    casos = countif(decision == "caso_sintetico"),
    secciones_unicas = dcount(strcat(sesion_id, "|", grupo_ui))
| extend pct = round(100.0 * todouble(casos) / todouble(secciones_unicas), 2)
| project pct
```

Interpretación: del total de secciones que pasaron por review, qué fracción
necesitó caso sintético. Telemetría para calibrar la disponibilidad efectiva del
cap=5.

### (d) latencia Opus review p50

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| summarize p50 = percentile(latencia_ms, 50)
```

### (e) latencia Opus review p95

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| summarize p95 = percentile(latencia_ms, 95)
```

**Alarma** (spec v2 §5.3 + gap D): si `p95 > 12000` ms (12s) sostenido durante 1h,
preparar indicador UI "el director está revisando..." o investigar Opus. UX
percibe >15s como "se colgó".

Bucket sugerido para series temporales:

```apl
['vertice-prod']
| where event == "review.opus_decidio"
| summarize p50 = percentile(latencia_ms, 50), p95 = percentile(latencia_ms, 95)
    by bin(_time, 5m)
| order by _time asc
```

### (f) casos por grupo (defensivo, no bloqueante — gap F)

```apl
['vertice-prod']
| where event == "caso.consumido_por_grupo"
| summarize max_casos_grupo = max(casos_acumulados_grupo)
    by sesion_id, grupo_ui
| order by max_casos_grupo desc
```

Interpretación: si vemos algún `(sesion_id, grupo_ui)` con `max_casos_grupo > 3`
sostenido en producción, señal para considerar quotas por grupo en v2. Cap
global de 5 sigue cementado (memoria `project_cap_casos`).

## Alarmas operacionales (config separada)

Tres alertas a configurar en Axiom (no son código, son config UI):

| Alerta | Trigger | Severidad | Acción |
|---|---|---|---|
| Threshold Sonnet mal calibrado | `(b) > 40%` con n≥20 en 24h | warning | Ticket bucket parcial_estable |
| Latencia Opus degradada | `(e) > 12s` sostenido 1h | warning | Considerar UI "director revisando" o investigar Opus |
| Síntesis Inngest fallando | `count(sesion.sintesis_failed) / count(sesion.lista_para_sintesis) > 5%` en 24h | critical | Investigar Inngest/Opus |

## Eventos pendientes de wiring (TODO posterior)

Tres eventos están definidos en `axiom.ts` pero sus emisión sites no están
implementados todavía. Se completan en steps posteriores:

1. `review.profundizacion.caja_collateral` — emitir desde el handler de
   `registrar_extraccion` (no este step) cuando Sonnet re-extrae una caja fuera
   de `cajas_a_reabordar` durante un round de profundización (necesita conocer
   el round actual y el set de cajas autorizadas).
2. `extraccion.contradice_sin_previa` — emitir desde el handler de
   `registrar_extraccion` cuando `contradice_extraccion_previa=true` pero no
   existe extracción previa para esa caja en la DB.
3. `caso.consumido_por_grupo` — emitir desde el pipeline de caso sintético
   cuando un caso se consume tras una decisión `caso_sintetico` de Opus. El
   payload requiere contar casos acumulados por grupo y por sesión.

Sus typed helpers (`logger.review.profundizacionCajaCollateral`, etc.) ya
existen en `logger`; cuando los sites se implementen, basta llamarlos.
