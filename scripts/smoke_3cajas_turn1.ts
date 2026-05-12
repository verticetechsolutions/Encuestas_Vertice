// Smoke: drive REAL Sonnet 4.6 sobre el Turno 1 del plan de prueba E2E de 3 cajas.
//
// Valida concerns (1) cerrar caja y (2) procesar respuestas en una sola pasada:
//   - Sonnet llama registrar_extraccion con shape correcto
//   - Los valores pasan valorSchemaFor (mismo gate que usa el motor real)
//   - Cajas esperadas (id_anios_operacion, ru_monto_min, id_tipo_institucion,
//     id_regulacion) extraen con confianza ≥ threshold
//   - El batch siguiente no re-pregunta cajas ya cerradas
//
// Sin DB. Persistencia mockeada vía execute stubs que capturan inputs. Esto
// aísla el experimento al LLM puro — si falla, el problema es el prompt o el
// modelo, no la persistencia.
//
// Invocar:  npx tsx scripts/smoke_3cajas_turn1.ts

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });

import { streamText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

import {
  RegistrarExtraccionInputSchema,
  GenerarBatchPreguntasInputSchema,
  SolicitarCasoSinteticoInputSchema,
  type RegistrarExtraccionInput,
  type GenerarBatchPreguntasInput,
  type SolicitarCasoSinteticoInput,
} from '../lib/motor/tools';
import { SolicitarReviewSeccionInputSchema } from '../lib/schemas/review_seccion';
import { SONNET_FASE1_SYSTEM_PROMPT } from '../lib/prompts/sonnet_fase1';
import { getCajasAplicables } from '../lib/schemas/cajas';
import { valorSchemaFor } from '../lib/schemas/extracciones';

const MENSAJE_T1 =
  'Somos SOFOM ENR con 12 años en operación, regulada por CNBV. Nuestro ticket mínimo es de 500 mil pesos.';

type ReviewInput = Parameters<typeof SolicitarReviewSeccionInputSchema.parse>[0];

const captures = {
  registrar: [] as RegistrarExtraccionInput[],
  batch: [] as GenerarBatchPreguntasInput[],
  caso: [] as SolicitarCasoSinteticoInput[],
  review: [] as ReviewInput[],
  textChunks: [] as string[],
};

const cajasApl = getCajasAplicables('sofom_enr');
const cajasAplSet = new Set(cajasApl.map((c) => c.codigo));

console.log('============================================');
console.log(' Smoke E2E · Turno 1 — Sonnet 4.6 real');
console.log('============================================');
console.log(`Cajas aplicables a sofom_enr : ${cajasApl.length}`);
console.log(`Mensaje usuario              : "${MENSAJE_T1}"`);
console.log('');

async function main() {
const t0 = Date.now();

const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: SONNET_FASE1_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: MENSAJE_T1 }],
  tools: {
    registrar_extraccion: tool({
      description: 'Registra extracciones de cajas con supersede chain.',
      inputSchema: RegistrarExtraccionInputSchema,
      execute: async (input) => {
        captures.registrar.push(input);
        return {
          ok: true,
          persisted: input.extracciones.length,
          supersedidos: 0,
          errores: [],
          mapa_summary: {
            llenas_por_grupo: {
              identificacion: 0,
              productos_y_mercado: 0,
              numeros_del_negocio: 0,
              operacion: 0,
              pricing_y_criterio: 0,
              contacto_y_especificos: 0,
            },
            criticas_pct: 0,
            blandas_pct: 0,
            top_a_atacar: [] as string[],
          },
        };
      },
    }),
    generar_batch_preguntas: tool({
      description: 'Genera el siguiente batch de preguntas.',
      inputSchema: GenerarBatchPreguntasInputSchema,
      execute: async (input) => {
        captures.batch.push(input);
        return { ok: true };
      },
    }),
    solicitar_caso_sintetico: tool({
      description: 'Solicita caso sintético.',
      inputSchema: SolicitarCasoSinteticoInputSchema,
      execute: async (input) => {
        captures.caso.push(input);
        return { ok: false, reason: 'no_disponible_en_smoke' };
      },
    }),
    solicitar_review_seccion: tool({
      description: 'Solicita review del director (Opus) sobre el grupo_ui.',
      inputSchema: SolicitarReviewSeccionInputSchema,
      execute: async (input) => {
        captures.review.push(input);
        return { ok: false, reason: 'no_disponible_en_smoke' };
      },
    }),
  },
  stopWhen: stepCountIs(4),
});

for await (const chunk of result.textStream) {
  captures.textChunks.push(chunk);
}

const elapsedMs = Date.now() - t0;
const finalText = captures.textChunks.join('');

console.log('\n=== Tool calls ===');
const allExtr = captures.registrar.flatMap((c) => c.extracciones);
console.log(`registrar_extraccion     : ${captures.registrar.length} calls, ${allExtr.length} extracciones`);
console.log(`generar_batch_preguntas  : ${captures.batch.length} calls`);
console.log(`solicitar_caso_sintetico : ${captures.caso.length} calls`);
console.log(`solicitar_review_seccion : ${captures.review.length} calls`);
console.log(`tiempo total             : ${(elapsedMs / 1000).toFixed(2)}s`);

console.log('\n=== Extracciones detalle ===');
for (const e of allExtr) {
  const ev = e.evidencia_textual.length > 80 ? e.evidencia_textual.slice(0, 77) + '...' : e.evidencia_textual;
  console.log(`  · ${e.caja_codigo.padEnd(28)} valor=${JSON.stringify(e.valor)}  conf=${e.confianza.toFixed(2)}  ev="${ev}"`);
}

if (captures.batch.length > 0) {
  console.log('\n=== Siguiente batch (preguntas que verá el usuario) ===');
  for (const b of captures.batch) {
    for (const p of b.preguntas) {
      const cs = p.cajas_objetivo.join(', ');
      console.log(`  · "${p.texto}"  [→ ${cs}]`);
    }
  }
}

if (finalText.trim().length > 0) {
  console.log('\n=== Texto final del agente ===');
  console.log(finalText);
}

// ============================================================================
// Aserciones
// ============================================================================
let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, hint?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${hint !== undefined ? '\n      hint: ' + JSON.stringify(hint) : ''}`);
    failed++;
  }
}

console.log('\n=== Aserciones Turno 1 ===');

// A · concern (2): el modelo llamó registrar_extraccion
ok('A1 · Sonnet llamó registrar_extraccion al menos 1 vez', captures.registrar.length >= 1);

// B · concern (2): forma de cada extracción
ok(
  'A2 · Todas las extracciones traen evidencia_textual no vacía',
  allExtr.every((e) => typeof e.evidencia_textual === 'string' && e.evidencia_textual.trim().length > 0)
);

const codigosInvalidos = allExtr.filter((e) => !cajasAplSet.has(e.caja_codigo)).map((e) => e.caja_codigo);
ok(
  'A3 · Todos los caja_codigo están en cajas aplicables (sin alucinaciones)',
  codigosInvalidos.length === 0,
  codigosInvalidos
);

const valoresInvalidos = allExtr
  .filter((e) => !valorSchemaFor(e.caja_codigo).safeParse(e.valor).success)
  .map((e) => ({ codigo: e.caja_codigo, valor: e.valor }));
ok(
  'A4 · Todos los valores pasan valorSchemaFor (mismo gate que el motor)',
  valoresInvalidos.length === 0,
  valoresInvalidos
);

// C · concern (1): cajas esperadas extraídas con threshold correcto
const anios = allExtr.find((e) => e.caja_codigo === 'id_anios_operacion');
ok('B1 · Caja id_anios_operacion fue extraída', !!anios);
if (anios) {
  ok('B1.a · valor = 12', anios.valor === 12, anios.valor);
  ok('B1.b · confianza ≥ 0.65 (blanda)', anios.confianza >= 0.65, anios.confianza);
}

const monto = allExtr.find((e) => e.caja_codigo === 'ru_monto_min');
ok('B2 · Caja ru_monto_min fue extraída', !!monto);
if (monto) {
  ok('B2.a · valor = 500000', monto.valor === 500000, monto.valor);
  ok('B2.b · confianza ≥ 0.80 (crítica)', monto.confianza >= 0.8, monto.confianza);
}

// D · Bonus: extracción multi-caja en una sola respuesta
const tipo = allExtr.find((e) => e.caja_codigo === 'id_tipo_institucion');
ok('C1 · Bonus: id_tipo_institucion = "sofom_enr"', !!tipo && tipo.valor === 'sofom_enr', tipo?.valor);

const reg = allExtr.find((e) => e.caja_codigo === 'id_regulacion');
ok(
  'C2 · Bonus: id_regulacion incluye "cnbv"',
  !!reg && Array.isArray(reg.valor) && (reg.valor as string[]).includes('cnbv'),
  reg?.valor
);

// E · concern (3): el siguiente batch existe y no re-pregunta lo ya cerrado
ok('D1 · Sonnet generó batch siguiente', captures.batch.length >= 1);
if (captures.batch.length > 0) {
  const cerradasYa = new Set(['id_anios_operacion', 'ru_monto_min', 'id_tipo_institucion', 'id_regulacion']);
  const objetivosRepetidos = captures.batch
    .flatMap((b) => b.preguntas)
    .flatMap((p) => p.cajas_objetivo)
    .filter((c) => cerradasYa.has(c));
  ok('D2 · Batch no apunta a cajas ya cerradas', objetivosRepetidos.length === 0, objetivosRepetidos);

  const objetivosFueraDeCanon = captures.batch
    .flatMap((b) => b.preguntas)
    .flatMap((p) => p.cajas_objetivo)
    .filter((c) => !cajasAplSet.has(c));
  ok('D3 · cajas_objetivo del batch están en canon', objetivosFueraDeCanon.length === 0, objetivosFueraDeCanon);
}

console.log(`\n${passed}/${passed + failed} aserciones ✓${failed ? ` — ${failed} fallos ✗` : ''}`);
process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[smoke] error fatal:', err);
  process.exit(1);
});
