// E2E smoke: drive REAL Sonnet 4.6 sobre los 3 turnos del plan de prueba.
//
// Cubre los 3 concerns del founder:
//   (1) cerrar caja y avanzar  →  status='llena' tras buena respuesta, top_a_atacar avanza
//   (2) procesar respuestas    →  shape correcto, evidencia textual fiel
//   (3) cuándo preguntar más   →  follow-up tras respuesta vaga, no repetir cerradas
//
// Estrategia:
//   - Persistencia mockeada in-memory pero FIEL al motor real (supersede chain,
//     version autoincrement, mapa via computeMapaIncertidumbre).
//   - Conversación multi-turn: messages[] crece con response.messages tras cada turno.
//   - Por turno: aserciones específicas. Al final: aserciones globales.
//
// Invocar:  npx tsx scripts/smoke_3cajas_e2e.ts

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });

import { streamText, tool, stepCountIs, type ModelMessage } from 'ai';
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
import { getCajasAplicables, GrupoUISchema, type GrupoUI } from '../lib/schemas/cajas';
import type { Extraccion } from '../lib/schemas/extracciones';
import { computeMapaIncertidumbre } from '../lib/motor/mapa';

type ReviewInput = Parameters<typeof SolicitarReviewSeccionInputSchema.parse>[0];

// ============================================================================
// Estado simulado del motor (in-memory, fiel a persistirExtraccionesBatch)
// ============================================================================
const SESION_ID = randomUUID();
const TIPO = 'sofom_enr' as const;
const cajasApl = getCajasAplicables(TIPO);
const cajasAplSet = new Set(cajasApl.map((c) => c.codigo));

const state = {
  extracciones: [] as Extraccion[],
  perTurn: [] as {
    turn: number;
    user: string;
    registrar: RegistrarExtraccionInput[];
    batch: GenerarBatchPreguntasInput[];
    caso: SolicitarCasoSinteticoInput[];
    review: ReviewInput[];
    text: string;
    mapaAfter: ReturnType<typeof computeMapaIncertidumbre>;
    elapsedMs: number;
  }[],
};

function aplicarExtracciones(input: RegistrarExtraccionInput, turnoId: string) {
  for (const e of input.extracciones) {
    const previa = state.extracciones.find(
      (x) => x.caja_codigo === e.caja_codigo && !x.superseded_by
    );
    const nuevoId = randomUUID();
    if (previa) previa.superseded_by = nuevoId;
    state.extracciones.push({
      id: nuevoId,
      sesion_id: SESION_ID,
      turno_id: turnoId,
      caja_codigo: e.caja_codigo,
      valor: e.valor,
      confianza: e.confianza,
      fuente: 'llm',
      evidencia_textual: e.evidencia_textual,
      version: previa ? previa.version + 1 : 1,
      superseded_by: null,
      created_at: new Date(),
    } as Extraccion);
  }
}

function snapshotMapa() {
  return computeMapaIncertidumbre(state.extracciones, cajasApl, []);
}

function llenasPorGrupo(mapa: ReturnType<typeof computeMapaIncertidumbre>): Record<GrupoUI, number> {
  const out = {} as Record<GrupoUI, number>;
  for (const g of GrupoUISchema.options) out[g] = 0;
  for (const codigo of Object.keys(mapa.cajas)) {
    const s = mapa.cajas[codigo].status;
    if (s !== 'llena' && s !== 'no_aplica' && s !== 'declinada') continue;
    const c = cajasApl.find((x) => x.codigo === codigo);
    if (c) out[c.grupo_ui]++;
  }
  return out;
}

// ============================================================================
// Construcción de tools por turno (capturas locales + state global)
// ============================================================================
function buildTools(turnoId: string, captures: typeof state.perTurn[number]) {
  return {
    registrar_extraccion: tool({
      description: 'Registra extracciones de cajas con supersede chain.',
      inputSchema: RegistrarExtraccionInputSchema,
      execute: async (input) => {
        captures.registrar.push(input);
        aplicarExtracciones(input, turnoId);
        const mapa = snapshotMapa();
        return {
          ok: true,
          persisted: input.extracciones.length,
          supersedidos: input.extracciones.filter((e) =>
            state.extracciones.some(
              (x) => x.caja_codigo === e.caja_codigo && x.superseded_by !== null
            )
          ).length,
          errores: [],
          mapa_summary: {
            llenas_por_grupo: llenasPorGrupo(mapa),
            criticas_pct: mapa.cajas_criticas_pct,
            blandas_pct: mapa.cajas_blandas_pct,
            top_a_atacar: mapa.top_cajas_a_atacar,
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
  };
}

// ============================================================================
// Turn loop
// ============================================================================
const TURNS = [
  {
    label: 'Turno 1 · camino feliz (id + monto)',
    text: 'Somos SOFOM ENR con 12 años en operación, regulada por CNBV. Nuestro ticket mínimo es de 500 mil pesos.',
  },
  {
    label: 'Turno 2 · respuesta vaga (debe disparar follow-up)',
    text: 'Sobre buró somos flexibles, vemos cada caso individualmente.',
  },
  {
    label: 'Turno 3 · respuesta concreta (debe cerrar to_historial_credito)',
    text: 'A ver, concretando: aceptamos manchas en buró solo si son restructuras concluidas hace mínimo 6 meses, máximo 60 días de mora pasada, y nunca aceptamos mora abierta al momento de la solicitud.',
  },
] as const;

const messages: ModelMessage[] = [];

async function runTurn(turnNumber: number, label: string, userText: string) {
  console.log(`\n============================================`);
  console.log(` ${label}`);
  console.log(`============================================`);
  console.log(`Usuario: "${userText}"`);

  const turnoId = randomUUID();
  const captures = {
    turn: turnNumber,
    user: userText,
    registrar: [] as RegistrarExtraccionInput[],
    batch: [] as GenerarBatchPreguntasInput[],
    caso: [] as SolicitarCasoSinteticoInput[],
    review: [] as ReviewInput[],
    text: '',
    mapaAfter: snapshotMapa(),
    elapsedMs: 0,
  };

  messages.push({ role: 'user', content: userText });

  const t0 = Date.now();
  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SONNET_FASE1_SYSTEM_PROMPT,
    messages,
    tools: buildTools(turnoId, captures),
    stopWhen: stepCountIs(5),
  });

  const chunks: string[] = [];
  for await (const c of result.textStream) chunks.push(c);
  captures.text = chunks.join('');
  captures.elapsedMs = Date.now() - t0;
  captures.mapaAfter = snapshotMapa();

  const resp = await result.response;
  for (const m of resp.messages) messages.push(m);

  state.perTurn.push(captures);

  // Print
  const extr = captures.registrar.flatMap((c) => c.extracciones);
  console.log(`\n  tool calls: registrar=${captures.registrar.length}(${extr.length} extr)  batch=${captures.batch.length}  caso=${captures.caso.length}  review=${captures.review.length}  · ${(captures.elapsedMs / 1000).toFixed(1)}s`);
  for (const e of extr) {
    const ev = e.evidencia_textual.length > 70 ? e.evidencia_textual.slice(0, 67) + '...' : e.evidencia_textual;
    console.log(`  · ${e.caja_codigo.padEnd(28)} ${JSON.stringify(e.valor).padEnd(30)} conf=${e.confianza.toFixed(2)}  ev="${ev}"`);
  }
  if (captures.batch.length > 0) {
    console.log(`  siguiente batch:`);
    for (const b of captures.batch) {
      for (const p of b.preguntas) console.log(`    · "${p.texto}"  [→ ${p.cajas_objetivo.join(', ')}]`);
    }
  }
  if (captures.text.trim()) {
    console.log(`  texto agente: "${captures.text.trim()}"`);
  }
  console.log(`  mapa: críticas_pct=${(captures.mapaAfter.cajas_criticas_pct * 100).toFixed(0)}%  blandas_pct=${(captures.mapaAfter.cajas_blandas_pct * 100).toFixed(0)}%  top=[${captures.mapaAfter.top_cajas_a_atacar.slice(0, 5).join(', ')}]`);
}

// ============================================================================
// Aserciones helpers
// ============================================================================
let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, hint?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${hint !== undefined ? '\n      hint: ' + JSON.stringify(hint, null, 2).slice(0, 300) : ''}`);
    failed++;
  }
}

function extOf(turn: typeof state.perTurn[number], codigo: string) {
  return turn.registrar.flatMap((c) => c.extracciones).find((e) => e.caja_codigo === codigo);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log(`SESION_ID=${SESION_ID}  tipo=${TIPO}  cajas_aplicables=${cajasApl.length}`);

  for (let i = 0; i < TURNS.length; i++) {
    await runTurn(i + 1, TURNS[i].label, TURNS[i].text);
  }

  // ==========================================================================
  // Aserciones
  // ==========================================================================
  console.log('\n============================================');
  console.log(' Aserciones');
  console.log('============================================');

  const [T1, T2, T3] = state.perTurn;
  const allExtr = state.perTurn.flatMap((t) => t.registrar.flatMap((c) => c.extracciones));

  // -------------------- Turno 1 --------------------
  console.log('\n-- Turno 1 (camino feliz)');
  ok('T1-A · registrar_extraccion ≥ 1', T1.registrar.length >= 1);
  ok('T1-B · id_anios_operacion = 12 con conf ≥ 0.65', (() => {
    const x = extOf(T1, 'id_anios_operacion');
    return !!x && x.valor === 12 && x.confianza >= 0.65;
  })(), extOf(T1, 'id_anios_operacion'));
  ok('T1-C · ru_monto_min = 500000 con conf ≥ 0.80', (() => {
    const x = extOf(T1, 'ru_monto_min');
    return !!x && x.valor === 500000 && x.confianza >= 0.8;
  })(), extOf(T1, 'ru_monto_min'));
  ok('T1-D · status(id_anios_operacion) = llena tras T1', T1.mapaAfter.cajas['id_anios_operacion']?.status === 'llena');
  ok('T1-E · status(ru_monto_min) = llena tras T1', T1.mapaAfter.cajas['ru_monto_min']?.status === 'llena');
  ok('T1-F · siguiente batch existe', T1.batch.length >= 1);
  ok('T1-G · batch no repite cajas ya llenas', (() => {
    const llenas = new Set(
      Object.keys(T1.mapaAfter.cajas).filter((k) => T1.mapaAfter.cajas[k].status === 'llena')
    );
    const objs = T1.batch.flatMap((b) => b.preguntas.flatMap((p) => p.cajas_objetivo));
    return objs.every((c) => !llenas.has(c));
  })());

  // -------------------- Turno 2 --------------------
  console.log('\n-- Turno 2 (vaga → debe pedir más)');
  const t2HistExt = extOf(T2, 'to_historial_credito');
  ok(
    'T2-A · si extrajo to_historial_credito, confianza < 0.80 (no debería cerrar crítica con respuesta vaga)',
    !t2HistExt || t2HistExt.confianza < 0.8,
    t2HistExt
  );
  ok(
    'T2-B · status(to_historial_credito) ≠ llena tras T2',
    T2.mapaAfter.cajas['to_historial_credito']?.status !== 'llena',
    T2.mapaAfter.cajas['to_historial_credito']
  );
  ok('T2-C · to_historial_credito sigue en top_a_atacar tras T2', T2.mapaAfter.top_cajas_a_atacar.includes('to_historial_credito') || (() => {
    // Aceptable si está parcial pero no en top (otras críticas vacías priorizan)
    const s = T2.mapaAfter.cajas['to_historial_credito']?.status;
    return s === 'parcial' || s === 'vacia';
  })());
  ok(
    'T2-D · Sonnet emite tool call (registrar o batch o caso) para profundizar',
    T2.registrar.length + T2.batch.length + T2.caso.length > 0
  );
  if (T2.batch.length > 0) {
    const targets = T2.batch.flatMap((b) => b.preguntas.flatMap((p) => p.cajas_objetivo));
    ok(
      'T2-E · batch T2 toca to_historial_credito o caja crítica adyacente',
      targets.includes('to_historial_credito') ||
        targets.some((c) => cajasApl.find((x) => x.codigo === c)?.criticidad === 'critica'),
      targets
    );
  }

  // -------------------- Turno 3 --------------------
  console.log('\n-- Turno 3 (concreta → debe cerrar to_historial_credito)');
  const t3HistExt = extOf(T3, 'to_historial_credito');
  ok('T3-A · to_historial_credito fue extraída', !!t3HistExt, t3HistExt);
  if (t3HistExt) {
    ok('T3-B · confianza ≥ 0.80 (crítica)', t3HistExt.confianza >= 0.8, t3HistExt.confianza);
    ok('T3-C · valor es string no vacío (tolerancia texto)', typeof t3HistExt.valor === 'string' && (t3HistExt.valor as string).length > 10, t3HistExt.valor);
    ok(
      'T3-D · evidencia textual cita términos del usuario (mora, restructura o buró)',
      /restructura|mora|buró/i.test(t3HistExt.evidencia_textual),
      t3HistExt.evidencia_textual
    );
  }
  ok('T3-E · status(to_historial_credito) = llena tras T3', T3.mapaAfter.cajas['to_historial_credito']?.status === 'llena');
  ok('T3-F · supersede chain activado si T2 también extrajo', (() => {
    const activas = state.extracciones.filter(
      (e) => e.caja_codigo === 'to_historial_credito' && !e.superseded_by
    );
    return activas.length === 1; // exactamente una activa (no contradictoria)
  })());

  // -------------------- Globales --------------------
  console.log('\n-- Globales (3 turnos)');
  ok('G1 · sin cajas alucinadas (todos los codigos en canon)', allExtr.every((e) => cajasAplSet.has(e.caja_codigo)));
  ok('G2 · toda extracción tiene evidencia textual', allExtr.every((e) => typeof e.evidencia_textual === 'string' && e.evidencia_textual.trim().length > 0));
  ok('G3 · evidencias son substrings reales del mensaje del turno respectivo', (() => {
    for (const turn of state.perTurn) {
      const userText = turn.user;
      for (const e of turn.registrar.flatMap((c) => c.extracciones)) {
        // Evidencia puede ser fragmentos con "..." per system prompt. Verificar que
        // los fragmentos individuales sean substrings.
        const partes = e.evidencia_textual.split('...').map((p) => p.trim()).filter(Boolean);
        for (const p of partes) {
          if (!userText.toLowerCase().includes(p.toLowerCase())) {
            console.log(`      fragmento NO encontrado en mensaje: "${p}" (caja ${e.caja_codigo})`);
            return false;
          }
        }
      }
    }
    return true;
  })());
  ok('G4 · ninguna pregunta del batch N idéntica a una del batch N-1', (() => {
    for (let i = 1; i < state.perTurn.length; i++) {
      const prev = new Set(state.perTurn[i - 1].batch.flatMap((b) => b.preguntas.map((p) => p.texto)));
      const curr = state.perTurn[i].batch.flatMap((b) => b.preguntas.map((p) => p.texto));
      for (const q of curr) if (prev.has(q)) return false;
    }
    return true;
  })());
  ok('G5 · confianza_global aumenta turno a turno (1→2→3)', (() => {
    const g1 = state.perTurn[0].mapaAfter.confianza_global;
    const g2 = state.perTurn[1].mapaAfter.confianza_global;
    const g3 = state.perTurn[2].mapaAfter.confianza_global;
    return g1 <= g2 && g2 <= g3;
  })());

  console.log('\n============================================');
  console.log(` ${passed}/${passed + failed} aserciones ✓${failed ? ` — ${failed} fallos ✗` : ''}`);
  console.log('============================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[smoke e2e] error fatal:', err);
  process.exit(1);
});
