// Smoke unit tests para lib/motor/tools.ts. Sin LLM, sin DB.
// Valida cada schema con un input válido y al menos un inválido por campo crítico.

import {
  RegistrarExtraccionInputSchema,
  GenerarBatchPreguntasInputSchema,
  SolicitarCasoSinteticoInputSchema,
  REGISTRAR_EXTRACCION_TOOL,
  GENERAR_BATCH_PREGUNTAS_TOOL,
  SOLICITAR_CASO_SINTETICO_TOOL,
  SONNET_FASE1_TOOLS,
} from '../lib/motor/tools';

let pasos = 0;
let fallos = 0;
function ok(name: string, cond: boolean, detalle?: unknown) {
  pasos++;
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    fallos++;
    console.log(`  ✗ ${name}`, detalle ?? '');
  }
}

// =========================================================================
console.log('\n[registrar_extraccion]');

// válido — una sola extracción
ok('input válido (1 extracción)', RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{
    caja_codigo: 'ru_monto_max',
    valor: 50000000,
    confianza: 0.92,
    evidencia_textual: 'damos hasta 50 millones',
  }],
}).success);

// válido — múltiples extracciones, con flag de contradicción
ok('input válido (3 extracciones, una con contradice_extraccion_previa)', RegistrarExtraccionInputSchema.safeParse({
  extracciones: [
    { caja_codigo: 'ru_monto_min', valor: 2000000, confianza: 0.88, evidencia_textual: 'mínimo 2M' },
    { caja_codigo: 'ru_monto_max', valor: 100000000, confianza: 0.91, evidencia_textual: 'máximo 100M' },
    { caja_codigo: 'ru_moneda', valor: 'mxn', confianza: 0.95, evidencia_textual: 'todo en pesos', contradice_extraccion_previa: true },
  ],
}).success);

// válido — valor null (caja "no aplica" / "sin requisito")
ok('input válido con valor=null (sin requisito)', RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{ caja_codigo: 'ru_score_pm_min', valor: null, confianza: 0.85, evidencia_textual: 'no usamos score buró' }],
}).success);

// válido — valor objeto (situación especial)
ok('input válido con valor=objeto (se_pep_estructura)', RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{
    caja_codigo: 'se_pep_estructura',
    valor: { respuesta: 'condicional', condiciones: 'solo con due diligence reforzado' },
    confianza: 0.9,
    evidencia_textual: 'sí pero con DD reforzado',
  }],
}).success);

// inválido — array vacío
ok('inválido: extracciones=[] (mínimo 1)', !RegistrarExtraccionInputSchema.safeParse({
  extracciones: [],
}).success);

// inválido — confianza fuera de [0,1]
ok('inválido: confianza=1.5', !RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{ caja_codigo: 'ru_monto_max', valor: 100, confianza: 1.5, evidencia_textual: 'X' }],
}).success);

// inválido — evidencia_textual vacía (string)
ok('inválido: evidencia_textual=""', !RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{ caja_codigo: 'ru_monto_max', valor: 100, confianza: 0.9, evidencia_textual: '' }],
}).success);

// inválido — evidencia_textual ausente
ok('inválido: evidencia_textual ausente', !RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{ caja_codigo: 'ru_monto_max', valor: 100, confianza: 0.9 }],
}).success);

// inválido — caja_codigo vacío
ok('inválido: caja_codigo=""', !RegistrarExtraccionInputSchema.safeParse({
  extracciones: [{ caja_codigo: '', valor: 'X', confianza: 0.9, evidencia_textual: 'X' }],
}).success);

// =========================================================================
console.log('\n[generar_batch_preguntas]');

// válido — 3 preguntas
ok('input válido (3 preguntas)', GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: '¿Qué monto mínimo y máximo financian?', cajas_objetivo: ['ru_monto_min', 'ru_monto_max'] },
    { texto: '¿En qué moneda operan?', cajas_objetivo: ['ru_moneda'] },
    { texto: '¿Cuál es el ticket ideal?', cajas_objetivo: ['ru_ticket_ideal'] },
  ],
  longitud_batch: 3,
}).success);

// válido — 2 preguntas (mínimo)
ok('input válido (batch de 2)', GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: 'A?', cajas_objetivo: ['cri_a'] },
    { texto: 'B?', cajas_objetivo: ['cri_b'] },
  ],
  longitud_batch: 2,
}).success);

// válido — 4 preguntas (máximo)
ok('input válido (batch de 4)', GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: '1?', cajas_objetivo: ['c1'] },
    { texto: '2?', cajas_objetivo: ['c2'] },
    { texto: '3?', cajas_objetivo: ['c3'] },
    { texto: '4?', cajas_objetivo: ['c4'] },
  ],
  longitud_batch: 4,
}).success);

// inválido — longitud_batch=5 (literal no permitido)
ok('inválido: longitud_batch=5', !GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: '1?', cajas_objetivo: ['c1'] },
    { texto: '2?', cajas_objetivo: ['c2'] },
    { texto: '3?', cajas_objetivo: ['c3'] },
    { texto: '4?', cajas_objetivo: ['c4'] },
    { texto: '5?', cajas_objetivo: ['c5'] },
  ],
  longitud_batch: 5,
}).success);

// inválido — longitud_batch=1 (mínimo es 2)
ok('inválido: longitud_batch=1', !GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [{ texto: 'única?', cajas_objetivo: ['c1'] }],
  longitud_batch: 1,
}).success);

// inválido — preguntas.length ≠ longitud_batch
ok('inválido: array length (2) ≠ longitud_batch (3)', !GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: '1?', cajas_objetivo: ['c1'] },
    { texto: '2?', cajas_objetivo: ['c2'] },
  ],
  longitud_batch: 3,
}).success);

// inválido — pregunta sin cajas_objetivo
ok('inválido: cajas_objetivo=[]', !GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: 'qué?', cajas_objetivo: [] },
    { texto: 'otra?', cajas_objetivo: ['c1'] },
  ],
  longitud_batch: 2,
}).success);

// inválido — texto vacío
ok('inválido: texto=""', !GenerarBatchPreguntasInputSchema.safeParse({
  preguntas: [
    { texto: '', cajas_objetivo: ['c1'] },
    { texto: 'otra?', cajas_objetivo: ['c2'] },
  ],
  longitud_batch: 2,
}).success);

// =========================================================================
console.log('\n[solicitar_caso_sintetico]');

// válido — urgencia alta
ok('input válido (urgencia alta)', SolicitarCasoSinteticoInputSchema.safeParse({
  cajas_objetivo: ['to_historial_credito', 'se_concurso_mercantil'],
  hipotesis_a_clausurar: 'la institución dice ser flexible con buró pero quiero confirmar con un caso de retraso 60 días',
  urgencia: 'alta',
}).success);

// válido — urgencia media, una sola caja
ok('input válido (urgencia media, 1 caja)', SolicitarCasoSinteticoInputSchema.safeParse({
  cajas_objetivo: ['to_ratios_financieros'],
  hipotesis_a_clausurar: 'tolerancia a DSCR 1.05x',
  urgencia: 'media',
}).success);

// inválido — urgencia desconocida
ok('inválido: urgencia="critica" (solo alta/media)', !SolicitarCasoSinteticoInputSchema.safeParse({
  cajas_objetivo: ['c1'],
  hipotesis_a_clausurar: 'X',
  urgencia: 'critica',
}).success);

// inválido — sin cajas_objetivo
ok('inválido: cajas_objetivo=[]', !SolicitarCasoSinteticoInputSchema.safeParse({
  cajas_objetivo: [],
  hipotesis_a_clausurar: 'X',
  urgencia: 'alta',
}).success);

// inválido — hipotesis vacía
ok('inválido: hipotesis_a_clausurar=""', !SolicitarCasoSinteticoInputSchema.safeParse({
  cajas_objetivo: ['c1'],
  hipotesis_a_clausurar: '',
  urgencia: 'alta',
}).success);

// =========================================================================
console.log('\n[Anthropic tool definitions]');

ok('REGISTRAR_EXTRACCION_TOOL.name', REGISTRAR_EXTRACCION_TOOL.name === 'registrar_extraccion');
ok('GENERAR_BATCH_PREGUNTAS_TOOL.name', GENERAR_BATCH_PREGUNTAS_TOOL.name === 'generar_batch_preguntas');
ok('SOLICITAR_CASO_SINTETICO_TOOL.name', SOLICITAR_CASO_SINTETICO_TOOL.name === 'solicitar_caso_sintetico');

const tieneInputSchema = (t: { input_schema?: unknown }) =>
  !!t.input_schema && typeof t.input_schema === 'object' && (t.input_schema as { type?: unknown }).type === 'object';
ok('REGISTRAR input_schema es JSON Schema object', tieneInputSchema(REGISTRAR_EXTRACCION_TOOL));
ok('BATCH input_schema es JSON Schema object', tieneInputSchema(GENERAR_BATCH_PREGUNTAS_TOOL));
ok('SOLICITAR input_schema es JSON Schema object', tieneInputSchema(SOLICITAR_CASO_SINTETICO_TOOL));

ok('SONNET_FASE1_TOOLS contiene los 3 (no 4)', SONNET_FASE1_TOOLS.length === 3);
ok('SONNET_FASE1_TOOLS no incluye marcar_caja_llena', !SONNET_FASE1_TOOLS.some((t) => t.name === 'marcar_caja_llena'));

// Sanity: descripciones no vacías
ok('todas las tools tienen description no trivial', SONNET_FASE1_TOOLS.every((t) => t.description.length > 50));

// =========================================================================
console.log(`\n${pasos - fallos}/${pasos} smoke ✓${fallos ? ` — ${fallos} fallos ✗` : ''}`);
process.exit(fallos === 0 ? 0 : 1);
