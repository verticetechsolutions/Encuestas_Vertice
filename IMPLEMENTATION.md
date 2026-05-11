# Vértice · Sistema de entrevista conversacional adaptativa

**Documento de implementación · 30 de abril 2026**

Este documento es el contrato completo del producto que vas a construir. No es una guía abierta a interpretación. Es la fuente de verdad. Si encuentras una contradicción entre algo que digo aquí y algo que el founder te diga después en chat, **pregunta antes de asumir**.

---

## 0 · Cómo trabajar con este documento

1. Lee el documento completo antes de escribir una sola línea de código.
2. No improvises arquitectura ni piezas que no estén descritas. Si crees que falta algo, pregunta.
3. El stack está cementado: no propongas reemplazos (ej. no sugieras Supabase si dice Neon, no sugieras OpenAI si dice Anthropic, no sugieras Whisper si dice Deepgram).
4. Trabaja en orden de fases. No saltes a la fase 4 si la 2 no está lista.
5. Después de cada fase, ejecuta el código y verifica que corre antes de avanzar.
6. Idioma: TODA la UI en español MX. Comentarios de código en inglés. Mensajes de error visibles al usuario en español MX.
7. Sé pragmático. Esto es MVP de 7 días, no producto pulido.

---

## 1 · Qué estás construyendo, en una frase

Una aplicación web donde instituciones financieras mexicanas (bancos, SOFOMs, arrendadoras, factorajes, fintechs IFC) responden una entrevista conversacional híbrida (voz + texto) generada dinámicamente por IA, cuyo output es un perfil estructurado en JSON con el credit box completo de esa institución. Ese JSON alimentará un RAG futuro de matchmaking, pero **el RAG no es parte de este proyecto**.

---

## 2 · Modelo conceptual

El sistema gira alrededor de un concepto: **cajas**.

Una caja es un campo de información que Vértice necesita conocer de cada institución. Hay dos tipos:

- **Núcleo común (44 cajas):** TODAS las instituciones llenan estas, sin importar tipo
- **Extensión por tipo (3 a 6 cajas):** específicas según si es banco, SOFOM, arrendadora, etc.

> Total por institución = 5 identidad + 44 núcleo común + 3 a 6 extensión = **52 a 55 cajas**.

La IA hace una entrevista 100% dinámica para llenar todas las cajas. No hay preguntas pre-escritas. La IA genera cada batch de preguntas en el momento, mirando qué cajas siguen vacías o ambiguas.

La entrevista termina cuando todas las cajas críticas están llenas con confianza alta, o cuando se llega a un cap operativo, o cuando se detecta fatiga del entrevistado.

---

## 3 · División de trabajo Sonnet vs Opus

**Claude Sonnet 4.6 (`claude-sonnet-4-6`)** — el operador
- Genera cada batch de preguntas dinámicamente
- Procesa respuestas y llena cajas con tool use Zod
- Re-formula preguntas cuando hay ambigüedad menor

**Claude Opus 4.7 (`claude-opus-4-7`)** — el supervisor
- Al cierre de cada sección revisa si las cajas están suficientemente cubiertas para avanzar
- Genera casos sintéticos hiper-targeted cuando una caja resiste preguntas directas
- Hace la síntesis final del JSON al cerrar la entrevista

Regla operativa: **Sonnet hace ~95% de las llamadas, Opus las decisiones críticas.** Esto es lo que mantiene el costo en ~$3.45 por entrevista.

---

## 4 · Stack técnico (cementado, no relitigues)

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | Next.js 15 App Router + React 19 | Server components, streaming, server actions |
| Lenguaje | TypeScript estricto | Type safety end-to-end |
| Estilos | Tailwind v4 + shadcn/ui | No reinventes primitivas |
| Streaming UI | Vercel AI SDK | Streaming de tool use de Anthropic |
| Estado cliente | Zustand | Cuando haga falta, no antes |
| Hosting | Vercel Pro | $20/mes |
| Base de datos | Neon Postgres Launch + pgvector | $19/mes, branching, scale-to-zero |
| ORM | Drizzle | Migraciones versionadas |
| Background jobs | Inngest | Free tier, síntesis final asíncrona |
| Auth | Resend magic link | Free tier, simple |
| STT | Deepgram Nova-3 Multilingual `es-419` streaming + diarización | Streaming en vivo |
| LLM operativo | Anthropic Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| LLM supervisor | Anthropic Claude Opus 4.7 | `claude-opus-4-7` |
| SDK Anthropic | `@anthropic-ai/sdk` | Oficial |
| Validación | Zod | Schemas tipados |
| Observabilidad | Sentry + Axiom | Errores + logs estructurados |

**No usar:**
- Web Speech API nativa (calidad inconsistente)
- Whisper como STT principal (queda solo como fallback offline opcional)
- OpenAI, Gemini, ningún otro LLM
- Supabase (decidimos Neon)
- Auth casero (usar Resend magic link)
- localStorage o sessionStorage para datos críticos
- TTS para que la AI hable de vuelta al usuario (la AI escribe, el usuario decide leerla)

---

## 5 · Las cajas del credit box

### 5.1 Identidad institucional (5 cajas)

| Código | Caja | Tipo de dato | Ejemplo |
|---|---|---|---|
| `id_razon_social` | Razón social completa | string | "Banco Multiva, S.A., Institución de Banca Múltiple" |
| `id_nombre_comercial` | Nombre comercial | string | "Multiva" |
| `id_tipo_institucion` | Tipo | enum | banco, sofom_er, sofom_enr, sofipo, socap, arrendadora, factoraje, ifc, otro |
| `id_regulacion` | Regulación vigente | enum multi | cnbv, condusef, shcp, banxico, uif, ninguna |
| `id_anios_operacion` | Años en operación | int | 15 |

**IFPE está intencionalmente excluida** del enum. Una IFPE legalmente no puede dar crédito (Ley Fintech, art. 22). Si alguna se inscribe como aliada, hay que rechazarla en onboarding antes de la entrevista.

### 5.2 Núcleo común — TODAS las instituciones llenan (44 cajas)

#### 5.2.1 Producto y mercado (7 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `nm_productos_ofrecidos` | Productos ofrecidos | enum multi | sí |
| `nm_productos_no_ofrecidos` | Productos NO ofrecidos | enum multi | no |
| `nm_sectores_aceptados` | Sectores que financian activamente | enum multi (14 sectores) | sí |
| `nm_sectores_excluidos` | Sectores rechazo automático | enum multi | sí |
| `nm_sectores_ventaja` | Sectores con ventaja competitiva | text | no |
| `nm_cobertura_geografica` | Cobertura geográfica | enum multi (10 zonas MX) | sí |
| `nm_tipos_cliente` | Tipos de cliente atendidos | enum multi: PF asalariado, PFAE, PM | sí |

**Lista de productos (enum):** crédito_simple, crédito_revolvente, crédito_hipotecario_empresarial, crédito_puente, crédito_construcción, crédito_bimoneda, factoraje_con_recurso, factoraje_sin_recurso, arrendamiento_puro, arrendamiento_financiero, confirming, cobertura_cambiaria, cartas_crédito, avales_fianzas, otro

**Lista de sectores:** construcción_inmobiliario, transporte_logística, manufactura, agroindustria, comercio_mayoreo, comercio_menudeo, servicios_profesionales, salud, tecnología, energía, minería, turismo, educación, gobierno, otro

**Zonas geográficas:** nacional, cdmx_edomex, bajío, occidente, norte, frontera, sureste, centro, sur, pacífico

#### 5.2.2 Rangos y umbrales (8 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `ru_monto_min` | Monto mínimo por operación (MXN) | int | sí |
| `ru_monto_max` | Monto máximo por operación (MXN) | int | sí |
| `ru_ticket_ideal` | Ticket ideal | int o rango | no |
| `ru_moneda` | Moneda | enum: mxn, usd, bimoneda | sí |
| `ru_antiguedad_min` | Antigüedad mínima del cliente (años) | int o "sin requisito" | sí |
| `ru_facturacion_min` | Facturación mínima anual (MXN) | int o "sin requisito" | sí |
| `ru_score_pm_min` | Score Buró PM mínimo | int 300-900 o "no aplica" | sí |
| `ru_score_pf_min` | Score Buró PF mínimo (rep. legal) | int 300-900 | sí |

#### 5.2.3 Garantías y ratios financieros (7 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `gr_tipos_garantia` | Tipos de garantía aceptados | enum multi (8 tipos) | sí |
| `gr_cobertura_min` | Cobertura mínima de garantía | float | sí |
| `gr_dscr_min` | DSCR mínimo | float o "no usa" | sí |
| `gr_deuda_ebitda_max` | Deuda/EBITDA máximo | float o "no usa" | sí |
| `gr_capital_contable_min` | Capital contable mínimo | int o ratio | no |
| `gr_caida_facturacion_max` | Caída facturación YoY máxima tolerada | % | no |
| `gr_ratios_definitorios` | Top 3 ratios definitorios | text | sí |

**Tipos de garantía:** hipotecaria_inmueble, prendaria_maquinaria, prendaria_inventario, cesion_derechos, fideicomiso_garantia, aval_patrimonial, cartas_credito_standby, otro

#### 5.2.4 Operación (6 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `op_tiempo_viabilidad` | Tiempo de respuesta de viabilidad | text | sí |
| `op_tiempo_comite` | Tiempo a comité | text | sí |
| `op_tiempo_fondeo` | Tiempo desde aprobación a fondeo | text | sí |
| `op_frecuencia_comite` | Frecuencia de comité | enum: semanal, quincenal, mensual, por_demanda | sí |
| `op_documentacion_estandar` | Documentación estándar requerida | text | sí |
| `op_eeff_auditados` | EEFF auditados — política | enum: siempre, desde_monto, nunca + monto si aplica | no |

#### 5.2.5 Pricing y conversión (4 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `pc_tasas_por_producto` | Tasa típica por producto | tabla (producto → min/max/CAT) | sí |
| `pc_plazos_por_producto` | Plazos por producto (meses) | tabla (producto → min/max) | sí |
| `pc_reglas_pricing` | Qué mueve la tasa hacia arriba/abajo | text | sí |
| `pc_conversion_producto` | Reglas "si pide X con perfil Y, ofrecemos Z" | text | no |

#### 5.2.6 Tolerancias estructuradas (5 cajas)

Estas 5 cajas reemplazaron a las antiguas Matrices Likert (`mx_12a..e`). El cambio es deliberado: en vez de 54 ítems con score 1-5, cada caja captura **una descripción libre estructurada** de qué tolera la institución, en qué condiciones, y qué es deal-breaker. Sonnet llena estas cajas en Fase 1 escuchando la respuesta libre del entrevistado y mapeando contra las "señales a escuchar" que viven como scaffolding interno en el system prompt (ver §7.1).

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `to_historial_credito` | Tolerancia a manchas/retrasos en buró, restructuras, días de mora aceptables | text | sí |
| `to_situacion_fiscal` | Tolerancia a 32-D negativa, EFOS recientes, RESICO, irregularidades SAT | text | no |
| `to_ratios_financieros` | Umbrales blandos en DSCR, deuda/EBITDA, capital de trabajo, márgenes | text | sí |
| `to_colateral` | Flexibilidad en LTV, tipos de garantía aceptables, prendas, avales solidarios | text | no |
| `to_gobierno_documentacion` | Tolerancia en gobierno corporativo, EEFF sin auditoría, acta sin protocolizar | text | no |

**Cómo se llenan:** preguntas abiertas tipo "¿qué tipo de mancha en buró tolera tu comité y bajo qué condiciones?" Sonnet extrae texto libre estructurado, no scores. El usuario nunca responde una matriz Likert ni ve los ítems del scaffolding.

**Origen del scaffolding:** las "señales a escuchar" que cada caja `to_*` describe internamente provienen del cuestionario completo histórico (54 ítems agrupados en 5 dimensiones). No se codifican como datos del schema; viven sólo dentro del system prompt del agente Sonnet de Fase 1 como referencia descriptiva — ver §7 para el formato.

#### 5.2.7 Situaciones especiales (5 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `se_sin_historial` | ¿Aceptan clientes sin historial crediticio? | enum + condiciones | sí |
| `se_sat_32d_negativa` | ¿Aceptan opinión SAT 32-D negativa? | enum + condiciones | sí |
| `se_concurso_mercantil` | ¿Aceptan empresas con concurso mercantil concluido? | enum + condiciones | no |
| `se_socios_extranjeros` | ¿Aceptan socios extranjeros >49%? | enum + condiciones | no |
| `se_pep_estructura` | ¿Aceptan PEP en estructura accionaria? | enum + condiciones | sí |

#### 5.2.8 Contacto (2 cajas)

| Código | Caja | Tipo | Crítica |
|---|---|---|---|
| `co_punto_contacto` | Punto único de contacto (nombre + puesto) | text | sí |
| `co_email_telefono` | Correo + teléfono directos | objeto `{email, telefono}` | sí |

> `co_email_telefono` se modela como objeto Zod con dos campos validados independientemente: `email: z.string().email()` y `telefono: z.string().regex(/^\+?52?\s?\d{10}$/)`. Sigue siendo una sola caja lógica.

### 5.3 Extensión por tipo (cajas que solo aplican según tipo)

#### Banco / SOFOM ER (5 cajas)

| Código | Caja |
|---|---|
| `cb_exposicion_max_grupo` | Exposición máxima por grupo económico (% capital o monto) |
| `cb_comites_regionales` | ¿Hay comités regionales? Desde qué monto |
| `cb_programas_gobierno` | Programas FIRA/NAFIN/Bancomext que operan |
| `cb_lineas_verdes_esg` | Líneas verdes/ESG dedicadas |
| `cb_project_finance` | Política sobre project finance |

#### SOFOM ENR (5 cajas)

| Código | Caja |
|---|---|
| `cs_scoring_alternativo` | ¿Usan scoring alternativo? Cuál (CFDI, bancarización, etc.) |
| `cs_sla_total` | SLA total desde solicitud a fondeo |
| `cs_integracion_digital` | API/integración digital o solo manual |
| `cs_revolvente_ticket` | Línea revolvente y ticket típico |
| `cs_vinculo_patrimonial` | Vínculo patrimonial con banco (debería ser "ninguno" porque si tiene es ER) |

#### SOFIPO (3 cajas)

| Código | Caja |
|---|---|
| `csp_nivel_operativo` | Nivel operativo SOFIPO (I, II, III, IV) |
| `csp_captacion` | ¿Captan ahorro? Productos de captación |
| `csp_poblacion_objetivo` | Tipo de población objetivo |

#### SOCAP (3 cajas)

| Código | Caja |
|---|---|
| `cc_membresia_requerida` | ¿Solo crédito a socios o también a no-socios? |
| `cc_cuota_minima_socio` | Cuota mínima de socio |
| `cc_sector_cooperativo` | Sector (rural, magisterial, etc.) |

#### Arrendadora (6 cajas)

| Código | Caja |
|---|---|
| `ca_tipos_equipo` | Tipos de equipo aceptados (transporte, maquinaria construcción, médico, TI, etc.) |
| `ca_marcas_preferidas` | Marcas autorizadas o preferidas |
| `ca_valor_residual_min` | Valor residual mínimo aceptable |
| `ca_equipo_importado` | Equipo importado (IMMEX, Pedimento) |
| `ca_equipo_usado` | Equipo usado y antigüedad máxima |
| `ca_modalidades` | Operan arrendamiento puro, financiero o ambos |

#### Factoraje (6 cajas)

| Código | Caja |
|---|---|
| `cf_tipos_factoraje` | Tipos: con recurso, sin recurso, doméstico, internacional, público |
| `cf_porcentaje_adelanto` | % adelanto típico sobre factura |
| `cf_tasa_mensual` | Tasa típica mensual |
| `cf_plazo_max_factura` | Plazo máximo de la factura (días) |
| `cf_sectores_pagadores` | Sectores pagadores aceptados (privado, público, etc.) |
| `cf_concentracion_max_pagador` | Concentración máxima por pagador (%) |

#### IFC (4 cajas)

| Código | Caja |
|---|---|
| `cif_tipo_ifc` | Tipo de IFC (deuda, capital, copropiedad, regalías) |
| `cif_tope_proyecto` | Tope por proyecto |
| `cif_tope_inversionista` | Tope por inversionista |
| `cif_sectores_prohibidos` | Sectores prohibidos por Ley Fintech |

### 5.4 Reglas de "caja llena" globales

| Regla | Aplicación |
|---|---|
| Confianza mínima | 0.80 para críticas, 0.65 para blandas |
| Edición manual del usuario | Marca la caja como llena automáticamente, lock del LLM |
| "No aplica" explícito | Cuenta como llena |
| Caja resiste 3 preguntas directas | Opus genera caso sintético para forzar revelación |
| Cap de casos sintéticos por sesión | **5 casos globales por sesión** (NO por caja). Cuando se alcanza, la sesión cierra y las cajas críticas vacías quedan como `decline_to_answer`. |

---

## 6 · Schema de base de datos

### 6.1 Tablas (Drizzle)

```typescript
// drizzle/schema.ts (esqueleto, no copies literal, complétalo)

export const instituciones = pgTable('instituciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  razon_social: text('razon_social').notNull(),
  nombre_comercial: text('nombre_comercial'),
  tipo: tipoInstitucionEnum('tipo').notNull(),
  email_contacto: text('email_contacto').notNull().unique(),
  magic_link_token: text('magic_link_token').unique(),
  magic_link_expires_at: timestamp('magic_link_expires_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const sesiones = pgTable('sesiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  institucion_id: uuid('institucion_id').references(() => instituciones.id).notNull(),
  status: sesionStatusEnum('status').notNull().default('abierta'),
  // 'abierta', 'pausada', 'sintetizando', 'completa', 'abandonada'
  started_at: timestamp('started_at').defaultNow(),
  closed_at: timestamp('closed_at'),
  ultimo_turno_at: timestamp('ultimo_turno_at').defaultNow(),
  duracion_total_segundos: integer('duracion_total_segundos'),
  cajas_llenas_count: integer('cajas_llenas_count').default(0),
  cajas_total_count: integer('cajas_total_count'),
  fatiga_detectada: boolean('fatiga_detectada').default(false),
  metadata: jsonb('metadata'),
});

export const turnos_conversacion = pgTable('turnos_conversacion', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  numero_turno: integer('numero_turno').notNull(),
  rol: rolTurnoEnum('rol').notNull(), // 'agente', 'usuario'
  contenido_texto: text('contenido_texto').notNull(),
  fuente: fuenteTurnoEnum('fuente').notNull(), // 'sonnet_genera', 'usuario_tipea', 'usuario_voz', 'opus_caso_sintetico'
  modelo_llm: text('modelo_llm'), // 'claude-sonnet-4-6', 'claude-opus-4-7', null si es del usuario
  tokens_input: integer('tokens_input'),
  tokens_output: integer('tokens_output'),
  latencia_ms: integer('latencia_ms'),
  created_at: timestamp('created_at').defaultNow(),
});

export const extracciones = pgTable('extracciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  turno_id: uuid('turno_id').references(() => turnos_conversacion.id).notNull(),
  caja_codigo: text('caja_codigo').notNull(), // ej. 'ru_monto_max'
  valor: jsonb('valor').notNull(),
  confianza: real('confianza').notNull(), // 0.0 a 1.0
  fuente: text('fuente').notNull(), // 'llm', 'manual'
  evidencia_textual: text('evidencia_textual'), // frase exacta del usuario
  superseded_by: uuid('superseded_by'), // FK self-referencial si fue corregida
  created_at: timestamp('created_at').defaultNow(),
});

export const casos_generados = pgTable('casos_generados', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  numero_caso: integer('numero_caso').notNull(), // 1, 2, 3...
  estado: casoEstadoEnum('estado').notNull(), // 'generado', 'validacion_fallida', 'mostrado', 'respondido', 'fallback_usado'
  contenido: jsonb('contenido').notNull(), // estructura A-F del caso
  cajas_objetivo: text('cajas_objetivo').array().notNull(), // qué cajas pretendía cerrar
  validacion_resultado: jsonb('validacion_resultado'), // output del validador Sonnet
  intento_numero: integer('intento_numero').default(1), // 1, 2, 3 (max 2 retries)
  generado_por: text('generado_por'), // 'opus-4-7' o 'fallback'
  fallback_origen: text('fallback_origen'), // si vino de safe rails, cuál
  created_at: timestamp('created_at').defaultNow(),
});

export const eventos_correccion_manual = pgTable('eventos_correccion_manual', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  caja_codigo: text('caja_codigo').notNull(),
  valor_anterior: jsonb('valor_anterior'),
  valor_nuevo: jsonb('valor_nuevo').notNull(),
  motivo: text('motivo'),
  created_at: timestamp('created_at').defaultNow(),
});

export const mapa_incertidumbre_snapshots = pgTable('mapa_incertidumbre_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  numero_turno: integer('numero_turno').notNull(),
  cajas_estado: jsonb('cajas_estado').notNull(), // { "ru_monto_max": { confianza: 0.9, status: "llena" }, ... }
  confianza_global: real('confianza_global'),
  cajas_criticas_pct: real('cajas_criticas_pct'),
  cajas_blandas_pct: real('cajas_blandas_pct'),
  created_at: timestamp('created_at').defaultNow(),
});

export const perfil_decision_final = pgTable('perfil_decision_final', {
  id: uuid('id').primaryKey().defaultRandom(),
  institucion_id: uuid('institucion_id').references(() => instituciones.id).notNull(),
  sesion_id: uuid('sesion_id').references(() => sesiones.id).notNull(),
  version: integer('version').notNull().default(1), // versionado por institución
  perfil_json: jsonb('perfil_json').notNull(), // el JSON estructurado completo
  schema_version: text('schema_version').notNull(), // ej. "1.0"
  completitud: real('completitud').notNull(), // 0.0 a 1.0
  confianza_global: real('confianza_global').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // pgvector, nullable, para RAG futuro
  generado_at: timestamp('generado_at').defaultNow(),
});
```

**Notas:**
- Todos los IDs son UUID v4
- Todas las tablas tienen `created_at`
- Los enums se definen con `pgEnum` de Drizzle
- `embedding` se deja `nullable`. No generes embeddings en MVP, solo prepara la columna
- Los timestamps usan `timestamp` con timezone

### 6.2 Migraciones

Usa Drizzle Kit. Comando para generar la primera migración:

```bash
npx drizzle-kit generate --name initial_schema
npx drizzle-kit push
```

Configura `drizzle.config.ts` apuntando a Neon vía `DATABASE_URL`.

### 6.3 Seeds

Crea estos seeds en `db/seeds/`:

- `enums.ts` — listas cerradas de productos, sectores, zonas, tipos de garantía
- `safe_rails_casos.ts` — librería de 8-10 casos curados del Guión de Casos como fallback (con metadata de qué cajas cubren, incluyendo `to_*` cuando aplique)

---

## 7 · Motor conversacional

### 7.1 Arquitectura general

El motor es un loop server-side que vive en `app/api/turn/route.ts`.

Pseudocódigo:

```
loop {
  estadoCajas = computeMapaIncertidumbre(sesion_id)

  if (todasCriticasLlenas && blandasMinimas) → cerrarSesion(sesion_id)
  if (capCasosAlcanzado || fatigaDetectada) → cerrarSesion(sesion_id)

  // Sonnet decide qué hacer en este batch
  decision = await sonnet.decideSiguienteAccion({
    estadoCajas,
    historial,
    tipoInstitucion,
    informacionPreCargada
  })

  switch (decision.tipo) {
    case 'pregunta_directa':
      batch = await sonnet.generaBatchPreguntas({ ...contexto })
      mostrarBatchAlUsuario(batch)
      respuestas = await esperarRespuestasUsuario()
      extracciones = await sonnet.extraeCajas(respuestas)
      guardarExtracciones(extracciones)

    case 'caso_sintetico':
      caso = await opus.generaCasoTargeted({ cajasObjetivo, ...contexto })
      validacion = await sonnet.validaCaso(caso)
      if (validacion.fallida && intentos < 2) → reintentar
      if (validacion.fallida && intentos >= 2) → fallback
      mostrarCasoAlUsuario(caso)
      respuesta = await esperarRespuestaUsuario()
      extracciones = await sonnet.extraeCajasDeCaso(respuesta, caso)
      guardarExtracciones(extracciones)
  }

  // al final de cada batch o caso, Opus revisa
  decisionAvance = await opus.revisaSeccion({ estadoCajasActualizado })
  if (decisionAvance === 'falta_info') → reformular en siguiente batch
  if (decisionAvance === 'avanza') → continuar loop
}
```

### 7.2 Mapa de incertidumbre

Es una función pura. NO usa LLM. Recibe el estado de las cajas y devuelve scores.

```typescript
function computeMapaIncertidumbre(extracciones: Extraccion[]): MapaIncertidumbre {
  // Para cada caja, calcula:
  // - confianza actual (max de las extracciones no-superseded)
  // - status: 'llena' | 'parcial' | 'vacia' | 'no_aplica' | 'contradictoria'
  // - prioridad: 'critica' | 'blanda'

  // Devuelve scores agregados:
  // - confianza_global (0-1)
  // - cajas_criticas_pct (% llenas)
  // - cajas_blandas_pct
  // - top_3_cajas_a_atacar (priorizadas por crítica + más cerca de threshold)
}
```

Ejecutar tras cada turno. Latencia esperada: <50ms.

### 7.3 Detección de fatiga

Reglas client-side determinísticas:

- Silencio >30s sin respuesta del usuario → marca `fatiga_pausa`
- Respuesta <5 palabras en 3 turnos consecutivos → marca `fatiga_brevedad`
- Keywords disparan: `["ya no sé", "siguiente", "ya", "no sé", "pasa", "siguiente pregunta", "no aplica"]` (con regex tolerante)
- WPM cae >40% respecto al baseline de los primeros 5 turnos → marca `fatiga_velocidad`

Si cualquiera de las 4 dispara, escribir en `sesiones.fatiga_detectada = true` y considerar cerrar.

### 7.4 System prompts

Crea estos archivos en `lib/prompts/`:

#### `agente_conductor.ts` — Sonnet, system prompt principal

Estructura XML al estilo Anthropic:

```xml
<role>
Eres un entrevistador profesional senior trabajando para Vértice, firma de intermediación financiera mexicana. Estás entrevistando a un Subdirector de Crédito de una institución financiera aliada para construir su credit box institucional. Tu meta es llenar las cajas de información que Vértice necesita conocer de esta institución, con la menor fricción posible para el aliado.
</role>

<context>
- Institución: {nombre} · Tipo: {tipo} · Años operación: {años}
- Información pre-cargada: {info_pre_cargada}
- Idioma: español MX, registro profesional pero cercano. Sin jargon corporativo innecesario.
- El aliado es Subdirector de Crédito o Director de Riesgos: criterio formado, tiempo escaso, alergia a formularios.
</context>

<state>
Cajas llenas: {cajas_llenas}
Cajas vacías priorizadas: {top_cajas_vacias}
Historial de turnos: {historial}
Última respuesta del aliado: {ultima_respuesta}
</state>

<instructions>
1. Genera un batch de 2-4 preguntas relacionadas que busquen llenar las cajas vacías priorizadas
2. Las preguntas deben ser abiertas, conversacionales, no robóticas
3. Cada pregunta debe ayudar a llenar 1-3 cajas simultáneamente cuando sea posible
4. Si el aliado ya respondió algo en turnos anteriores, NO repreguntes lo mismo
5. Si detectas contradicción con respuestas anteriores, agrega una pregunta de clarificación
6. Adapta tono y profundidad según tipo de institución (banco grande vs SOFOM ENR chica)
7. NO inventes cajas nuevas. Solo trabaja con las cajas declaradas en el schema
8. Usa la tool `extraer_cajas` para parsear las respuestas del aliado
9. Usa la tool `generar_batch_preguntas` para generar el siguiente batch
</instructions>

<tools>
- extraer_cajas: recibe respuesta del usuario, devuelve lista de extracciones con caja_codigo, valor, confianza, evidencia_textual
- generar_batch_preguntas: tool use estructurado. Output: `Array<{id: string, texto_pregunta: string, cajas_objetivo: string[], tipo: 'directa' | 'caso_sintetico_solicitado'}>`. Permite trackear qué cajas pretendía cada pregunta vs cuáles cerró efectivamente (señal de calidad del prompt).
- solicitar_caso_sintetico: cuando una caja resiste preguntas directas, llama a Opus
</tools>

<guardrails>
- NO menciones jamás que estás siendo evaluado por otro modelo
- NO menciones tokens, costos, latencias
- NO uses emojis a menos que el aliado los use primero
- NO hagas más de 4 preguntas por batch (abruma)
- NO hagas menos de 2 preguntas por batch (se siente robotico)
- Si el aliado dice "no aplica" sobre un producto/sector, marca todas las cajas relacionadas como no_aplica y no insistas
</guardrails>
```

#### `generador_casos.ts` — Opus, generación de casos sintéticos

Few-shots: incluye 3 casos reales del Guión de Casos como anclaje (los CASO-101 abogado asalariado, CASO-001 constructora maquinaria, CASO-008 constructora consolidadora — ya están en project knowledge).

Restricciones explícitas:
- Contexto MX, MXN salvo bimoneda declarada
- Regulación real (CNBV, CONDUSEF, SAT 32-D, RESICO, SCT, IMSS, INFONAVIT)
- Ratios financieros en rangos plausibles del mercado mexicano
- Boundary: el caso debe estar cerca del límite del credit box declarado

Cada caso generado debe declarar `cajas_objetivo` (array de codigos de caja que pretende cerrar) y seguir el schema Zod estricto.

#### `validador_casos.ts` — Sonnet, validación rápida

Recibe un caso generado y verifica:
1. ¿Realista en contexto MX?
2. ¿Ataca las cajas declaradas en `cajas_objetivo`?
3. ¿Está dentro del boundary correcto del credit box parcial?
4. ¿Pasa el schema Zod estructural?

Devuelve `{ pasa: boolean, razones_falla: string[] }`. Latencia objetivo <2s.

#### `sintesis_final.ts` — Opus, consolidación al cierre

Recibe transcripción completa + extracciones + casos aplicados.
Genera el JSON estructurado final del perfil de decisión.
Usa extended thinking con budget 8K tokens.
Output validado contra el Zod schema completo del perfil.
Si falla validación, retry una vez con error context. Si falla otra vez, marca la sesión como `revision_manual_requerida`.

### 7.5 Schemas Zod

Crea `lib/schemas/`:

- `cajas.ts` — un schema Zod por cada una de las 51-57 cajas, derivado del enum del schema de DB
- `caso_sintetico.ts` — schema Zod del caso (estructura A-F + targeting metadata)
- `perfil_decision_final.ts` — schema Zod del JSON output completo

Cada schema debe tener:
- Validación estricta (no `passthrough`)
- Mensajes de error en español MX
- Tipos TypeScript derivados con `z.infer`

---

## 8 · Frontend

### 8.1 Estructura de rutas

```
app/
├── page.tsx                        → landing pública (default si entras a "/" sin link de encuesta)
├── terminos/page.tsx               → Términos · Privacidad · Cookies (linked desde la landing)
├── (auth)/
│   └── magic-link/[token]/page.tsx → validar magic link, crear sesión, redirigir
├── entrevista/
│   ├── [sesion_id]/page.tsx        → la entrevista en sí
│   └── [sesion_id]/cerrada/page.tsx → pantalla de cierre
├── admin/
│   ├── page.tsx                    → lista de instituciones y sesiones
│   ├── instituciones/[id]/page.tsx → ver perfil de una institución
│   └── sesiones/[id]/page.tsx      → ver detalle de una sesión
└── api/
    ├── turn/route.ts               → POST: procesa un batch de respuestas
    ├── deepgram/route.ts           → POST: proxy seguro a Deepgram
    ├── magic-link/route.ts         → POST: genera y envía magic link
    └── inngest/route.ts            → handler de Inngest
```

**Landing (`app/page.tsx`):** entry point público para visitantes sin magic link. Hero editorial con la marca Vértice, manifest de tres datos (formato/duración/entrega), modal de selección que ramifica en dos flujos: "Acceder a mi encuesta" (Google + reenviar magic link por correo) o "Solicitar acceso" (formulario con razón social, tipo de institución, correo). Stack visual: GSAP ScrollTrigger + Lenis smooth scroll, Motion springs en CTAs, Base UI Dialog. Componentes en `components/landing/` (HeaderCTA, HeroLine, VertexMark, CookiesCard, FooterLink, LenisProvider, SectionIndicator, SuccessMark).

### 8.2 UI de la entrevista — patrón "voice-augmented form"

Layout:

```
┌──────────────────────────────────────────────────┐
│ Header: Vértice · {nombre institución} · X de Y │
├──────────────────────────────────────────────────┤
│                                                  │
│  Sección actual: {nombre sección dinámica}      │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Pregunta 1: ¿…?                           │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐ │  │
│  │  │ [textarea editable]                  │ │  │
│  │  └──────────────────────────────────────┘ │  │
│  │                                            │  │
│  │  🎤 [activar micrófono] ━━━━━━━━━━ (live) │  │
│  │                                            │  │
│  │  [✓ Marcar respondida]                    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Pregunta 2: ¿…?                           │  │
│  │ ...                                        │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [Enviar batch →]                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

Componentes (shadcn):
- `<Card>` para cada pregunta
- `<Textarea>` para la respuesta
- `<Button>` para activar mic, marcar respondida, enviar batch
- Indicador visual cuando el mic está grabando (pulse animation)
- Texto de Deepgram aparece en vivo en el textarea mientras se habla
- Después de soltar el mic, el texto queda editable

Lateral derecho (collapsible en móvil): un panel que muestra "Cajas llenas: X de Y" con barras de progreso por sección. **No mostrar las cajas individuales**, solo las 6 secciones agregadas con porcentajes. No queremos que el aliado se sienta vigilado.

**Las 6 secciones oficiales del panel UI (no son las mismas que las 8 subsecciones del schema):**

| Grupo UI | Cajas que agrupa | Total |
|---|---|---|
| Identificación | `id_*` | 5 |
| Productos y mercado | `nm_*` | 7 |
| Números del negocio | `ru_*` + `gr_*` | 15 |
| Operación | `op_*` | 6 |
| Pricing y criterio | `pc_*` + `to_*` + `se_*` | 14 |
| Contacto y específicos | `co_*` + extensión por tipo | variable |

DB y motor trabajan con códigos individuales; solo la capa UI agrega.

### 8.3 Estados de la sesión

Implementar con Zustand:

```typescript
interface EntrevistaState {
  sesion_id: string
  status: 'cargando' | 'esperando_batch' | 'mostrando_batch' | 'enviando' | 'procesando' | 'cerrada'
  batch_actual: PreguntaBatch | null
  respuestas_pendientes: Record<string, string>
  cajas_llenas_pct: number
  // ...
  setRespuesta: (preguntaId: string, texto: string) => void
  marcarRespondida: (preguntaId: string) => void
  enviarBatch: () => Promise<void>
}
```

Persistencia: el texto de cada respuesta hace **autosave a Postgres con debounce de 1.5s** desde el último keystroke (evita pérdida si crashea el browser sin saturar la DB). El batch entero solo se "envía a procesar por LLM" cuando el usuario marca todas las preguntas como respondidas y aprieta enviar. Si crashea el navegador, el usuario abre el magic link y retoma desde el último batch con el texto persistido.

### 8.4 Integración Deepgram

Cliente WebRTC se conecta a `/api/deepgram/route.ts` (proxy server-side para no exponer la API key). El proxy abre WebSocket a Deepgram con:
- `language=es-419`
- `model=nova-3`
- `multilingual=true`
- `diarize=true`
- `punctuate=true`
- `interim_results=true`
- `endpointing=800`
- `keepalive=8s` (para mantener WebSocket vivo durante pausas)

Texto interim aparece gris en el textarea, texto final aparece negro y editable.

### 8.5 Vista admin

MVP minimalista, no necesita ser bonita:

- Lista de instituciones (tabla con: nombre, tipo, status sesión, fecha, completitud, link a detalle)
- Detalle de institución: JSON del perfil + descargar como JSON file + descargar como PDF (vía Inngest)
- Detalle de sesión: transcripción completa + cajas llenas + casos aplicados + telemetría (latencias, tasa de fallback, etc.)
- Botón "exportar todo a CSV" para análisis offline

Auth de admin: lista hardcodeada de emails en `process.env.ADMIN_EMAILS` (separados por coma). Magic link igual que aliados pero ruta `/admin`.

---

## 9 · Auth con magic link

Flujo:

1. Vértice (admin) registra una nueva institución desde `/admin/instituciones/nueva` con: razón social, nombre comercial, tipo, email contacto
2. Sistema genera token único + envía email con magic link `https://vertice.app/magic-link/{token}` vía Resend
3. Aliado hace clic, sistema valida token, expira en 7 días desde generación
4. Si válido: crea sesión en DB y redirige a `/entrevista/[sesion_id]`
5. Si la sesión ya existe (retomar), redirige al último batch sin terminar
6. Cookie de sesión segura, httpOnly, sameSite=lax, expira al cerrar browser

Aviso de privacidad LFPDPPP: pantalla intermedia obligatoria antes de la entrevista la primera vez. Checkbox "He leído y acepto" + timestamp guardado en `sesiones.metadata`.

---

## 10 · Síntesis final con Inngest

Cuando una sesión cierra, se dispara un job Inngest:

```typescript
// inngest/functions/sintetizar_perfil.ts
export const sintetizarPerfil = inngest.createFunction(
  { id: 'sintetizar-perfil' },
  { event: 'sesion/cerrada' },
  async ({ event, step }) => {
    const sesion = await step.run('cargar-sesion', () => cargarSesion(event.data.sesion_id))
    const transcript = await step.run('cargar-transcript', () => cargarTranscript(sesion.id))
    const extracciones = await step.run('cargar-extracciones', () => cargarExtracciones(sesion.id))

    const json = await step.run('llamar-opus-sintesis', async () => {
      return await opus.sintetizarPerfilFinal({ transcript, extracciones, sesion })
    })

    const validacion = await step.run('validar-zod', () => validarPerfilZod(json))
    if (!validacion.success) {
      // retry una vez con error context
      const json2 = await step.run('retry-sintesis', () => opus.sintetizarPerfilFinal({ ...inputs, error_context: validacion.errors }))
      const validacion2 = validarPerfilZod(json2)
      if (!validacion2.success) {
        await step.run('marcar-revision', () => marcarRevisionManual(sesion.id))
        return
      }
    }

    await step.run('guardar-perfil', () => guardarPerfilFinal(sesion.institucion_id, sesion.id, json))
    await step.run('generar-pdf', () => generarPDFResumen(json)) // background, no bloquea
    await step.run('notificar-admin', () => notificarAdmin(sesion))
  }
)
```

Latencia esperada: 15-30s. El usuario no espera, ve pantalla "Procesando, te avisamos por email" y se va.

PDF se genera con Puppeteer en el step `generar-pdf`. Plantilla simple (logo Vértice navy + dorado, secciones del JSON, una página por bloque).

---

## 11 · Telemetría y observabilidad

### 11.1 Sentry

- Cualquier error en server actions o API routes → Sentry
- Errores de Anthropic/Deepgram → Sentry con tag `external_api`
- Frontend errors con Sentry browser SDK

### 11.2 Axiom

Logs estructurados de cada llamada a LLM:

```typescript
logger.info('llm_call', {
  sesion_id,
  modelo: 'claude-sonnet-4-6',
  proposito: 'extraer_cajas', // 'generar_batch', 'validar_caso', 'sintesis_final'
  tokens_input,
  tokens_output,
  latencia_ms,
  cajas_extraidas_count,
  confianza_promedio
})
```

Dashboards mínimos a crear (post-piloto):
- Tasa de validación fallida del generador (target <30%)
- Tasa de uso de fallback (target <20%)
- Latencia p50, p95, p99 por modelo
- Costo acumulado por entrevista
- Completitud al cierre por entrevista

### 11.3 Métricas de extracción

Por cada extracción guardada en DB, log:
- Caja extraída
- Confianza
- Si fue corregida manualmente después (lookup posterior)

Esto permite ver al final del piloto: ¿qué cajas tienen mayor tasa de corrección manual? Esas son las que el extractor falla más y necesitan iteración del prompt.

---

## 12 · Variables de entorno

`.env.example` debe contener:

```
# Anthropic
ANTHROPIC_API_KEY=

# Deepgram
DEEPGRAM_API_KEY=

# Neon
DATABASE_URL=

# Resend
RESEND_API_KEY=
EMAIL_FROM=hola@verticemexico.com

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Axiom
AXIOM_TOKEN=
AXIOM_DATASET=vertice-prod

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=founder@vertice.app,otro@vertice.app
```

---

## 13 · Plan de implementación por fases

**Tu trabajo es ejecutar estas fases en orden. Después de cada fase, corre el código y verifica.**

### Fase 1 · Setup base (4 horas) — ✅ CERRADA (pre-restart)
- [x] Inicializar Next.js 15 + TS estricto + Tailwind v4 + shadcn
- [x] Instalar todas las dependencias (lista al final del documento)
- [x] Crear estructura de carpetas según sección 8.1
- [x] `.env.example` y `README.md` básico
- [x] Configurar Drizzle apuntando a Neon
- [x] Configurar Sentry y Axiom (init mínimo)
- [x] `npm run dev` debe correr sin errores aunque no haga nada útil aún

### Fase 2 · Schema y migraciones (3 horas) — ✅ CERRADA (commits 5c3360c + 7d5f29f)
- [x] Implementar `db/schema.ts` completo con las 8 tablas de sección 6.1
- [x] Implementar enums Drizzle (5 pgEnums: tipo_institucion sin IFPE, sesion_status, rol_turno, fuente_turno, caso_estado)
- [x] Crear seeds (`db/seeds/enums.ts`, `db/seeds/safe_rails_casos.ts` con 10 casos curados del Guión)
- [x] Generar y aplicar migración inicial (vía MCP `run_sql_transaction` — drizzle-kit push requiere TTY no disponible desde CLI)
- [x] Activar pgvector extension en Neon (vector 0.8.0, columna `perfil_decision_final.embedding vector(1536)`)
- [x] Verificar conexión y schema con consultas `information_schema` + insert/select PoC (FK end-to-end OK)

### Fase 3 · Schemas Zod del credit box (3 horas) — ✅ CERRADA (commit `f448e19`, 2026-05-04)

Approach: **Zod como source of truth, types derivados con `z.infer`** (decisión founder 2026-04-30 — ver memoria `feedback_zod_source_of_truth`). NO escribir types paralelos a los schemas; si conviven, drift garantizado en 2 semanas.

- [x] **#1** `lib/schemas/casos.ts` — `CasoSinteticoSchema` + sub-schemas + `TipoInstitucionSchema` derivado de `tipoInstitucionEnum.enumValues`. `CasoSintetico = z.infer<typeof ...>`.
- [x] **#2** `lib/schemas/cajas.ts` — `CajaCanonSchema` + catálogo `CAJAS_CANON: CajaCanon[]` (49 entradas: 5 identidad + 44 núcleo). Helpers `getCajaCanon`, `isCajaCriticaCanon`, `getCajasByGrupoUI`. Sanity-check al cargar (throw si len ≠ 49).
- [x] **D1-D4 founder signoff (2026-04-30)** sobre catálogo. Criticidad de los 5 id_* aprobada (id_* se autollenan en onboarding salvo `id_anios_operacion` — el LLM las trata como confirmación, no extracción; la criticidad sigue para completitud). Híbridos `int o rango/ratio` colapsan a `int` con `null` como sentinel "no aplica/sin requisito". Las 5 `se_*` quedan como `objeto` con shape `{respuesta, condiciones?}` validado por `.refine()`. Extensión por tipo se ejecuta DESPUÉS de #3+#4 — los contratos de salida primero.
- [x] **#3** `lib/schemas/extracciones.ts` — `ExtraccionSchema` (envelope con `id`, `sesion_id`, `turno_id`, `caja_codigo`, `valor: z.unknown()`, `confianza 0-1`, `fuente: 'llm' | 'manual'`, `evidencia_textual`, `version` explícito (founder D-extra), `superseded_by` self-FK). Sub-schemas: `ToleranciaSchema` (to_* × 5), `SituacionEspecialSchema` con refine (se_* × 5), `EmailTelefonoSchema` (co_email_telefono), `EeffAuditadosSchema` con refine (op_eeff_auditados), `TasasPorProductoSchema` + `PlazosPorProductoSchema` (pc_* × 2). Resolver `valorSchemaFor(caja_codigo)` consulta CANON+EXTENSION vía `getCajaAny`; despacha por `tipo_dato` cuando no hay caso especial. `parseExtraccion(raw)` valida envelope + valor en un paso.
- [x] **#4** `lib/schemas/perfil_decision_final.ts` — `PerfilDecisionFinalSchema` keyed por `caja_codigo` (cada entry: `valor, confianza, fuente, evidencia_textual, intentos`). `FuenteCajaFinalSchema` extiende a `'decline_to_answer' | 'no_aplica'` para cajas que cerraron por cap o por respuesta explícita. Métricas usan denominador pinned (`sesiones.cajas_aplicables`). `PerfilDecisionFinalConsistenteSchema` agrega refines cross-field (`completitud === cajas_llenas / cajas_aplicables`, `cajas_llenas ≤ cajas_aplicables`).
- [x] **Catálogo extensión por tipo** — `CAJAS_EXTENSION_POR_TIPO: Record<TipoInstitucion, CajaCanon[]>` con 32 cajas distintas (cb_×5 compartido banco/sofom_er, cs_×5, csp_×3, cc_×3, ca_×6, cf_×6, cif_×4; `otro` = []). Todas marcadas `// !inferida` (criticidad y tipo_dato no especificados en §5.3 — pendientes de un sweep founder al cerrar Fase 3). Helpers nuevos: `getCajaExtension`, `getCajaAny`, `getCajasAplicables(tipo)`. Sanity-check al cargar (throw si distintas ≠ 32).
- [x] **TODO cierre Fase 3 (D2 follow-up):** `permite_no_aplica: boolean` agregado a `CajaCanonSchema` (`lib/schemas/cajas.ts:56`, optional). Las 6 cajas afectadas (`ru_score_pm_min`, `ru_score_pf_min`, `ru_antiguedad_min`, `ru_facturacion_min`, `gr_dscr_min`, `gr_deuda_ebitda_max`) declaran `permite_no_aplica: true` en `CAJAS_CANON`. Lógica de completitud en `lib/motor/mapa.ts:226` (`aceptaNull = canon.permite_no_aplica === true`); `null` solo terminal con manual+null+threshold sobre cajas con la bandera. 4 tests en `mapa.test.ts:175-230` cubren los paths (manual+null+flag=true→no_aplica, flag omitido→parcial, llm+null sigue parcial, cajas con flag cuentan en críticas_pct).
- [ ] **TODO cierre Fase 3:** founder sweep sobre criticidad/tipo de las 32 extension cajas (todas `// !inferida` actualmente).
- [ ] Tests básicos de los schemas con datos válidos e inválidos (smoke runtime ya pasa: 18/18; falta wiring a vitest/jest).

### Fase 4 · Auth y onboarding (4 horas) — ✅ CERRADA (E2E HTTP 6/6 verde; Resend API key pendiente para envío real)

Approach: magic link de un solo uso (token plain en URL del email, hash SHA-256 en DB). Cookie opaca `vertice_session = sesion_id` (httpOnly, secure en prod, sameSite=lax, 30d). Verificación en dos capas: middleware Next 15 hace gate por presencia de cookie sobre `/entrevista/*`; las páginas confirman cookie ↔ sesion_id ↔ consentimiento_at antes de renderizar. Onboarding admin = CLI `scripts/invitar.ts` (UI admin entra en Fase 9).

- [x] Migración `0001_fase4_magic_tokens.sql` aplicada en Neon: tabla `magic_tokens` (id, token_hash unique, institucion_id FK, expires_at, consumed_at, created_at) + columna `sesiones.consentimiento_at timestamptz` para LFPDPPP.
- [x] `lib/auth/tokens.ts` — `generateMagicToken()` via `crypto.randomBytes(24).toString('base64url')` (sin dep extra), `hashToken()` SHA-256 hex, `magicTokenExpiry()` = +7 días, `MAGIC_TOKEN_TTL_DAYS = 7`.
- [x] `lib/auth/cookie.ts` — `setSessionCookie(sesionId)`, `readSessionCookie()`, `clearSessionCookie()`. Cookie name `vertice_session`. httpOnly, secure si NODE_ENV=production, sameSite=lax, maxAge 30d.
- [x] `lib/auth/contracts.ts` — types/Zod schemas usados por las actions (Next 15 prohíbe non-async exports en `'use server'` files; ver memoria `feedback_use_server_only_async`).
- [x] `lib/email/resend.ts` — cliente Resend lazy + `sendMagicLink({ to, url, razon_social, expiresAt })` con HTML+text en es-MX. Throws si `RESEND_API_KEY` no está configurada.
- [x] `lib/db.ts` — Drizzle client singleton sobre `postgres-js` (Neon-friendly).
- [x] **Server actions** en `app/actions/`:
  - `instituciones.ts → crearInstitucion(input)` — valida con Zod, computa `cajas_aplicables` vía `countCajasAplicables(tipo)` (CANON 49 + EXTENSION[tipo].length).
  - `sesiones.ts → crearOReanudarSesion(institucion_id)` — reanuda sesión `abierta` o crea nueva con denominador pinned. `registrarConsentimiento(sesion_id)` setea `consentimiento_at`.
  - `auth.ts → emitirMagicLink(institucion_id, { dryRun? })` (token plain en URL, hash en DB; modo dry-run para test sin Resend) y `verificarMagicLink(plain)` puro DB-only que devuelve outcome discriminado (`ok` | `token_invalido` | `expirado` | `consumido` | `institucion_no_encontrada`). Wrapper `verificarMagicLinkYSetearCookie()` que añade el cookie set para uso desde la página.
- [x] **Rutas:**
  - `app/(auth)/acceso/[token]/route.ts` — **Route Handler** (no Server Component). Next 15 prohíbe escribir cookies durante render de SC; el handler hace verify + `NextResponse.redirect()` con `res.cookies.set()`, que sí está permitido. El redirect lleva el Set-Cookie correctamente porque ambos viven en la misma respuesta.
  - `app/(auth)/acceso/expirado/page.tsx` — 5 mensajes en es-MX por razón (`token_invalido`, `expirado`, `consumido`, `institucion_no_encontrada`, `sin_sesion`).
  - `app/entrevista/[sesion_id]/bienvenida/page.tsx` — aviso LFPDPPP + checkbox de consentimiento (client component `consentimiento-form.tsx` que llama `registrarConsentimiento`). Si la sesión ya tiene `consentimiento_at`, salta directo al placeholder.
  - `app/entrevista/[sesion_id]/page.tsx` — placeholder de Fase 5 que valida cookie ↔ sesion_id ↔ consentimiento_at antes de renderizar.
- [x] **Middleware** `middleware.ts` — gate sobre `/entrevista/:path*` por presencia del cookie `vertice_session`; sin cookie → 307 a `/acceso/expirado?razon=sin_sesion`.
- [x] **CLI** `scripts/invitar.ts` — `--razon-social --tipo --email [--nombre-comercial] [--dry-run]`. Crea institución + emite primer link. Flag `--dry-run` imprime URL sin Resend (útil hasta que `RESEND_API_KEY` esté configurada).
- [x] **Smoke E2E DB-only** `scripts/smoke_auth.ts` — valida los 4 outcomes de `verificarMagicLink`: token_invalido, ok, consumido, expirado (este último vía manipulación directa de `expires_at` en DB). Resultado: 4/4 ✓.
- [x] **Build de prod** `next build` compila clean (45s). Pre-existing typecheck error en `lib/observability/axiom.ts:57` arreglado de paso (1 línea: spread del payload para satisfacer `Record<string, unknown>`).
- [x] **Smoke E2E HTTP** (curl + dev server reiniciado): 6/6 verde.
  - T1 happy path: GET `/acceso/{token}` → HTTP 307 a `/entrevista/{sesion_id}/bienvenida` + `Set-Cookie: vertice_session={sesion_id}; HttpOnly; SameSite=Lax; Path=/`
  - T1.5 GET `/entrevista/{sesion_id}/bienvenida` con cookie → HTTP 200 + render con "Aviso de privacidad" + checkbox de consentimiento
  - T2 re-GET mismo `/acceso/{token}` → HTTP 307 a `/acceso/expirado?razon=consumido`
  - T3 GET `/acceso/garbage` → HTTP 307 a `/acceso/expirado?razon=token_invalido`
  - T4 GET `/entrevista/{uuid}` SIN cookie → HTTP 307 (middleware) a `/acceso/expirado?razon=sin_sesion`
  - T5 GET `/acceso/{token}` con `expires_at` en el pasado → HTTP 307 a `/acceso/expirado?razon=expirado`

**Pendientes (no bloqueantes para Fase 5):**
- [ ] `RESEND_API_KEY` en `.env.local` — vacía actualmente. Hasta que la pongas, `--dry-run` imprime el link a consola; abre el link a mano en navegador para validar el flujo HTML.
- [ ] Dominio verificado en Resend para `EMAIL_FROM=hola@verticemexico.com`.
- [x] Cleanup post-Fase 4: columnas `instituciones.magic_link_token` y `magic_link_expires_at` removidas en migración `0004_drop_dead_magic_link_cols.sql` (2026-05-10). El flujo magic-link real vive en `magic_tokens` (Fase 4, migración 0001).

### Fase 5 · Motor conversacional core (8 horas) — 🟡 EN PROGRESO (todo cerrado salvo sub-paso 5.iv 🔒 prompts Opus + ANTHROPIC_API_KEY)

Estructura de la Fase 5 en pasos discretos para auditabilidad:

- [x] **Paso 1 (commit `5088da2`):** `lib/prompts/sonnet_fase1.ts` con `SENALES_A_ESCUCHAR_XML` (54 ítems × 5 cajas to_*, verbatim del cuestionario legado 12.A–12.E). Wired en `<context>`. `SONNET_FASE1_PROMPT_READY=false`.
- [x] **Paso 2 (commit `5c0424a`):** funciones puras del motor.
  - `lib/motor/mapa.ts` → `computeMapaIncertidumbre(extracciones, cajasAplicables, topN)`. Status por caja (llena, parcial, vacia, no_aplica, contradictoria), agregados ponderados (críticas peso 2, blandas peso 1), top N a atacar. Constantes `CONFIANZA_MIN_CRITICA=0.80`, `CONFIANZA_MIN_BLANDA=0.65`. `no_aplica` solo con manual+null+threshold (founder D2). Smoke 20/20.
  - `lib/motor/fatiga.ts` → `detectarFatiga(turnos)` con 4 reglas (silencio_pausa, keyword, brevedad, velocidad WPM). Lookahead `(?=\s|[.,!?]|$)` en regex con acento porque `\b` JS es ASCII-only. Smoke 8/8.
- [x] **Paso 3 (commit `16d8d18`):** Tools de Sonnet con Zod en `lib/motor/tools.ts`. 3 tools:
  - `registrar_extraccion` (array de extracciones, `valor: z.unknown()` resuelto en runtime).
  - `generar_batch_preguntas` (longitud 2|3|4 con refine que iguala a `preguntas.length`).
  - `solicitar_caso_sintetico` (urgencia alta|media, gateado por cap 5/sesión).
  - `marcar_caja_llena` excluida deliberadamente (mal incentivo: dejaría a Sonnet sub-llenar sin extraer). Cada tool exporta `<NAME>InputSchema`, `<NAME>Input`, `<NAME>_TOOL` (definición Anthropic con `input_schema` vía `z.toJSONSchema()`). Smoke 31/31.
- [x] **Paso 4 (commit `425ad03`):** body del system prompt de Sonnet Fase 1. 26.5K chars / ~6.6K tokens, typecheck limpio.
  - Persona formal-cálida peer-to-peer (entrevistado experto 15-25 años en crédito).
  - `<tools_disponibles>` con cuándo llamar cada tool (registrar PRIMERO, después generar_batch o solicitar_caso, nunca al revés).
  - 11 instructions cubriendo: orden tool calls, calibración de confianza con anchors (0.90+ literal / 0.75-0.85 contexto fuerte / 0.60-0.75 inferencia / <0.60 no extraer), manejo de "no aplica" (null + ≥0.85), no inventar, no repetir fraseología, no anunciar transiciones, multi-extracción `se_*`+`to_*`, solo cajas en lista aplicable, pausa/meta-pregunta sin tools, evidencia_textual literal con "..." para fragments discontinuos.
  - 3 few-shots curados con founder (2026-05-01):
    - Ej1: pregunta abierta cosechando 5 cajas (códigos canonicalizados a `nm_sectores_aceptados`/`nm_sectores_excluidos`); siguiente_batch_esperado con 2 preguntas + cajas_objetivo declaradas.
    - Ej2: reformulación tras evasión, escalando a `solicitar_caso_sintetico` cuando suma 2 turnos sin clausurar (canónico de regla 6: max 2 intentos directos antes de caso sintético).
    - Ej3: tema sensible (SAT 32-D negativa) con multi-extracción dual: `se_sat_32d_negativa` (objeto estructurado, crítica, 0.92) + `to_situacion_fiscal` (texto narrativo, blanda, 0.88). Nota lateral explicando por qué EFOS y rechazos por compliance fiscal viven en `to_situacion_fiscal` (canon no tiene caja `*_rechazos_automaticos`).

- [x] **Paso 5 — Sonnet→Opus review handoff** (cierre por `grupo_ui` discreto, opción (a) cementada). Spec v2 firmada por founder con 6 puntos abiertos resueltos + 6 huecos cerrados (re-extracción/version, side-effect motor en round 2, cierre último grupo, p50/p95 latencia Opus, atomic merge SQL, evento `caso.consumido_por_grupo`). Sub-pasos:
  - [x] **Sub-paso i (commit `8ffba22`):** Schemas Zod + tool. `lib/schemas/review_seccion.ts` con `SolicitarReviewSeccionInputSchema` (tool input), `RespuestaOpusSchema` discriminated union (avanzar | profundizar | caso_sintetico), razones canónicas (`RazonNoClausuraSchema` Sonnet→motor, `RazonDeclineSchema` motor→DB, `RazonEscalacionCasoSchema`), `CajaStatusSchema` mirror del type en mapa.ts. `lib/motor/tools.ts` ampliado a 4 tools con `SOLICITAR_REVIEW_SECCION_TOOL`. 44 tests verdes.
  - [x] **Sub-paso ii (commit `7fd19ad`):** Migración Drizzle. Tablas nuevas `reviews_seccion` (15 cols, FKs a sesiones + casos_generados, unique index `(sesion_id, grupo_ui_codigo, round)`) y `cajas_declinadas` (FK a reviews_seccion, unique index `(sesion_id, caja_codigo)`). Columna `secciones_cerradas` jsonb default `'{}'::jsonb` en `sesiones`. SQL en `db/migrations/0002_phase5_step5_review_handoff.sql`. **NO aplicada** — founder aplica manualmente a Neon vertice-mvp/main (project_id `young-scene-62665535`) cuando merge a master.
  - [x] **Sub-paso iii (commit `20b71c1`):** Orquestación. `lib/motor/review.ts` (~480 líneas) con `processSolicitarReview` entry point + helpers (atomic merge SQL `||` para `secciones_cerradas`, `transicionarSesionASintetizando` con guard race-safe, `declinarCaja` con `ON CONFLICT DO NOTHING`, `dispatchSesionListaParaSintesis` placeholder Inngest). Reglas del motor exportadas (`enforzarReglasMotor`, `siguienteGrupoCanonico`, `razonDeclineParaAvanzar`). `app/api/turn/route.ts` (POST) con stream Sonnet via Vercel AI SDK v6 — solicitar_review_seccion completamente wirada; otros 3 tools con execute stubs + TODO posterior. `lib/prompts/opus_director.ts` placeholder 🔒 con `OPUS_DIRECTOR_PROMPT_READY=false`. 64 tests verdes.
  - [ ] **Sub-paso iv 🔒 PLACEHOLDER — system prompt de Opus director.** NO se redacta autónomamente. Founder dirige sesión conjunta tras cierre de sub-paso vi. Mientras: `productionOpusCall` arroja `OpusReviewPromptNotReady`; `app/api/turn` lo captura y devuelve mensaje al modelo. TODO comentado en `lib/prompts/opus_director.ts` lista los 4 ítems que el prompt real debe cubrir (persona, contrato I/O, calibración del threshold, few-shots curados).
  - [x] **Sub-paso v (commit `38180f0`):** Axiom typed emitters + dashboard. `lib/observability/axiom.ts` extendido con 11 typed payload interfaces y namespaces `logger.review.*`, `logger.decline.*`, `logger.caso.*`, `logger.sesion.*`, `logger.extraccion.*`. `review.ts` refactorizado para usar typed emitters consistentemente (cero `logger.info/warn/error` ad-hoc). `docs/axiom_dashboard.md` con 13 eventos crudos + 6 métricas derivadas en APL (alarma >40% profundización, alarma >12s latencia p95) + 3 alertas operacionales documentadas + 3 eventos pendientes de wiring posterior.
  - [x] **Sub-paso vi (commit `49a575e`):** E2E mock suite. `lib/motor/review.e2e.test.ts` con 16 tests cubriendo los 7 escenarios spec (round 1 avanzar limpio, profundizar→avanzar, profundizar→caso_sintetico, cap-casos forzando decline, cap-turnos override, cierre sesión + Inngest fan-out, race condition sobre secciones_cerradas) + helpers de side-effect. Estrategia: `vi.hoisted` + `chainableResolves` mock helper para Drizzle. **80/80 tests verdes** (64 previos + 16 nuevos). Ningún escenario reveló bug en (i)-(v).
  - [x] **Sub-paso vii — Conversation E2E happy path multi-grupo** (2026-05-07, satisface parcial la memoria `feedback_phase5_e2e_tests`). `lib/motor/__test_helpers__/mock-sonnet.ts` (171 LOC) wrapper sobre `MockLanguageModelV3` del AI SDK + `simulateReadableStream` con script tool-call por turno (V3 `finishReason`/`usage` shape correcto). `lib/motor/__test_helpers__/mock-sonnet.test.ts` (5 smoke tests del helper). `lib/motor/conversation.e2e.test.ts` (2 tests, 794 LOC) drive 6 user turnos consecutivos × 2 model steps cada uno = 12 model steps via `streamText` real, mockeando solo persistencia (in-memory stateful con supersede chain) + `processSolicitarReview` (canned avanzar→último grupo→`sesion_lista_para_sintesis`) + Axiom logger. `computeMapaIncertidumbre` y `valorSchemaFor` se usan REALES. Asserts: 12 turnos persistidos con `numero_turno` monótono, 35 extracciones distribuidas en los 6 grupos, mapa final con cajas llenas en cada grupo, supersede chain invalida la previa al re-extraer. **125/125 tests verdes** (118 previos + 7 nuevos). Pending para sesión futura (founder eligió scope reducido en esta sesión): cap-casos sintéticos (5/sesión global), fatiga + extension por tipo, profundizar→avanzar round 2, route-handler HTTP-level (gates + sesión validation).

**Bloqueos remanentes Fase 5:**

- [x] **`<formato_valores_por_caja>`** — bloque XML con las 49 entradas de `CAJAS_CANON`. Aterrizado el 2026-05-02 en `lib/prompts/sonnet_fase1.ts:131-530` (`FORMATO_VALORES_POR_CAJA_XML`, ~400 LoC) con descripción + criticidad + tipo_dato + formato_esperado + ejemplo_valido por entrada, resueltas vía `valorSchemaFor()`. `SONNET_FASE1_PROMPT_READY=true` desde ese commit. Contrato validado por `lib/prompts/sonnet_fase1.test.ts` (7 tests: cardinalidad 49, embebido en system prompt, codes match CAJAS_CANON sin huérfanos ni faltantes, 5 sub-tags por caja, criticidad XML ↔ CANON). Wiring del gate verificado por `app/api/turn/route.e2e.test.ts` test #7 (happy path → 200 stream) + test #1 (PROMPT_READY=false → 503).
- [ ] **System prompt de Opus director (sub-paso iv 🔒).** Co-escritura founder + CC tras cierre de sub-paso vi.
- [ ] **System prompts de Opus restantes:** `opus_generador_casos.ts`, `opus_validador_casos.ts`, `opus_sintesis_final.ts` (ya hay placeholder de `opus_director.ts` para review).
- [x] **Persistencia de extracciones con supersede chain** y persistencia de turnos en DB. Cerrada: `app/api/turn/route.ts` invoca `persistirExtraccionesBatch` (con prefiltro `valorSchemaFor` partial-on-failure) + `listarExtraccionesActivas` (snapshot mapa al cliente) + `persistirTurnoUsuario`/`persistirTurnoAgente` placeholder + `actualizarContenidoTurnoAgente` en `onFinish`. Cubierto por `lib/motor/persistence.test.ts` (unit), `lib/motor/conversation.e2e.test.ts` (motor-level con stateful mock) y `lib/motor/review.integration.test.ts` (DB real).
- [x] **Aplicar migración 0002 a Neon `vertice-mvp/main`.** Aplicada (verificada 2026-05-07: 15 cols `reviews_seccion`, 7 cols `cajas_declinadas`, FKs, índices, `sesiones.secciones_cerradas`).
- [x] **Tests integración con DB real** — `lib/motor/review.integration.test.ts` (12 tests) contra branch `test-integration` (`br-noisy-credit-amkaj2or`). Cubre: `mergeSeccionCerrada` race + idempotencia, `transicionarSesionASintetizando` guard atómico + race, `declinarCaja` ON CONFLICT + FK 23503, unique index 23505. Skip-if-missing si `DATABASE_URL_TEST` no está set. Pattern vi.hoisted + vi.mock para redirigir `@/lib/db` al test branch.
- [x] **Inngest wiring real** — resuelto 2026-05-02 (ver §20 §1366). `lib/inngest/client.ts` singleton + `app/api/inngest/route.ts` serve handler + `lib/inngest/functions/sintetizarSesion.ts` createFunction con `triggers: [{ event: 'sesion/lista_para_sintesis' }]` + `retries: 4`. `dispatchSesionListaParaSintesis` en `lib/motor/review.ts:579` hace `await inngest.send()` real con `event_id` correlacionado en payload Axiom. 2 tests en `review.test.ts` verifican shape correcto + no-call cuando `transicionExitosa=false`.

### Fase 6 · Integración Deepgram (4 horas) — ✅ STT base + 🟡 cableado al motor pendiente
- [x] Token efímero server-side (`/api/stt/token`) con cookie auth
- [x] WebRTC client + `useDeepgramStream` hook
- [x] `MicButton` + `TranscriptionPanel` componentes en `/demo/stt`
- [x] Config Nova-3 cementada (`STT_LIVE_CONFIG` en `lib/stt/client.ts`)
- [x] **Cableado al shell de entrevista** — resuelto en PR #11 (refactor visual entrevista). `useDeepgramStream` importado y consumido en `components/entrevista/HeroPregunta.tsx:27,95`; `MicButton` ya no está disabled fuera de preview mode. Append de transcripts al textarea via util pura `lib/stt/append-transcript.ts` extraída en PR #13 con 10 unit tests. Smoke real contra Deepgram queda gated por `DEEPGRAM_API_KEY` (instrucciones en body de PR #13).
- [ ] Test con voz real en español MX (smoke STT validado en `/demo/stt`)

### Fase 7 · UI de la entrevista (8 horas) — 🟡 EN PROGRESO (shell + autosave + /api/turn cableado; rediseño fintech en curso)
- [x] **Shell split-screen** (commit `0fcff48`) — `app/entrevista/[sesion_id]/entrevista-shell.tsx` con grid `[minmax(0,1fr)_320px]`, móvil panel arriba colapsable.
- [x] **`<PreguntaCard>`** — textarea + slot mic disabled (placeholder hasta wiring Fase 6) + botón "Marcar respondida" + autosave indicator (idle/pending/saving/saved/error).
- [x] **Panel lateral** — `<PanelProgreso>` con 6 grupos UI agregados (sin exponer cajas individuales por privacidad).
- [x] **Estado Zustand** — `lib/state/entrevista.ts` con autosave debounce 1.5s per-pregunta + persistencia a `sesiones.metadata.borrador_respuestas` jsonb (atomic merge `||`).
- [x] **Manejo "guardar y retomar"** — autosave en cada cambio de textarea; al recargar la página el server component verifica cookie + consentimiento y rehidrata.
- [x] **`/api/turn` cableado al shell (2026-05-05)** — POST con `{ sesion_id, mensaje_usuario }`, consume stream con `readUIMessageStream`, extrae tool-output de `generar_batch_preguntas` → batch nuevo, y `registrar_extraccion.mapa_summary.llenas_por_grupo` → panel live. Estados nuevos `procesando` y `error_turn`. Banner amber + botón "Reintentar envío" preservan respuestas si el stream falla.
- [x] **Rediseño fintech minimalista (2026-05-05)** — paleta forest-green + lima + off-white-cream + canvas taupe en `app/globals.css` (oklch tokens). Hero bold para pregunta activa, stepper compacto de 6 grupos en pill (chips compactos en md, labels completos en lg+), CTA pill lime, microanimaciones (`vertice-fade-up`, `vertice-pulse-ring`, `vertice-shimmer` keyframes + utility `.text-display`).
- [x] **Pregunta-as-hero (2026-05-05)** — refactor del shell para que UNA pregunta domine la pantalla. Componentes nuevos: `<HeroPregunta>` (text-display 28-44px + textarea generosa), `<BatchNav>` (dots numerados + arrows prev/next para moverse entre preguntas del batch sin stack visual), `<Stepper>` (top-of-card horizontal). Panel progreso colapsado a `<details>` para no robar foco.
- [x] **Modo preview UI (2026-05-05)** — `app/preview/ui/page.tsx` (fuera de `/entrevista/*` así esquiva middleware). Renderiza `<EntrevistaShell preview>` con sesion_id fake. Flag `preview_mode` en el store apaga autosave + stub-ea `enviarBatch` (simula enviando→procesando→nuevo batch + bumpea panel). Badge lime "Preview UI" en header. 404 en producción. Razón: dev JIT compile lag (~70-90s acumulados primer hit) + token magic link single-use rompía el loop "edita CSS → recarga → ve cambios". Deuda paralela: `app/dev/preview/route.ts` que toma la última sesión real abierta y bypasea solo el token (útil para probar autosave real sin token).
- [ ] **Animación de campos en verde al cerrar caja** — pendiente (necesita extracción real de Sonnet con ANTHROPIC_API_KEY).
- [x] **Indicador adaptativo "Sección X · Pregunta Y"** — `components/entrevista/BatchNav.tsx` cubre Pregunta Y con dot activo + label `P0X`; Sección X viene del `Stepper` (spine vertical con iconos por sección, PR #11) + eyebrow del hero.

### Fase 8 · Síntesis final con Inngest (4 horas) — 🟡 EN PROGRESO (PDF generator cerrado en PR #5; storage + notif pendientes de keys/diseño)
- [x] **Inngest function `sintetizarSesion`** — `lib/inngest/functions/sintetizarSesion.ts` con `triggers: [{ event: 'sesion/lista_para_sintesis' }]`, `retries: 4`, 2 step.run aislados (`procesar-sintesis-final` + `generar-pdf`). Wirado vía `dispatchSesionListaParaSintesis` (lib/motor/review.ts:579).
- [x] **Validación Zod con retry** — `procesarSintesisFinal` (lib/motor/sintesis_final.ts:389) hace validación Zod del `PerfilDecisionFinal`; errores transitorios propagan para que Inngest retry con backoff exponencial (4 intentos). Errores tipados `OpusSintesisPromptNotReady` + `SesionNoEncontradaError` envueltos en `NonRetriableError` para abortar sin retry inútil.
- [x] **Generación de PDF con Puppeteer** — PR #5 (commit `220c7a4`). Stack: `puppeteer-core@23` + `@sparticuz/chromium@131` + `geist@1`. Módulo en `lib/motor/sintesis_pdf/` (6 archivos: index.tsx, template.tsx, styles.ts, chromium.ts, fonts.ts, sintesis_pdf.test.ts). `generarPdfSintesis(perfil)` retorna buffer + bytes; step.run aislado del step Opus así un PDF fallido no rehace la síntesis.
- [ ] **Storage del PDF** (Vercel Blob) — pendiente de `BLOB_READ_WRITE_TOKEN`. Hoy step `generar-pdf` mide bytes y loguea; cuando aterrice la key, este step llama `blobStorage.put(buffer)` y persiste `pdf_url` en `perfil_decision_final.pdf_url`. Hook ya marcado con TODO en sintetizarSesion.ts:138-139.
- [ ] **Notificación admin** — pendiente de decisión de diseño (email vs in-app vs ambos). Hoy la admin lista sesiones recientes en `/admin` con `StatusPill` por status; al transicionar a `completa` aparece naturalmente. Sin push notif explícita todavía — depende de elegir entre Resend (necesita key) o toast in-dashboard con polling/SWR.

### Fase 9 · Vista admin (4 horas) — ✅ CERRADA (Track 3 sin keys, 2026-05-07)
- [x] **Auth admin separada** — `lib/auth/admin.ts` con cookie `vertice_admin` + `ADMIN_PANEL_TOKEN` env (constant-time compare). Middleware extendido a `/admin/:path*` con bypass de `/admin/login`. Server Actions `loginAdmin` / `logoutAdmin` (`app/actions/adminAuth.ts`). Form en `/admin/login` con FormData (sin URL param para no leak en logs).
- [x] **Dashboard** (`app/admin/page.tsx`) — StatCards (instituciones, sesiones, perfiles, abiertas) + panel exportar (CSV/JSON × 4 entidades) + tabla de 10 sesiones recientes con StatusPill por status.
- [x] **Lista de instituciones** (`app/admin/instituciones/page.tsx`) — tabla con SQL crudo agregando # sesiones + # perfiles + último_turno por institución.
- [x] **Detalle de institución** (`app/admin/instituciones/[id]/page.tsx`) — header con cajas-pill + sesiones de la institución + perfil_decision_final con métricas (schema, completitud, confianza, versión) + JSON viewer colapsable.
- [x] **Detalle de sesión** (`app/admin/sesiones/[id]/page.tsx`) — 6 secciones colapsables: header (5 stats), turnos cronológicos con rol-badge agente vs usuario + fuente/modelo/tokens/latencia inline, extracciones (activas vs supersedidas con strikethrough), casos sintéticos con detalle expandible, reviews_seccion (decision_opus + siguiente_grupo), cajas_declinadas con razón canónica, metadata bruto (secciones_cerradas + jsonb metadata).
- [x] **Crear institución + magic link copiable** (`app/admin/instituciones/nueva/`) — `useActionState` con Server Action `crearInstitucionConLink` que llama `crearInstitucion` + `emitirMagicLink({ dryRun: true })`. Maneja duplicado 23505 con mensaje accionable. Panel forest con magic_url en textarea readonly + botón copiar al portapapeles. Sin envío de email (espera RESEND_API_KEY).
- [x] **Export CSV/JSON** (`app/admin/api/export/[entity]/route.ts`) — GET handler con isAdminAuthenticated guard. 4 entidades: instituciones, sesiones, extracciones, perfiles. CSV RFC-4180 con escape de quotes/commas/newlines, jsonb objects via JSON.stringify. Content-Disposition attachment.

### Fase 10 · Telemetría y deploy (3 horas) — 🟡 Logs ya wirados; deploy/Sentry/smoke/pilotos esperan keys + decisiones humanas
- [x] **Logs estructurados a Axiom en cada llamada LLM** — `lib/observability/axiom.ts` con typed payload interfaces + namespaces `logger.review.*`, `logger.decline.*`, `logger.caso.*`, `logger.sesion.*`, `logger.extraccion.*`, `logger.info`, `logger.warn`, `logger.error`. Cada llamada LLM (Sonnet en `app/api/turn`, Opus director en `lib/motor/review.ts`, Opus síntesis en `lib/motor/sintesis_final.ts`) emite events tipados con `model`, `usage.tokens`, `latencia_ms`, `event_id`. Dashboard documentado en `docs/axiom_dashboard.md` (13 eventos crudos + 6 métricas derivadas APL + 3 alertas operacionales).
- [ ] Sentry capturando errores (necesita `SENTRY_DSN`).
- [ ] Deploy a Vercel (depende de keys: ANTHROPIC, RESEND, DEEPGRAM, BLOB, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, AXIOM_TOKEN).
- [ ] Smoke test en producción (post-deploy).
- [ ] 2-3 entrevistas piloto (post-smoke).

---

## 14 · Dependencias

Instalar:

```bash
# Framework
npm install next@latest react@latest react-dom@latest

# TS y types
npm install -D typescript @types/react @types/node

# Tailwind v4
npm install -D tailwindcss@next @tailwindcss/postcss

# shadcn
npx shadcn@latest init
# luego agregar componentes según se necesiten: button, card, textarea, etc.

# Vercel AI SDK
npm install ai @ai-sdk/anthropic

# Anthropic SDK oficial
npm install @anthropic-ai/sdk

# Deepgram
npm install @deepgram/sdk

# DB
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Validación
npm install zod

# Estado
npm install zustand

# Auth
npm install resend

# Inngest
npm install inngest

# Observabilidad
npm install @sentry/nextjs
npm install @axiomhq/js

# PDF
npm install puppeteer
```

Versions mínimas: Next 15, React 19, TS 5.5+, Node 20+.

---

## 15 · Antipatrones que NO toleraré

Si te encuentras haciendo cualquiera de estos, paras y preguntas:

- Web Speech API nativa (calidad inconsistente)
- Server Components mezclados con `useState` o hooks de cliente
- Prompts del agente sin tool use estructurado
- Generación de casos sin validador Zod
- Generación de casos sin mapa de incertidumbre previo
- Componentes UI hechos a mano cuando shadcn ya tiene la primitiva
- Auth casero
- Guardar audio crudo
- Síntesis final como un único prompt monolítico de 5000 tokens sin estructura
- Postergar observabilidad
- localStorage para datos críticos

---

## 16 · Cuando termines una fase

Reporta al founder:

1. Lista de archivos creados o modificados
2. Comandos exactos para correr lo que hiciste
3. Qué probaste y qué resultado dio
4. Qué decisiones tomaste que no estaban en este documento, y por qué
5. Qué viene después

No avances a la siguiente fase sin que el founder valide lo anterior.

---

## 17 · Restricciones operativas globales

- Timeline: 7 días desde D1 hasta lanzamiento
- Concurrencia: hasta 10 entrevistas simultáneas
- Privacidad: LFPDPPP. NDA bilateral. NO guardar audio crudo
- Idioma: español MX en TODO lo visible al usuario
- Costos: presupuesto no es restrictivo pero justifica decisiones costosas

---

## 18 · Setup multi-agent (git worktrees)

Adoptado el 2026-05-02 tras incidente de race condition entre agentes paralelos
compartiendo el working tree principal (Phase 5 step 5). Patrón estándar de
aquí en adelante.

**Regla:** cada sesión paralela trabaja en su propio git worktree, NUNCA en el
working tree principal. El working tree principal queda en `master` (o en el
último branch estable) y solo lo tocan operaciones one-shot (merges, releases).

### Convención de ubicación

```
../vertice-<feature-slug>
```

Ejemplos en uso:
- `../vertice-review-handoff` → `feat/phase5-step5-review-handoff`
- `../vertice-deepgram-stt` → `feat/deepgram-stt-integration`
- `../vertice-formato-valores-por-caja` (futuro) → `feat/sonnet-formato-valores-por-caja`

### Crear worktree para una sesión nueva

```bash
# Desde el working tree principal:
git checkout master   # liberar la branch si la tenías checked-out aquí
git worktree add ../vertice-<slug> feat/<branch-name>
cd ../vertice-<slug>

# Si la branch es nueva, créala primero desde donde quieras ramificar:
git checkout -b feat/<branch-name> <base-commit>
git checkout master
git worktree add ../vertice-<slug> feat/<branch-name>
```

### Cleanup post-merge

Tras mergear la feature branch a master, el worktree queda huérfano. Limpiar:

```bash
# Desde el working tree principal:
git worktree remove ../vertice-<slug>
git branch -d feat/<branch-name>   # opcional: borrar la branch local también
```

Si el worktree tiene cambios sin commitear, `git worktree remove` falla — usar
`--force` solo si tienes certeza de que esos cambios no valen.

### node_modules

Cada worktree tiene su propio `node_modules` por default (resultado de `npm
install` desde dentro del worktree). Aceptable: el costo de espacio es
despreciable y la independencia evita races en `npm install` cross-worktree.

### Por qué importa

El working tree principal y los worktrees comparten el mismo `.git/` database
(stash, branches, refs). Pero **cada uno tiene su propio HEAD y working tree
independiente**. Esto significa:
- `git checkout` en un worktree no afecta el HEAD de otro.
- `git stash` es global (todos los worktrees ven el mismo stash list).
- `git branch -f` en un worktree puede romper el HEAD de otro si la branch
  apunta a otro worktree — git lo bloquea con error claro, pero ojo.

Antes de adoptar este patrón, los agentes paralelos hacían `git checkout` en
el mismo working tree y se pisaban HEADs entre sí (incidente reproducible 3
veces el 2026-05-02). Worktrees eliminan ese race por completo.

---

## 19 · Deuda técnica conocida

Items conocidos pero deferred. Listar aquí evita que se pierdan.

### ~~Inngest wiring para `sesion/lista_para_sintesis`~~ ✅ RESUELTO (commit 9, ver §20)

### Eventos Axiom sin emission site (2)

`docs/axiom_dashboard.md` lista los eventos pendientes de wiring. Los typed
helpers ya existen en `logger.*`; los call sites se agregarán cuando aterricen
las features que dependen:

1. `review.profundizacion.caja_collateral` — bloqueado por necesidad de
   trackear `round actual` + `cajas_a_reabordar` por grupo en la sesión. No
   hay state machine session-level que el handler `registrar_extraccion`
   pueda consultar todavía.
2. `caso.consumido_por_grupo` — bloqueado por pipeline de casos sintéticos
   (`CASOS_PIPELINE_READY=false`). Cuando aterrice ese pipeline, emitir el
   evento al consumir un caso tras decisión `caso_sintetico` de Opus.

`extraccion.contradice_sin_previa` se resolvió 2026-05-10 (ver §20).

### Google SSO real (post-MVP)

**Estado:** la landing pública (`app/page.tsx:870`) muestra un botón
"Continuar con Google" que abre un dialog "Próximamente. La autenticación
con Google estará disponible al activar el panel". El flujo único activo
hoy es magic link via email. El stub está intencional — la UI promete la
opción para el día que aterrice.

**Por qué importa para el roadmap:**
- Aliados financieros institucionales (CNBV-regulados) esperan SSO con
  cuenta corporativa (Google Workspace dominante en pyme MX). Magic link
  por email funciona pero los compliance teams suelen requerir auth
  federado.
- Acelera onboarding al 2do, 3er, Nº piloto: en lugar de generar magic
  link manual desde admin por cada nuevo usuario de la institución, el
  founder pre-autoriza el dominio (e.g. `@bancodemo.mx`) y cualquier
  empleado con cuenta Google de ese dominio entra directo.
- Reduce superficie de ataque a magic links (que viven 7 días con TTL
  fijo). SSO permite revocar al instante via Google Workspace admin.

**Decisiones arquitectónicas pendientes (founder + tech):**
1. **Scope:** ¿solo aliado-side, solo admin-side, ambos, o pivot completo
   reemplazando magic link? `lib/auth/admin.ts:13` ya menciona "puede
   pivotar a OAuth/SSO sin tocar el contrato".
2. **Provider:** ¿`next-auth` (Auth.js) v5, `@auth/core` direct, o
   implementación custom contra Google OAuth 2.0 + OIDC? next-auth da
   más rápido (adapter Drizzle existe), implementación custom da control
   sobre el cookie shape para no romper el contrato actual de
   `vertice_session = sesion_id`.
3. **Mapping a `sesiones`:** ¿la cuenta Google se ata 1:1 a una
   `instituciones`? ¿Múltiples emails Google pueden compartir la misma
   sesión activa de la institución? ¿Cómo se gestionan empleados que
   rotan? (Workspace admin revoca → ¿cierra la sesión Vértice?)
4. **Domain whitelist:** la admin debe poder agregar dominios autorizados
   por institución. Tabla nueva o columna jsonb en `instituciones`.
5. **Convivencia con magic link:** ¿se mantiene como fallback (cuenta
   personal sin Google Workspace) o se desactiva? Decisión que afecta
   la migración 0001 magic_tokens.

**Cambios concretos que requeriría:**
- Tabla `usuarios` (id, email, google_sub, institucion_id, role, created_at).
- Tabla `dominios_autorizados` o columna jsonb en `instituciones`.
- Server Actions: `signInWithGoogle`, `linkUsuarioToInstitucion`.
- Middleware: extender el gate cookie `vertice_session` para resolver
  vía usuario→institución (hoy es directo a sesion_id).
- UI: `app/page.tsx` reemplazar el dialog "Próximamente" con flow real;
  nuevo `/admin/usuarios` para gestión.
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`.

**Cuándo:** post-MVP, pre-segundo piloto. No bloqueante para el primer
aliado (puede entrar via magic link). Bloqueante para escalar a Nº pilotos
sin overhead manual del founder en cada onboarding.

**Tracker:** este item se mantiene en §19 hasta que aterrice (no
graduarlo a §20 sin resolución completa). Cuando se cierre, mover toda
la spec aquí escrita a §20 con cambios concretos aplicados.

### ~~Integration tests contra Neon branch efímero~~ ✅ RESUELTO 2026-05-10 (PR #8, ver §20)

---

## 20 · Deuda resuelta

Registro auditable de items que estuvieron en §19 y se cerraron. Listar aquí
(en vez de borrar) preserva el historial para postmortems y para entender por
qué algo está como está al releer.

### `mapa_incertidumbre` + `cajas_declinadas` — resuelto pre-2026-05-10

**Origen:** §19 (versión previa) listaba que `computeMapaIncertidumbre` no
consideraba `cajas_declinadas` como terminal. Auditoría 2026-05-10 confirma
que la deuda quedó stale — el código se cerró en algún commit posterior
(probablemente parte del wiring de Phase 5 step 5).

**Estado actual:**
- `lib/motor/mapa.ts:64` acepta `cajasDeclinadas: readonly string[]` como
  3er parámetro y trata `'declinada'` como `CajaStatus` terminal con override
  sobre cualquier estado de extracción.
- `app/api/turn/route.ts:315` ya pasa el set de declinadas (vía
  `listarCajasDeclinadas`) a `computeMapaIncertidumbre`.
- `lib/motor/mapa.test.ts` cubre el path declined (líneas 78, 86, 100, 103).

**Por qué se cierra ahora:** el doc seguía listándolo como pendiente; al
auditar §19 antes de tocar otra cosa, confirmamos que la implementación
existía. Movido a §20 para no inducir trabajo duplicado.

### Cleanup columnas dead `instituciones.magic_link_token` + `magic_link_expires_at` — resuelto 2026-05-10

**Origen:** Fase 4 dejó las dos columnas como dead-but-present (founder dijo
"no toca tablas existentes"). El flujo magic-link real usa la tabla separada
`magic_tokens` (Fase 4 migración 0001). Auditoría 2026-05-10 confirmó cero
uso en código.

**Cambios concretos:**
- `db/schema.ts` — removidas las dos columnas de la definición de
  `instituciones`. Comentario apunta a la migración.
- `db/migrations/0004_drop_dead_magic_link_cols.sql` — manual migration
  (patrón espejo de `0003_magic_token_revoked_at.sql`). Ejecuta DROP CONSTRAINT
  + 2 DROP COLUMN con `IF EXISTS` para idempotencia. **NO aplicada
  automáticamente** — founder la aplica manualmente al merge contra
  `vertice-mvp/main`.

### Eventos Axiom — `extraccion.contradice_sin_previa` wirado 2026-05-10

**Origen:** §19 listaba 3 eventos sin emission site. Auditoría 2026-05-10
identificó que `extraccion.contradice_sin_previa` no requería gating de otras
features y se podía wirear directamente.

**Cambios concretos:**
- `app/api/turn/route.ts:registrar_extraccion.execute` — track paralelo
  `contradiceFlags[i]` con el flag `contradice_extraccion_previa` por item;
  tras `persistirExtraccionesBatch`, emite `logger.extraccion.contradiceSinPrevia`
  para los items donde `contradice=true` pero `supersedido_id` quedó
  undefined (no había previa).
- `docs/axiom_dashboard.md` — tabla de eventos actualizada; sección "pendientes"
  reducida a 2 (ambos gateados por features no implementadas).

Los otros 2 (`review.profundizacion.caja_collateral` y `caso.consumido_por_grupo`)
quedan en §19 con explicación del bloqueo.

### Integration tests contra Neon branch efímero — resuelto 2026-05-10 (PR #8)

**Origen:** §19 listaba la deuda de tests integración contra Postgres real
porque los mocks `vi.hoisted` no validaban shape de SQL ni race conditions
reales sobre `secciones_cerradas` jsonb.

**Cambios concretos (commit `78308eb`):**
- `lib/motor/review.integration.test.ts` (12 tests, +232 LOC) contra branch
  Neon `test-integration` (`br-noisy-credit-amkaj2or`). Cubre:
  - `mergeSeccionCerrada` race + idempotencia con N=10 calls concurrentes.
  - `transicionarSesionASintetizando` guard atómico (2 calls simultáneas →
    exactamente uno retorna true).
  - `declinarCaja` ON CONFLICT DO NOTHING + FK 23503 + unique 23505.
  - `processSolicitarReview` full flow: insert reviews_seccion + atomic
    merge sesiones.secciones_cerradas + inserts cajas_declinadas con
    razon=aceptada_round_1, todo desde Postgres real con opusCall mockeado.
- `vitest.config.ts` — `fileParallelism: false` + `sequence: { concurrent:
  false }` para serializar suites; integration tests TRUNCATE las tablas
  que tocan y los singletons postgres-js no son re-entrantes seguros por
  suite.
- Skip-if-missing si `DATABASE_URL_TEST` no está set, así CI sin acceso a
  Neon no falla.

**Pendiente para sesión paralela A (no para esta deuda):** aplicar migración
0004 a branch principal `vertice-mvp/main` post-merge de PR #11.

### Inngest wiring para `sesion/lista_para_sintesis` — resuelto 2026-05-02

**Origen:** §19 (versión previa de IMPLEMENTATION.md) listaba el wiring real
como "Cuándo se desbloquea: Fase 8". Founder pidió cerrarlo pre-merge para
evitar sesiones huérfanas sin handler que las consuma (commit 9 de Phase 5
step 5, mensaje `fix(inngest): cablear dispatch real pre-merge` en branch
`feat/phase5-step5-review-handoff`).

**Cambios concretos:**
- `lib/inngest/client.ts` nuevo — singleton `new Inngest({ id: 'vertice' })`.
- `lib/inngest/functions/sintetizarSesion.ts` nuevo — `inngest.createFunction`
  que escucha `sesion/lista_para_sintesis` con `retries: 4`. Handler corre
  un único `step.run('placeholder-fase-8')` que solo logguea por ahora; en
  Fase 8 se reemplaza por la cadena real `validar perfil → llamar Opus →
  persistir → transición de status`. **Cero cambios al motor cuando llegue
  Fase 8** — el reemplazo es local a este archivo.
- `app/api/inngest/route.ts` nuevo — `serve` handler de `inngest/next`
  exportando `GET/POST/PUT`.
- `lib/motor/review.ts:dispatchSesionListaParaSintesis` reescrito: ahora
  hace `await inngest.send({ name, data })` real. El `event_id` retornado
  por Inngest se inyecta en el payload Axiom como `inngest_event_id` para
  correlación audit. Si `inngest.send` arroja, motor emite
  `logger.sesion.sintesisFailed` y propaga el error al caller (que decide
  revertir transición o dejar en `'sintetizando'` pendiente).
- `lib/observability/axiom.ts:SesionListaParaSintesisPayload` cambia el
  campo opcional `pendiente_inngest?: boolean` por `inngest_event_id?: string`.
- `lib/motor/review.test.ts` mockea `@/lib/inngest/client` con
  `vi.hoisted` + 2 tests nuevos que verifican que `inngest.send` se llama
  con shape correcto cuando `transicionExitosa=true`, y NO se llama cuando
  la transición falla por race con otro proceso.
- `lib/motor/review.e2e.test.ts` también mockea inngest defensivamente
  (sin tests duplicados — los integración viven en `review.test.ts`).

**Observaciones técnicas:**
- API Inngest v4 (instalado): `createFunction(options, handler)` con trigger
  dentro de `options.triggers`. v3 usaba 3 args; migrado.
- `EventSchemas.fromRecord<>` no existe en v4 top-level. Tipado del payload
  viene del lado del emisor (motor pasa `SesionListaParaSintesisPayload`).
- `.env.example` ya tenía `INNGEST_EVENT_KEY=` y `INNGEST_SIGNING_KEY=` vacíos
  desde Fase 1 — no requirió edición. Founder llena valores en `.env.local`.

**Sigue pendiente para Fase 8** (no es deuda de step 5 sino de fase futura):
substituir el `step.run('placeholder-fase-8')` por la implementación real
de `lib/motor/sintesis_final.ts`. El handler ya recibe el evento; solo falta
hacer el trabajo cuando le toque.
## 21 · STT — implementación inicial (sesión paralela Deepgram)

Construido en paralelo a Fase 5 (motor) en una sesión aislada (worktree `vertice-deepgram-stt`, rama `feat/deepgram-stt-integration`). Es STT puro — no está conectado al motor todavía, eso queda como deuda técnica explícita para una sesión futura.

**Variable de entorno requerida**

- `DEEPGRAM_API_KEY` — server-side. El browser nunca la ve; el flujo de auth es vía JWT efímero.

**Archivos**

- `lib/stt/client.ts` — wrapper sobre `@deepgram/sdk` v5. Exporta `STT_LIVE_CONFIG` (frozen const con la config cementada Nova-3) y `grantEphemeralToken(ttlSeconds=60)`.
- `app/api/stt/token/route.ts` — `POST` mintea JWT efímero (60s) si la cookie `vertice_session` apunta a una sesión `abierta` o `pausada`. 401 en cualquier otro caso.
- `lib/stt/use-deepgram-stream.ts` — hook React. Lifecycle `idle → requesting_mic → connecting → streaming → idle/error`. Mic permission, websocket directo a Deepgram con el JWT, transcripts interim/final/history, pause detection >1.5s, reintento exponencial 3x con refresh de JWT, pausa al perder foco de tab, edición manual marcada con `corregida_manualmente: true`, diarización conservada por palabra.
- `components/stt/MicButton.tsx` — botón circular con identidad Vértice (navy + gold).
- `components/stt/TranscriptionPanel.tsx` — panel scrollable, segmentos editables con contentEditable.
- `app/demo/stt/page.tsx` — ruta de QA manual (`/demo/stt`). Requiere sesión válida (cookie de magic link).
- `lib/stt/use-deepgram-stream.test.ts` y `app/api/stt/token/route.test.ts` — tests smoke en `describe.skip` con `@ts-nocheck` (esperando merge de vitest desde la rama `feat/phase5-step5-review-handoff`).

**Divergencia consciente con §8.4**

§8.4 describe un proxy server-side que tunelea el WebSocket de Deepgram. La implementación actual usa **JWT efímero + browser conecta directo a Deepgram** porque el SDK v5 expone `auth.v1.tokens.grant()`. Es la ruta "preferida" del prompt del founder, con proxy como fallback si el SDK no lo expusiera. Resultado: menos latencia (un hop menos), API key nunca sale del server.

§8.4 también lista `endpointing=800`. La config cementada del prompt del founder no incluyó ese parámetro — `vad_events: true` cubre el caso del fin-de-utterance vía mensajes `SpeechStarted` / `UtteranceEnd`, que el motor podrá usar cuando se conecte. Si el founder quiere `endpointing` además, se agrega a `STT_LIVE_CONFIG` en una sola línea.

**Decisión cementada: `language=multi`**

§4 lista la fila STT como "Nova-3 Multilingual `es-419`". Después de revisar el trade-off, el founder ratificó `language=multi` (modo de code-switching real de Nova-3) por encima de `es-419` puro: los subdirectores hacen code-switch ES↔EN constantemente para jerga financiera ("equity", "leverage", "covenant", "DSCR", "stress test", "buyout"). `es-419` puro degrada WER en esos términos; `multi` los maneja nativamente sin penalizar el español. La config queda cementada en `STT_LIVE_CONFIG` y `.env.example` lo refleja.

**Deuda técnica conocida**

- Integración con `app/api/turn/*` (motor de entrevista) PENDIENTE. Hoy `/demo/stt` es la única forma de ejercer el stack. Wiring queda para una sesión posterior, después de que la rama `feat/phase5-step5-review-handoff` (Fase 5 step 5) merge a master, para no chocar con el contrato de turnos en vuelo.
- `endpointing` no está cableado (ver arriba).
- Tests smoke siguen `describe.skip` hasta que vitest merge a master.

**Cómo hacer QA manual**

1. Login vía magic link (cualquier email registrado).
2. Navegar a `/demo/stt`.
3. Permitir mic. Hablar en español MX. Verificar que interim aparezca gris y final aparezca negro. Confirmar que "Pausa >1.5s" se vuelve "sí" cuando dejas de hablar.
4. Editar un segmento haciendo clic. Verificar el punto dorado de "corregida_manualmente".
5. Cambiar de pestaña. Verificar que la grabación se pausa y reanuda solo al volver.

---

## 22 · Pre-deploy checklist Fase 10

Lista cementada de pasos a completar antes de poner Vértice frente a un
piloto real. Cada item lleva owner explícito + criterio de done. NO mover a
done sin verificación literal.

### 22.1 Infrastructure

- [ ] **Vercel Blob storage para PDFs de síntesis** (owner: founder).
  - Provisionar bucket en Vercel dashboard (project: vertice).
  - Set `BLOB_READ_WRITE_TOKEN` en Vercel env (Production + Preview).
  - Wire `lib/inngest/functions/sintetizarSesion.ts:generar-pdf` step para
    `await blobStorage.put(buffer)` y persistir URL en
    `perfil_decision_final.pdf_url` (columna ya existe).
  - Done: una sesión completa en producción genera PDF y la URL queda
    accesible vía `/admin/instituciones/[id]` con expires según TTL del bucket.

- [ ] **Inngest cloud production keys** (owner: founder).
  - `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` en Vercel env (Production).
  - Verificar que `app/api/inngest/route.ts` recibe events dispatched desde
    `dispatchSesionListaParaSintesis` con event_id retornado correlacionado
    en Axiom.
  - Done: Inngest UI muestra runs de `sintetizar-sesion` exitosos en prod.

- [ ] **Neon production branch + migrations aplicadas** (owner: sesión A).
  - Confirmar que `vertice-mvp/main` tiene aplicadas las migraciones
    0000-0004 (incluida la 0004 drop de magic_link cols).
  - Smoke: `SELECT count(*) FROM reviews_seccion;` no falla shape-wise.
  - Done: `db/migrations/meta/_journal.json` actualizado y push a master.

### 22.2 LLM keys

- [ ] **`ANTHROPIC_API_KEY`** en Vercel env (Production).
  - Smoke: ejecutar una sesión real (PR #4 mergeado), confirmar que
    `productionOpusCall` (review.ts) y `productionOpusSintesisCall`
    (sintesis_final.ts) reciben respuesta con shape válido.
  - Capturar `usage.reasoningTokens` en primer run productivo para
    decidir si el budget 8K queda holgado o ajustado (ver
    `docs/pr4-review-notes.md` §2 si existe).
  - Done: una sesión end-to-end produce un PerfilDecisionFinal Zod-válido.

- [ ] **`DEEPGRAM_API_KEY`** en Vercel env (Production).
  - Smoke: `/entrevista/[sesion_id]` con sesión real, click MicButton →
    permiso mic → streaming → texto appendea al textarea.
  - Verificar el ciclo completo descrito en
    `lib/stt/append-transcript.ts` + PR #13.
  - Done: una pregunta entera resuelta solo con dictado, sin keyboard.

### 22.3 Email

- [ ] **`RESEND_API_KEY` + dominio verificado** (owner: founder).
  - Verificar dominio `vertice.mx` (o el que sea elegido) en Resend.
  - DKIM + SPF + DMARC publicados — validar con Resend dashboard.
  - Done: enviar magic link real desde admin a un email externo y
    confirmar que llega sin marcar como spam en Gmail/Outlook.

### 22.4 Smoke production

- [ ] **End-to-end real desde landing**:
  1. Abrir landing en prod.
  2. Magic link → email → click → /entrevista/[sesion_id].
  3. Responder 6 grupos con dictado + correcciones manuales.
  4. Llegar a cierre de sesión → status='sintetizando'.
  5. Inngest dispatch → Opus síntesis → status='completa'.
  6. PDF generado y URL accesible en `/admin/instituciones/[id]`.
  7. Email a founder con link al PDF (cuando esté wirado).
  - Done: founder revisa el PDF y le pasa la primera revisión cualitativa.

### 22.5 Pilotos iniciales

- [ ] **Lista de 2-3 aliados financieros** para piloto cerrado.
  - Selección por founder. Criterio: instituciones que ya tienen relación
    operativa con Vértice y aceptan dar feedback estructurado post-sesión.
  - Cada aliado recibe: 1 magic link, 1 email de bienvenida con
    instrucciones, 1 ventana de soporte directo del founder.
  - Done: cada aliado completó la sesión y firmó el feedback form
    (instrumento separado).

### 22.6 Rotación final de tokens

- [ ] **`ADMIN_PANEL_TOKEN` rotación final** (owner: sesión A).
  - Generar nuevo valor con `openssl rand -hex 32`.
  - Set en Vercel env (Production).
  - Confirmar que el viejo valor queda invalidado (intento de login con
    valor previo retorna 401).
  - Done: sesión A confirma rotación + actualiza `.audit/rotation_log.md`
    con fecha + responsable.

- [ ] **`AXIOM_TOKEN` con scope mínimo** (owner: founder).
  - Crear token de Axiom con permisos `Ingest` solamente sobre
    dataset `vertice-prod`. NO `Query` ni `Manage`.
  - Set en Vercel env (Production). Remover scopes elevados si los hubo.
  - Done: smoke de un evento (`logger.info('test', {})`) aparece en Axiom
    UI sin errores 401/403.

### 22.7 Observability dashboard

- [ ] **Axiom alerts configuradas** (owner: founder).
  - Tres alertas listadas en `docs/axiom_dashboard.md` §"Alarmas
    operacionales": threshold Sonnet (b > 40%), latencia Opus (e > 12s),
    Inngest sintesis fallando (>5%).
  - Cada alerta apunta a webhook Slack + email de founder.
  - Done: smoke de cada alerta forzando los thresholds en staging.

- [ ] **Sentry release tracking** (owner: founder).
  - Confirmar que `withSentryConfig` (next.config.ts:91) sube source
    maps en builds prod. Token `SENTRY_AUTH_TOKEN` en Vercel env.
  - Done: un error real en prod aparece en Sentry con stack trace
    deminificado.

---

**Fin del documento. Si hay ambigüedad, pregunta antes de asumir.**
