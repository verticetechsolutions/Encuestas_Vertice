// System prompt scaffolding for Sonnet 4.6 in Phase 1 (entrevista adaptativa).
//
// This file holds SENALES_A_ESCUCHAR_XML — the 54-ítem catalog that lives ONLY
// inside the system prompt. It maps the 5 to_* cajas (post-rename of mx_* el
// 2026-04-30) onto the historical 54 Likert items (matrices 12.A–12.E del HTML
// legado). Sonnet uses it as a listening reference: when the entrevistado says
// something that matches a señal, Sonnet records the citation as `evidencia_textual`
// under the corresponding caja. The user NEVER sees this catalog and is NEVER
// asked anything in Likert format.
//
// The full Phase 1 system prompt (role + instructions + tool definitions + few-shots)
// is assembled in Phase 5 (motor conversacional). Until that work lands,
// SONNET_FASE1_SYSTEM_PROMPT below is a placeholder that wires SENALES_A_ESCUCHAR_XML
// into a <context> envelope so the rest can be filled in around it. The engine MUST
// refuse to load Phase 1 while SONNET_FASE1_PROMPT_READY === false.

export const SENALES_A_ESCUCHAR_XML = `
<senales_a_escuchar>
  <descripcion_general>
    Catálogo de señales que pueden aparecer en respuestas libres del entrevistado y mapean a las 5 cajas to_*. Úsalo como referencia descriptiva: si oyes una señal de esta lista, regístrala como evidencia bajo la caja correspondiente. No preguntes los ítems uno por uno; preguntalas en bloques temáticos abiertos y deja que el entrevistado hable.
  </descripcion_general>

  <caja codigo="to_historial_credito" criticidad="alta" senales_count="11">
    <descripcion>Tolerancia institucional a manchas, retrasos, restructuras y problemas de Buró en el historial crediticio del cliente PM o PF.</descripcion>
    <senales>
      <senal id="12.A.1">Cliente con retrasos de 1 a 30 días en los últimos 12 meses.</senal>
      <senal id="12.A.2">Cliente con retrasos de 31 a 60 días en los últimos 24 meses.</senal>
      <senal id="12.A.3">Cliente con retrasos de 61 a 90 días en los últimos 36 meses.</senal>
      <senal id="12.A.4">Cliente con crédito en cartera vencida actualmente regularizado.</senal>
      <senal id="12.A.5">Cliente con reestructura crediticia en los últimos 3 años.</senal>
      <senal id="12.A.6">Cliente con quita concedida por otra institución.</senal>
      <senal id="12.A.7">Cliente que estuvo en concurso mercantil concluido satisfactoriamente.</senal>
      <senal id="12.A.8">Cliente con demanda mercantil abierta en los últimos 3 años.</senal>
      <senal id="12.A.9">Cliente con score Buró PM menor a 600.</senal>
      <senal id="12.A.10">Cliente con score Buró PM entre 600 y 650.</senal>
      <senal id="12.A.11">Representante legal o aval con problemas crediticios personales (cliente PM impecable).</senal>
    </senales>
  </caja>

  <caja codigo="to_situacion_fiscal" criticidad="blanda" senales_count="6">
    <descripcion>Tolerancia institucional a opinión SAT 32-D negativa, créditos fiscales, EFOS/EDOS y discrepancias fiscales.</descripcion>
    <senales>
      <senal id="12.B.1">Opinión SAT 32-D negativa vigente.</senal>
      <senal id="12.B.2">Opinión 32-D positiva hoy pero con créditos fiscales pagados en últimos 12 meses.</senal>
      <senal id="12.B.3">Cliente con convenio de pago en parcialidades vigente con SAT.</senal>
      <senal id="12.B.4">Cliente en lista del artículo 69 CFF (adeudos firmes publicados).</senal>
      <senal id="12.B.5">Cliente relacionado con EFOS o EDOS (art. 69-B CFF) en los últimos 5 años.</senal>
      <senal id="12.B.6">Discrepancia entre ingresos fiscales y ventas contables.</senal>
    </senales>
  </caja>

  <caja codigo="to_ratios_financieros" criticidad="alta" senales_count="14">
    <descripcion>Umbrales blandos en ratios financieros: EBITDA, apalancamiento, DSCR, capital contable, concentración de cartera, ejercicios cerrados, estacionalidad.</descripcion>
    <senales>
      <senal id="12.C.1">EBITDA negativo en el último ejercicio.</senal>
      <senal id="12.C.2">EBITDA negativo en 2 de los últimos 3 ejercicios.</senal>
      <senal id="12.C.3">Caída de facturación entre 20% y 40% YoY.</senal>
      <senal id="12.C.4">Caída de facturación mayor a 40% YoY.</senal>
      <senal id="12.C.5">Margen neto negativo pero EBITDA positivo.</senal>
      <senal id="12.C.6">Apalancamiento Deuda/EBITDA entre 4x y 6x.</senal>
      <senal id="12.C.7">Apalancamiento Deuda/EBITDA mayor a 6x.</senal>
      <senal id="12.C.8">DSCR proyectado entre 1.0x y 1.2x.</senal>
      <senal id="12.C.9">DSCR proyectado menor a 1.0x.</senal>
      <senal id="12.C.10">Capital contable negativo.</senal>
      <senal id="12.C.11">Dependencia de un solo cliente mayor a 60% de facturación.</senal>
      <senal id="12.C.12">Dependencia de un solo proveedor mayor a 60% de compras.</senal>
      <senal id="12.C.13">Empresa con menos de 2 ejercicios fiscales cerrados.</senal>
      <senal id="12.C.14">Empresa con flujos estacionales (más del 60% facturado en un trimestre).</senal>
    </senales>
  </caja>

  <caja codigo="to_colateral" criticidad="blanda" senales_count="12">
    <descripcion>Flexibilidad institucional sobre tipos de garantía, gravámenes, copropiedad, terrenos no plenos, activos importados, ubicación geográfica, fideicomisos, avales y maquinaria sin mercado secundario.</descripcion>
    <senales>
      <senal id="12.D.1">Garantía principal gravada con hipoteca de primer lugar por otra institución.</senal>
      <senal id="12.D.2">Garantía principal gravada parcialmente (gravamen menor a 50% del valor).</senal>
      <senal id="12.D.3">Garantía principal gravada parcialmente (gravamen entre 50% y 80% del valor).</senal>
      <senal id="12.D.4">Terreno ejidal, comunal o rural sin régimen de propiedad plena.</senal>
      <senal id="12.D.5">Inmueble en copropiedad sin consentimiento total de copropietarios.</senal>
      <senal id="12.D.6">Inmueble sin escritura inscrita en RPP (en trámite).</senal>
      <senal id="12.D.7">Activo importado usado sin pedimento regularizado.</senal>
      <senal id="12.D.8">Garantía ubicada en estado con alto riesgo operativo o inseguridad.</senal>
      <senal id="12.D.9">Cobertura de garantía menor a 2x con contrato gubernamental como respaldo.</senal>
      <senal id="12.D.10">Fideicomiso de garantía ya constituido con otra institución (compartido).</senal>
      <senal id="12.D.11">Aval patrimonial sin carta de no adeudo fiscal del aval.</senal>
      <senal id="12.D.12">Maquinaria especializada sin mercado secundario claro.</senal>
    </senales>
  </caja>

  <caja codigo="to_gobierno_documentacion" criticidad="blanda" senales_count="11">
    <descripcion>Tolerancia a estados financieros no auditados o con salvedades, licencias vencidas, documentación incompleta, gobierno corporativo informal, socios extranjeros o gubernamentales, cambios de control, litigios entre socios y PEPs.</descripcion>
    <senales>
      <senal id="12.E.1">Estados financieros no auditados (facturación mayor a $100 MDP).</senal>
      <senal id="12.E.2">Estados financieros del último ejercicio con salvedades del auditor.</senal>
      <senal id="12.E.3">Cliente sin licencias operativas vigentes (construcción, ambiental, COFEPRIS, etc.).</senal>
      <senal id="12.E.4">Cliente sin registros patronales IMSS al corriente.</senal>
      <senal id="12.E.5">Acta constitutiva no actualizada con poderes vigentes.</senal>
      <senal id="12.E.6">Empresa con socios extranjeros en más del 49%.</senal>
      <senal id="12.E.7">Empresa con participación gubernamental.</senal>
      <senal id="12.E.8">Empresa familiar sin gobierno corporativo formal.</senal>
      <senal id="12.E.9">Cambio reciente de control accionario (últimos 12 meses).</senal>
      <senal id="12.E.10">Socios con litigio abierto entre sí.</senal>
      <senal id="12.E.11">PEP (Persona Expuesta Políticamente) en estructura accionaria.</senal>
    </senales>
  </caja>

  <instrucciones_uso>
    <regla>NO preguntes los ítems uno por uno como un cuestionario. Pregunta en bloques temáticos abiertos: "¿Qué tan flexibles son con clientes que tienen manchas en buró?" y deja que el entrevistado hable.</regla>
    <regla>Cuando oigas una señal del catálogo, regístrala como evidencia textual de la caja correspondiente, citando la frase original del entrevistado.</regla>
    <regla>Si oyes una señal que NO está en el catálogo pero claramente aplica a una de las 5 cajas to_*, también regístrala — el catálogo es referencia, no exhaustivo.</regla>
    <regla>Si una señal podría aplicar a más de una caja (ej. aval con problemas fiscales toca to_colateral y to_situacion_fiscal), regístrala en la caja dominante según contexto y deja nota en la otra.</regla>
    <regla>Una respuesta libre del entrevistado puede llenar 5-10 señales en un solo turno. Aprovéchalo. No hagas follow-ups que ya quedaron respondidos.</regla>
    <regla>Las cajas críticas (to_historial_credito, to_ratios_financieros) requieren confianza ≥0.80 antes de cerrar Fase 1. Las blandas, ≥0.65.</regla>
  </instrucciones_uso>
</senales_a_escuchar>
`.trim();

// Placeholder. Phase 5 will fill in <role>, <instructions>, tool definitions, and
// few-shot examples around SENALES_A_ESCUCHAR_XML. The wiring below shows how the
// catalog is meant to plug in (as a child of <context>); the actual conversational
// behavior is not implemented here yet.
export const SONNET_FASE1_SYSTEM_PROMPT = `
<role>
  TODO Fase 5: definir rol del agente conductor (entrevistador adaptativo Sonnet).
</role>

<context>
  ${SENALES_A_ESCUCHAR_XML}
  <!-- TODO Fase 5: agregar contexto adicional (perfil de la institución, estado de
       cajas llenas, mapa de incertidumbre del turno actual, etc.) -->
</context>

<instructions>
  TODO Fase 5: definir flujo conversacional, manejo de tool-use (generar_batch_preguntas,
  registrar_extraccion, marcar_caja_llena), criterios de cierre y few-shots.
</instructions>
`.trim();

// Engine guard. Stays false until Phase 5 fills in role + instructions + tools.
export const SONNET_FASE1_PROMPT_READY = false;
