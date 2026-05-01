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
├── (marketing)/
│   └── page.tsx                    → landing pública (no necesario MVP, opcional)
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

### Fase 3 · Schemas Zod del credit box (3 horas) — 🟡 EN PROGRESO (cierre pendiente: TODO permite_no_aplica + tests)

Approach: **Zod como source of truth, types derivados con `z.infer`** (decisión founder 2026-04-30 — ver memoria `feedback_zod_source_of_truth`). NO escribir types paralelos a los schemas; si conviven, drift garantizado en 2 semanas.

- [x] **#1** `lib/schemas/casos.ts` — `CasoSinteticoSchema` + sub-schemas + `TipoInstitucionSchema` derivado de `tipoInstitucionEnum.enumValues`. `CasoSintetico = z.infer<typeof ...>`.
- [x] **#2** `lib/schemas/cajas.ts` — `CajaCanonSchema` + catálogo `CAJAS_CANON: CajaCanon[]` (49 entradas: 5 identidad + 44 núcleo). Helpers `getCajaCanon`, `isCajaCriticaCanon`, `getCajasByGrupoUI`. Sanity-check al cargar (throw si len ≠ 49).
- [x] **D1-D4 founder signoff (2026-04-30)** sobre catálogo. Criticidad de los 5 id_* aprobada (id_* se autollenan en onboarding salvo `id_anios_operacion` — el LLM las trata como confirmación, no extracción; la criticidad sigue para completitud). Híbridos `int o rango/ratio` colapsan a `int` con `null` como sentinel "no aplica/sin requisito". Las 5 `se_*` quedan como `objeto` con shape `{respuesta, condiciones?}` validado por `.refine()`. Extensión por tipo se ejecuta DESPUÉS de #3+#4 — los contratos de salida primero.
- [x] **#3** `lib/schemas/extracciones.ts` — `ExtraccionSchema` (envelope con `id`, `sesion_id`, `turno_id`, `caja_codigo`, `valor: z.unknown()`, `confianza 0-1`, `fuente: 'llm' | 'manual'`, `evidencia_textual`, `version` explícito (founder D-extra), `superseded_by` self-FK). Sub-schemas: `ToleranciaSchema` (to_* × 5), `SituacionEspecialSchema` con refine (se_* × 5), `EmailTelefonoSchema` (co_email_telefono), `EeffAuditadosSchema` con refine (op_eeff_auditados), `TasasPorProductoSchema` + `PlazosPorProductoSchema` (pc_* × 2). Resolver `valorSchemaFor(caja_codigo)` consulta CANON+EXTENSION vía `getCajaAny`; despacha por `tipo_dato` cuando no hay caso especial. `parseExtraccion(raw)` valida envelope + valor en un paso.
- [x] **#4** `lib/schemas/perfil_decision_final.ts` — `PerfilDecisionFinalSchema` keyed por `caja_codigo` (cada entry: `valor, confianza, fuente, evidencia_textual, intentos`). `FuenteCajaFinalSchema` extiende a `'decline_to_answer' | 'no_aplica'` para cajas que cerraron por cap o por respuesta explícita. Métricas usan denominador pinned (`sesiones.cajas_aplicables`). `PerfilDecisionFinalConsistenteSchema` agrega refines cross-field (`completitud === cajas_llenas / cajas_aplicables`, `cajas_llenas ≤ cajas_aplicables`).
- [x] **Catálogo extensión por tipo** — `CAJAS_EXTENSION_POR_TIPO: Record<TipoInstitucion, CajaCanon[]>` con 32 cajas distintas (cb_×5 compartido banco/sofom_er, cs_×5, csp_×3, cc_×3, ca_×6, cf_×6, cif_×4; `otro` = []). Todas marcadas `// !inferida` (criticidad y tipo_dato no especificados en §5.3 — pendientes de un sweep founder al cerrar Fase 3). Helpers nuevos: `getCajaExtension`, `getCajaAny`, `getCajasAplicables(tipo)`. Sanity-check al cargar (throw si distintas ≠ 32).
- [ ] **TODO cierre Fase 3 (D2 follow-up):** agregar `permite_no_aplica: boolean` a `CajaCanonSchema`. Lo usa el form lateral (toggle "no aplica") y la lógica de completitud (cuenta `null` como llena solo si la bandera es `true`). Cajas afectadas: `ru_score_pm_min`, `ru_score_pf_min`, `ru_antiguedad_min`, `ru_facturacion_min`, `gr_dscr_min`, `gr_deuda_ebitda_max`. Founder dijo agregarlo al cerrar Fase, no mid-fase.
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
- [ ] Cleanup post-Fase 4: las columnas `instituciones.magic_link_token` y `magic_link_expires_at` quedan dead-but-present (founder dijo "no toca tablas existentes"); cleanup en migración futura cuando convenga.

### Fase 5 · Motor conversacional core (8 horas) — la pieza más crítica
- [ ] System prompts en `lib/prompts/` (los 4 archivos de sección 7.4)
- [ ] Función `computeMapaIncertidumbre` pura
- [ ] Función `detectarFatiga` client-side
- [ ] API route `/api/turn` que orquesta el loop
- [ ] Tools de Sonnet con schemas Zod
- [ ] Llamada a Opus para casos sintéticos cuando se requiere
- [ ] Llamada a Opus para revisión de avance
- [ ] Persistencia de turnos, extracciones, casos en DB
- [ ] **Test E2E con respuestas mock antes de meter voz:** simula una entrevista completa con respuestas hardcodeadas y verifica que el motor cierra correctamente

### Fase 6 · Integración Deepgram (4 horas)
- [ ] Proxy `/api/deepgram` server-side
- [ ] WebRTC client para capturar audio
- [ ] Streaming de transcripción al textarea
- [ ] Manejo de pausas (keep-alive 8s, UI cuando >30s)
- [ ] Test con voz real en español MX

### Fase 7 · UI de la entrevista (8 horas)
- [ ] Layout split-screen
- [ ] Componente `<PreguntaCard>` con textarea + mic + botón respondida
- [ ] Animación de campos en verde al cerrar caja
- [ ] Panel lateral de progreso por sección (no por caja)
- [ ] Estado Zustand
- [ ] Manejo de "guardar y retomar"
- [ ] Indicador adaptativo "Sección X · Pregunta Y"

### Fase 8 · Síntesis final con Inngest (4 horas)
- [ ] Inngest function `sintetizar_perfil`
- [ ] Validación Zod con retry
- [ ] Generación de PDF con Puppeteer (plantilla simple)
- [ ] Storage del PDF (Vercel Blob o link de descarga directo del JSON)
- [ ] Notificación admin

### Fase 9 · Vista admin (4 horas)
- [ ] Lista de instituciones y sesiones (tabla simple)
- [ ] Detalle de institución con JSON viewer
- [ ] Detalle de sesión con transcripción + casos
- [ ] Botón crear nueva institución (genera magic link)
- [ ] Export CSV/JSON

### Fase 10 · Telemetría y deploy (3 horas)
- [ ] Logs estructurados a Axiom en cada llamada LLM
- [ ] Sentry capturando errores
- [ ] Deploy a Vercel
- [ ] Smoke test en producción
- [ ] 2-3 entrevistas piloto

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

**Fin del documento. Si hay ambigüedad, pregunta antes de asumir.**
