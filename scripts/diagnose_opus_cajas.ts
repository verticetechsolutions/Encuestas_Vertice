// Diagnóstico: ¿el bug `cajas: {}` está en AI SDK o en Opus 4.7?
//
// Compara dos modos contra el mismo input:
//   Modo 1: AI SDK v6 + generateObject (lo que usa el motor hoy)
//   Modo 2: Anthropic SDK directo + raw Messages API + output_config.format
//
// Si ambos emiten cajas={}, el bug es de Opus 4.7 con structured output forzado.
// Si solo el modo 1 falla, el bug es del AI SDK y podemos eliminar el fallback
// cuando upgrademos.
//
// Costo: ~$0.20 (2 llamadas Opus 4.7 con thinking adaptive).
//
// Invocar:  npx tsx scripts/diagnose_opus_cajas.ts

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });

import { z } from 'zod';
import { generateObject } from 'ai';
import { anthropic as anthropicProvider } from '@ai-sdk/anthropic';
import Anthropic from '@anthropic-ai/sdk';

import { SintesisInput } from '../lib/motor/sintesis_final';
import {
  PerfilDecisionFinalConsistenteSchema,
} from '../lib/schemas/perfil_decision_final';
import {
  OPUS_SINTESIS_FINAL_SYSTEM_PROMPT,
} from '../lib/prompts/opus_sintesis_final';

// Mock input idéntico al usado en pipeline E2E.
function buildMockInput(): SintesisInput {
  const codigos = [
    'id_razon_social', 'id_nombre_comercial', 'id_tipo_institucion', 'id_regulacion', 'id_anios_operacion',
    'nm_productos_ofrecidos', 'nm_productos_no_ofrecidos', 'nm_sectores_aceptados', 'nm_sectores_excluidos',
    'nm_sectores_ventaja', 'nm_cobertura_geografica', 'nm_tipos_cliente',
    'ru_monto_min', 'ru_monto_max', 'ru_ticket_ideal', 'ru_moneda', 'ru_antiguedad_min',
    'ru_facturacion_min', 'ru_score_pm_min', 'ru_score_pf_min',
    'gr_tipos_garantia', 'gr_cobertura_min', 'gr_dscr_min', 'gr_deuda_ebitda_max',
    'gr_capital_contable_min', 'gr_caida_facturacion_max', 'gr_ratios_definitorios',
    'op_tiempo_viabilidad', 'op_tiempo_comite', 'op_tiempo_fondeo', 'op_frecuencia_comite',
    'op_documentacion_estandar', 'op_eeff_auditados',
    'pc_tasas_por_producto', 'pc_plazos_por_producto', 'pc_reglas_pricing', 'pc_conversion_producto',
    'to_historial_credito', 'to_situacion_fiscal', 'to_ratios_financieros', 'to_colateral', 'to_gobierno_documentacion',
    'se_sin_historial', 'se_sat_32d_negativa', 'se_concurso_mercantil', 'se_socios_extranjeros', 'se_pep_estructura',
    'co_punto_contacto', 'co_email_telefono',
    'cs_scoring_alternativo', 'cs_sla_total', 'cs_integracion_digital', 'cs_revolvente_ticket', 'cs_vinculo_patrimonial',
  ];

  return {
    sesion: {
      id: '00000000-0000-0000-0000-000000000001',
      institucion: {
        id: '00000000-0000-0000-0000-000000000002',
        razon_social: 'Vértice Financiero, S.A. de C.V., SOFOM ENR',
        nombre_comercial: 'Vértice Capital',
        tipo: 'sofom_enr',
      },
      cajas_aplicables: 54,
      fatiga_detectada: false,
      casos_sinteticos_aplicados: 0,
    },
    cajas_aplicables_codigos: codigos,
    extracciones: [
      { caja_codigo: 'id_razon_social', valor: 'Vértice Financiero, S.A. de C.V., SOFOM ENR', confianza: 0.97, evidencia_textual: 'razón social', fuente: 'llm', intentos: 1 },
      { caja_codigo: 'id_tipo_institucion', valor: 'sofom_enr', confianza: 0.97, evidencia_textual: 'SOFOM ENR', fuente: 'llm', intentos: 1 },
      { caja_codigo: 'id_anios_operacion', valor: 7, confianza: 0.97, evidencia_textual: '7 años', fuente: 'llm', intentos: 1 },
      { caja_codigo: 'ru_monto_min', valor: 500000, confianza: 0.95, evidencia_textual: 'mínimo 500k', fuente: 'llm', intentos: 1 },
      { caja_codigo: 'ru_monto_max', valor: 25000000, confianza: 0.92, evidencia_textual: 'tope 25 mdp', fuente: 'llm', intentos: 1 },
      // Suficiente para probar el comportamiento; no necesitamos las 35.
    ],
    cajas_declinadas: [],
  };
}

async function modo1_aiSdk(input: SintesisInput) {
  console.log('\n--- Modo 1: AI SDK v6 + generateObject ---');
  const t0 = Date.now();
  const result = await generateObject({
    model: anthropicProvider('claude-opus-4-7'),
    system: OPUS_SINTESIS_FINAL_SYSTEM_PROMPT,
    schema: PerfilDecisionFinalConsistenteSchema,
    prompt: JSON.stringify(input, null, 2),
    maxOutputTokens: 32000,
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
      },
    },
  });
  const elapsed = Date.now() - t0;

  const cajasCount = Object.keys((result.object as { cajas?: object }).cajas ?? {}).length;
  console.log(`  finishReason: ${result.finishReason}`);
  console.log(`  usage: input=${result.usage?.inputTokens} output=${result.usage?.outputTokens}`);
  console.log(`  cajas count: ${cajasCount}`);
  console.log(`  resumen length: ${((result.object as { resumen_ejecutivo?: string }).resumen_ejecutivo ?? '').length} chars`);
  console.log(`  tiempo: ${(elapsed / 1000).toFixed(1)}s`);
  return cajasCount;
}

async function modo2_anthropicSdkDirecto(input: SintesisInput) {
  console.log('\n--- Modo 2: Anthropic SDK puro + output_config.format ---');
  const client = new Anthropic();

  // Mismo Zod schema → JSON schema
  const jsonSchema = z.toJSONSchema(PerfilDecisionFinalConsistenteSchema);

  const t0 = Date.now();
  // @ts-expect-error — output_config y thinking adaptive son beta/recientes
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 32000,
    system: OPUS_SINTESIS_FINAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }],
    thinking: { type: 'adaptive' },
    output_config: {
      format: {
        type: 'json_schema',
        schema: jsonSchema,
      },
    },
  });
  const elapsed = Date.now() - t0;

  // Buscar el bloque text con el JSON
  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.log(`  parse error: ${err instanceof Error ? err.message : err}`);
    console.log(`  raw text (first 500): ${jsonText.slice(0, 500)}`);
    return -1;
  }

  const cajasCount = Object.keys((parsed as { cajas?: object }).cajas ?? {}).length;
  console.log(`  stop_reason: ${response.stop_reason}`);
  console.log(`  usage: input=${response.usage.input_tokens} output=${response.usage.output_tokens}`);
  console.log(`  cajas count: ${cajasCount}`);
  console.log(`  resumen length: ${((parsed as { resumen_ejecutivo?: string }).resumen_ejecutivo ?? '').length} chars`);
  console.log(`  tiempo: ${(elapsed / 1000).toFixed(1)}s`);
  return cajasCount;
}

async function main() {
  console.log('============================================================');
  console.log(' Diagnóstico: bug `cajas={}` de Opus 4.7');
  console.log('============================================================');

  const input = buildMockInput();
  console.log(`Input: sofom_enr, ${input.cajas_aplicables_codigos.length} cajas aplicables, ${input.extracciones.length} extracciones`);

  let modo1Count = -1;
  let modo2Count = -1;

  try {
    modo1Count = await modo1_aiSdk(input);
  } catch (err) {
    console.log(`  ERROR: ${err instanceof Error ? err.message : err}`);
  }

  try {
    modo2Count = await modo2_anthropicSdkDirecto(input);
  } catch (err) {
    console.log(`  ERROR: ${err instanceof Error ? err.message : err}`);
  }

  console.log('\n============================================================');
  console.log(' Diagnóstico');
  console.log('============================================================');
  console.log(`  Modo 1 (AI SDK):    cajas count = ${modo1Count}`);
  console.log(`  Modo 2 (raw SDK):   cajas count = ${modo2Count}`);
  console.log('');
  if (modo1Count >= 50 && modo2Count >= 50) {
    console.log('  → Ambos OK. El bug que vimos pudo ser flaky/dependiente del input.');
  } else if (modo1Count < 50 && modo2Count >= 50) {
    console.log('  → BUG DEL AI SDK. Opus puro funciona, AI SDK lo rompe.');
    console.log('     Acción: investigar AI SDK provider options para Anthropic + structured output.');
    console.log('     Workaround actual (motor fallback) puede removerse tras upgrade.');
  } else if (modo1Count < 50 && modo2Count < 50) {
    console.log('  → BUG DE OPUS 4.7. Structured output con schema sin minProperties = cajas opcionales.');
    console.log('     Acción: workaround del motor SE QUEDA. Opus 4.7 prioriza schema-legal.');
    console.log('     Posible mitigación futura: restructurar schema o usar tool calling.');
  } else {
    console.log('  → Resultado inesperado. Revisar logs.');
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
