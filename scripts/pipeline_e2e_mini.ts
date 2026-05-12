// Mini pipeline E2E — un solo script que prueba TODO el pipeline core de Vertice
// con LLM real y DB real, minimizando consumo de tokens.
//
// Cobertura:
//   ✓ Setup contra DATABASE_URL_TEST (Neon branch test)
//   ✓ Turn loop real Sonnet 4.6 sobre grupo `identificacion` (~2 turnos)
//   ✓ Persistencia real: turnos_conversacion + extracciones + supersede chain
//   ✓ Handoff Sonnet → Opus director real (processSolicitarReview con generateObject)
//   ✓ Síntesis final real Opus 4.7 + extended thinking 8K (procesarSintesisFinal)
//   ✓ PDF render real (generarPdfSintesis)
//   ✓ Cleanup TRUNCATE
//
// Tiempo estimado: 5-8 min. Costo: ~$0.18.
//
// Invocar:  npx tsx scripts/pipeline_e2e_mini.ts

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });

// CRITICAL: override DATABASE_URL antes de cualquier dynamic import que dependa
// de @/lib/db. Apuntamos al branch de test de Neon — no contaminamos producción.
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error('DATABASE_URL_TEST no está en .env.local — abortar.');
  process.exit(1);
}
process.env.DATABASE_URL = testUrl;

// ============================================================================
// Aserciones helper
// ============================================================================
let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, hint?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    const h = hint !== undefined ? '\n      hint: ' + JSON.stringify(hint, null, 2).slice(0, 400) : '';
    console.log(`  ✗ ${name}${h}`);
    failures.push(name);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(60)}\n ${title}\n${'='.repeat(60)}`);
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  // Dynamic imports DESPUÉS del override de DATABASE_URL.
  const { sql, eq, isNull, and, desc } = await import('drizzle-orm');
  const aiMod = await import('ai');
  const { streamText, tool, stepCountIs } = aiMod;
  type ModelMessage = Parameters<typeof aiMod.streamText>[0] extends { messages?: infer M } ? (M extends Array<infer U> ? U : never) : never;
  const { anthropic } = await import('@ai-sdk/anthropic');

  const { createTestDb, resetReviewTables, seedSesion } = await import('../lib/motor/test-db');
  const {
    RegistrarExtraccionInputSchema,
    GenerarBatchPreguntasInputSchema,
    SolicitarCasoSinteticoInputSchema,
  } = await import('../lib/motor/tools');
  const { SolicitarReviewSeccionInputSchema } = await import('../lib/schemas/review_seccion');
  const { SONNET_FASE1_SYSTEM_PROMPT } = await import('../lib/prompts/sonnet_fase1');
  const { getCajasAplicables, getCajaAny } = await import('../lib/schemas/cajas');
  const { valorSchemaFor } = await import('../lib/schemas/extracciones');
  const {
    persistirTurnoUsuario,
    persistirTurnoAgente,
    actualizarContenidoTurnoAgente,
    persistirExtraccionesBatch,
    listarExtraccionesActivas,
    listarCajasDeclinadas,
  } = await import('../lib/motor/persistence');
  const { computeMapaIncertidumbre } = await import('../lib/motor/mapa');
  const {
    processSolicitarReview,
    transicionarSesionASintetizando,
  } = await import('../lib/motor/review');
  const { procesarSintesisFinal } = await import('../lib/motor/sintesis_final');
  const dbSchema = await import('../db/schema');
  const { generarPdfSintesis } = await import('../lib/motor/sintesis_pdf');

  // -------------------------------------------------------------------------
  // Fase 0 · Setup DB
  // -------------------------------------------------------------------------
  section('Fase 0 · Setup DB');
  const { db: testDb, client } = createTestDb();
  console.log(`  DB    : ${testUrl.replace(/:[^:@]+@/, ':***@')}`);

  await resetReviewTables(testDb);
  console.log('  reset : TRUNCATE de tablas review/extracciones/turnos OK');

  const { institucion_id, sesion_id } = await seedSesion(testDb, { tipo: 'sofom_enr' });
  // sofom_enr: 49 CANON + 5 cs_* extension = 54
  await testDb.execute(sql`UPDATE sesiones SET cajas_aplicables = 54 WHERE id = ${sesion_id}::uuid`);
  console.log(`  seed  : institucion_id=${institucion_id.slice(0, 8)}… sesion_id=${sesion_id.slice(0, 8)}…`);

  const tipo = 'sofom_enr' as const;
  const cajasApl = getCajasAplicables(tipo);
  const cajasAplSet = new Set(cajasApl.map((c) => c.codigo));

  // -------------------------------------------------------------------------
  // Fase A · 2 turnos conversacionales reales con Sonnet 4.6 sobre `identificacion`
  // -------------------------------------------------------------------------
  section('Fase A · Sonnet 4.6 real × 2 turnos (grupo identificacion)');

  const TURNS = [
    'Buenos días. Somos Vértice Financiero, S.A. de C.V., SOFOM ENR — nombre comercial Vértice Capital — con 7 años en operación, regulados por CNBV y CONDUSEF.',
    'Ok, eso cubre identificación. ¿Podemos cerrar este bloque y avanzar al siguiente?',
  ];
  const messages: ModelMessage[] = [];
  const capturasPorTurno: Array<{
    registrar: number;
    batch: number;
    review: number;
    text: string;
    elapsedMs: number;
    reviewResult?: unknown;
  }> = [];

  for (let i = 0; i < TURNS.length; i++) {
    const userMsg = TURNS[i];
    console.log(`\n  T${i + 1} usuario: "${userMsg}"`);

    const userTurn = await persistirTurnoUsuario({
      sesion_id,
      contenido_texto: userMsg,
      fuente: 'usuario_tipea',
    });
    const agentTurn = await persistirTurnoAgente({
      sesion_id,
      contenido_texto: '',
      fuente: 'sonnet_genera',
      modelo_llm: 'claude-sonnet-4-6',
    });

    messages.push({ role: 'user', content: userMsg });
    const captures = { registrar: 0, batch: 0, review: 0, text: '', elapsedMs: 0, reviewResult: undefined as unknown };

    const t0 = Date.now();
    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: SONNET_FASE1_SYSTEM_PROMPT,
      messages,
      tools: {
        registrar_extraccion: tool({
          description: 'Registra extracciones de cajas con supersede chain.',
          inputSchema: RegistrarExtraccionInputSchema,
          execute: async (input) => {
            captures.registrar++;
            const validas: Array<{ caja_codigo: string; valor: unknown; confianza: number; evidencia_textual: string }> = [];
            const errores: Array<{ indice: number; caja_codigo: string; error: string }> = [];
            for (let j = 0; j < input.extracciones.length; j++) {
              const e = input.extracciones[j];
              const p = valorSchemaFor(e.caja_codigo).safeParse(e.valor);
              if (!p.success) {
                errores.push({ indice: j, caja_codigo: e.caja_codigo, error: p.error.message });
                continue;
              }
              validas.push({
                caja_codigo: e.caja_codigo,
                valor: e.valor,
                confianza: e.confianza,
                evidencia_textual: e.evidencia_textual,
              });
            }
            if (validas.length === 0) {
              return { ok: false, persisted: 0, supersedidos: 0, errores };
            }
            const persistidas = await persistirExtraccionesBatch({
              sesion_id,
              turno_id: agentTurn.turno_id,
              extracciones: validas,
            });
            const supersedidos = persistidas.filter((p) => p.supersedido_id !== undefined).length;
            const [activas, declinadas] = await Promise.all([
              listarExtraccionesActivas(sesion_id),
              listarCajasDeclinadas(sesion_id),
            ]);
            const mapa = computeMapaIncertidumbre(activas, cajasApl, declinadas);
            return {
              ok: true,
              persisted: persistidas.length,
              supersedidos,
              errores,
              mapa_summary: {
                criticas_pct: mapa.cajas_criticas_pct,
                blandas_pct: mapa.cajas_blandas_pct,
                top_a_atacar: mapa.top_cajas_a_atacar,
              },
            };
          },
        }),
        generar_batch_preguntas: tool({
          description: 'Genera el siguiente batch.',
          inputSchema: GenerarBatchPreguntasInputSchema,
          execute: async () => {
            captures.batch++;
            return { ok: true };
          },
        }),
        solicitar_caso_sintetico: tool({
          description: 'Solicita caso sintético.',
          inputSchema: SolicitarCasoSinteticoInputSchema,
          execute: async () => ({ ok: false, reason: 'no_disponible_en_mini' }),
        }),
        solicitar_review_seccion: tool({
          description: 'Solicita review Opus director sobre el grupo_ui.',
          inputSchema: SolicitarReviewSeccionInputSchema,
          execute: async (input) => {
            captures.review++;
            console.log(`    → Sonnet emitió solicitar_review_seccion para grupo=${input.grupo_ui_codigo}`);
            // INVOCA Opus director REAL via processSolicitarReview
            const res = await processSolicitarReview(input, { sesion_id });
            captures.reviewResult = res;
            console.log(`    ← Opus director decidió: estado=${res.estado}  siguiente=${res.siguiente_grupo_ui ?? 'n/a'}`);
            return { ok: true, ...res };
          },
        }),
      },
      stopWhen: stepCountIs(6),
    });

    const chunks: string[] = [];
    for await (const c of result.textStream) chunks.push(c);
    captures.text = chunks.join('');
    captures.elapsedMs = Date.now() - t0;

    await actualizarContenidoTurnoAgente({
      turno_id: agentTurn.turno_id,
      contenido_texto: captures.text,
    });

    const resp = await result.response;
    for (const m of resp.messages) messages.push(m);

    capturasPorTurno.push(captures);
    console.log(`    tool calls: registrar=${captures.registrar} batch=${captures.batch} review=${captures.review}  ·  ${(captures.elapsedMs / 1000).toFixed(1)}s`);
    if (captures.text.trim()) console.log(`    agente: "${captures.text.trim().slice(0, 200)}${captures.text.length > 200 ? '…' : ''}"`);
  }

  // Estado tras Fase A
  const extraccionesActivas = await listarExtraccionesActivas(sesion_id);
  const mapaPostA = computeMapaIncertidumbre(extraccionesActivas, cajasApl, await listarCajasDeclinadas(sesion_id));
  console.log(`\n  Tras Fase A: ${extraccionesActivas.length} extracciones activas`);
  console.log(`  Cajas de identificación:`);
  for (const c of cajasApl.filter((x) => x.grupo_ui === 'identificacion')) {
    const s = mapaPostA.cajas[c.codigo];
    console.log(`    · ${c.codigo.padEnd(22)} ${s.status.padEnd(13)} conf=${s.confianza.toFixed(2)}`);
  }

  // -------------------------------------------------------------------------
  // Aserciones Fase A
  // -------------------------------------------------------------------------
  section('Aserciones Fase A · turn loop + persistencia + handoff');
  ok('A1 · Sonnet llamó registrar_extraccion al menos 1 vez', capturasPorTurno.some((c) => c.registrar > 0));
  ok('A2 · Hay extracciones persistidas en DB real', extraccionesActivas.length > 0);
  ok('A3 · id_tipo_institucion = "sofom_enr" en DB', (() => {
    const x = extraccionesActivas.find((e) => e.caja_codigo === 'id_tipo_institucion');
    return !!x && x.valor === 'sofom_enr';
  })());
  ok('A4 · id_regulacion contiene cnbv en DB', (() => {
    const x = extraccionesActivas.find((e) => e.caja_codigo === 'id_regulacion');
    return !!x && Array.isArray(x.valor) && (x.valor as string[]).includes('cnbv');
  })());
  ok('A5 · Todos los caja_codigo persistidos están en canon', extraccionesActivas.every((e) => cajasAplSet.has(e.caja_codigo)));

  // ¿Sonnet emitió solicitar_review_seccion en alguno de los 2 turnos?
  const reviewEjecutado = capturasPorTurno.some((c) => c.review > 0);

  // Si NO lo emitió, lo forzamos manualmente con un input construido desde DB.
  if (!reviewEjecutado) {
    console.log('\n  ⚠ Sonnet no emitió solicitar_review_seccion espontáneamente. Forzando handoff manual con snapshot real.');

    const idCajas = cajasApl.filter((c) => c.grupo_ui === 'identificacion');
    const snapshot = idCajas
      .map((c) => {
        const ext = extraccionesActivas.find((e) => e.caja_codigo === c.codigo);
        if (!ext) return null;
        const state = mapaPostA.cajas[c.codigo];
        return {
          caja_codigo: c.codigo,
          valor: ext.valor,
          confianza: ext.confianza,
          evidencia_textual: ext.evidencia_textual ?? 'no disponible',
          status: state.status as 'llena' | 'parcial' | 'vacia' | 'no_aplica' | 'contradictoria',
          version: 1 as number,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const cajasNoClausuradas = idCajas
      .filter((c) => mapaPostA.cajas[c.codigo].status !== 'llena' && mapaPostA.cajas[c.codigo].status !== 'no_aplica')
      .map((c) => ({
        caja_codigo: c.codigo,
        razon: 'evidencia_debil' as const,
        detalle: 'no extraída tras 2 turnos en el grupo identificación',
        turnos_intentados: 2,
      }));

    const review = await processSolicitarReview(
      {
        grupo_ui_codigo: 'identificacion',
        extracciones_snapshot: snapshot,
        cajas_no_clausuradas: cajasNoClausuradas,
        hipotesis_sonnet: 'SOFOM ENR con perfil conservador y track record sólido de 7 años bajo regulación CNBV-CONDUSEF',
        turno_disparador: 4,
      },
      { sesion_id }
    );
    capturasPorTurno[capturasPorTurno.length - 1].reviewResult = review;
    console.log(`    ← Opus director (forzado): estado=${review.estado}  siguiente=${review.siguiente_grupo_ui ?? 'n/a'}`);
  }

  // Verificación handoff con DB
  const [reviewRow] = await testDb
    .select()
    .from(dbSchema.reviews_seccion)
    .where(eq(dbSchema.reviews_seccion.sesion_id, sesion_id))
    .orderBy(desc(dbSchema.reviews_seccion.created_at))
    .limit(1);
  ok('A6 · Review row insertada en reviews_seccion', !!reviewRow);
  ok('A7 · review.decision_opus está poblada (no null)', !!reviewRow && reviewRow.decision_opus !== null);
  ok('A8 · review.grupo_ui_codigo = identificacion', !!reviewRow && reviewRow.grupo_ui_codigo === 'identificacion');
  ok('A9 · decision_opus es valor válido (avanzar | profundizar | caso_sintetico)', (() => {
    if (!reviewRow) return false;
    return ['avanzar', 'profundizar', 'caso_sintetico'].includes(reviewRow.decision_opus as string);
  })(), reviewRow?.decision_opus);

  // -------------------------------------------------------------------------
  // Fase B · Pre-seed cajas faltantes para que síntesis tenga material real
  // -------------------------------------------------------------------------
  section('Fase B · Seed cajas restantes (manual via persistirExtraccionesBatch)');
  // Tomamos 1 turno extra para anclar las extracciones manuales.
  const seedAgentTurn = await persistirTurnoAgente({
    sesion_id,
    contenido_texto: '[seed e2e mini]',
    fuente: 'sonnet_genera',
    modelo_llm: 'claude-sonnet-4-6',
  });

  // Datos mock plausibles para sofom_enr — cubre las críticas no llenadas por Sonnet
  // para que el mapa tenga >50% de completitud y la síntesis sea realista.
  const seedExtracciones = [
    // productos_y_mercado (algunas críticas)
    { caja_codigo: 'nm_productos_ofrecidos', valor: ['credito_simple', 'capital_trabajo', 'factoraje'], confianza: 0.92, evidencia_textual: '[seed] cartera enfocada a PME' },
    { caja_codigo: 'nm_sectores_aceptados', valor: ['manufactura', 'comercio_mayorista', 'logistica'], confianza: 0.88, evidencia_textual: '[seed] sectores foco' },
    { caja_codigo: 'nm_sectores_excluidos', valor: ['casinos', 'armas', 'cannabis'], confianza: 0.95, evidencia_textual: '[seed] exclusiones compliance' },
    { caja_codigo: 'nm_cobertura_geografica', valor: ['cdmx_y_metro', 'bajio', 'monterrey_y_metro'], confianza: 0.9, evidencia_textual: '[seed] 3 zonas principales' },
    { caja_codigo: 'nm_tipos_cliente', valor: ['pm', 'pfae'], confianza: 0.93, evidencia_textual: '[seed] PM y PFAE' },
    // numeros_del_negocio
    { caja_codigo: 'ru_monto_min', valor: 500000, confianza: 0.95, evidencia_textual: '[seed] ticket mínimo 500k' },
    { caja_codigo: 'ru_monto_max', valor: 25000000, confianza: 0.92, evidencia_textual: '[seed] tope 25 mdp' },
    { caja_codigo: 'ru_moneda', valor: 'mxn', confianza: 0.99, evidencia_textual: '[seed] solo MXN' },
    { caja_codigo: 'ru_antiguedad_min', valor: 2, confianza: 0.88, evidencia_textual: '[seed] 2 años mínimo' },
    { caja_codigo: 'ru_facturacion_min', valor: 12000000, confianza: 0.85, evidencia_textual: '[seed] 12 mdp facturación' },
    { caja_codigo: 'ru_score_pm_min', valor: 600, confianza: 0.7, evidencia_textual: '[seed] score PM 600 mínimo' },
    { caja_codigo: 'ru_score_pf_min', valor: 680, confianza: 0.85, evidencia_textual: '[seed] score PF 680+' },
    { caja_codigo: 'gr_tipos_garantia', valor: ['hipotecaria', 'fiduciaria', 'aval_personal'], confianza: 0.86, evidencia_textual: '[seed] 3 tipos aceptados' },
    { caja_codigo: 'gr_cobertura_min', valor: 1.4, confianza: 0.84, evidencia_textual: '[seed] LTV 1.4x' },
    { caja_codigo: 'gr_dscr_min', valor: 1.15, confianza: 0.82, evidencia_textual: '[seed] DSCR mín 1.15' },
    { caja_codigo: 'gr_deuda_ebitda_max', valor: 4, confianza: 0.8, evidencia_textual: '[seed] D/E max 4x' },
    { caja_codigo: 'gr_ratios_definitorios', valor: 'DSCR + cobertura + apalancamiento', confianza: 0.84, evidencia_textual: '[seed] 3 ratios definitorios' },
    // operacion
    { caja_codigo: 'op_tiempo_viabilidad', valor: '48-72 horas', confianza: 0.9, evidencia_textual: '[seed] viabilidad rápida' },
    { caja_codigo: 'op_tiempo_comite', valor: '2-3 semanas', confianza: 0.86, evidencia_textual: '[seed] comité quincenal' },
    { caja_codigo: 'op_tiempo_fondeo', valor: '5-7 días hábiles tras firma', confianza: 0.88, evidencia_textual: '[seed] fondeo ágil' },
    { caja_codigo: 'op_frecuencia_comite', valor: 'quincenal', confianza: 0.95, evidencia_textual: '[seed] comité quincenal' },
    { caja_codigo: 'op_documentacion_estandar', valor: 'EEFF, declaraciones, KYC, garantía evaluada', confianza: 0.9, evidencia_textual: '[seed] doc estándar' },
    // pricing_y_criterio
    { caja_codigo: 'to_historial_credito', valor: 'Restructuras concluidas hace ≥6 meses OK. Mora pasada ≤60 días aceptable. Mora abierta es rechazo automático.', confianza: 0.9, evidencia_textual: '[seed] postura histórico' },
    { caja_codigo: 'to_ratios_financieros', valor: 'Tolerantes a un trimestre de EBITDA negativo si hay justificación operativa. DSCR < 1.0 es no.', confianza: 0.85, evidencia_textual: '[seed] postura ratios' },
    { caja_codigo: 'pc_reglas_pricing', valor: 'Tasa sube con riesgo sector/antigüedad; baja con garantía hipotecaria y track previo con la institución.', confianza: 0.82, evidencia_textual: '[seed] pricing factors' },
    { caja_codigo: 'se_sin_historial', valor: { respuesta: 'condicional', condiciones: 'requiere aval con buró sólido' }, confianza: 0.86, evidencia_textual: '[seed] sin historial OK con aval' },
    { caja_codigo: 'se_sat_32d_negativa', valor: { respuesta: 'no' }, confianza: 0.92, evidencia_textual: '[seed] 32-D negativa = no' },
    { caja_codigo: 'se_pep_estructura', valor: { respuesta: 'condicional', condiciones: 'declaración + due diligence reforzada' }, confianza: 0.85, evidencia_textual: '[seed] PEP requiere DD' },
    // contacto
    { caja_codigo: 'co_punto_contacto', valor: 'Director de Crédito · Lic. Patricia Robles', confianza: 0.94, evidencia_textual: '[seed] contacto único' },
    { caja_codigo: 'co_email_telefono', valor: { email: 'credito@verticefinanciero.mx', telefono: '+525512345678' }, confianza: 0.95, evidencia_textual: '[seed] datos contacto' },
  ];

  const seeded = await persistirExtraccionesBatch({
    sesion_id,
    turno_id: seedAgentTurn.turno_id,
    extracciones: seedExtracciones,
  });
  console.log(`  ${seeded.length} extracciones seedeadas para llenar el material de síntesis`);

  const extraccionesFinales = await listarExtraccionesActivas(sesion_id);
  const mapaFinal = computeMapaIncertidumbre(extraccionesFinales, cajasApl, await listarCajasDeclinadas(sesion_id));
  console.log(`  Material total: ${extraccionesFinales.length} cajas activas / ${cajasApl.length} aplicables`);
  console.log(`  Críticas: ${(mapaFinal.cajas_criticas_pct * 100).toFixed(0)}%  Blandas: ${(mapaFinal.cajas_blandas_pct * 100).toFixed(0)}%  Global: ${(mapaFinal.confianza_global * 100).toFixed(0)}%`);

  // -------------------------------------------------------------------------
  // Fase C · Síntesis final con Opus 4.7 real + extended thinking 8K
  // -------------------------------------------------------------------------
  section('Fase C · Síntesis final · Opus 4.7 + extended thinking 8K');
  const transicionado = await transicionarSesionASintetizando(sesion_id);
  ok('C1 · sesión transicionada a status=sintetizando', transicionado);

  console.log('  Invocando procesarSintesisFinal(sesion_id)… (puede tardar 60-180s)');
  const t0 = Date.now();
  let sintesisResult;
  try {
    sintesisResult = await procesarSintesisFinal(sesion_id);
  } catch (err) {
    console.error('  ✗ Síntesis final falló:', err instanceof Error ? err.message : err);
    throw err;
  }
  const sintesisElapsed = Date.now() - t0;
  console.log(`  Síntesis OK en ${(sintesisElapsed / 1000).toFixed(1)}s · perfil_id=${sintesisResult.perfil_id.slice(0, 8)}… version=${sintesisResult.version}`);

  ok('C2 · sintesisResult.perfil_id presente', !!sintesisResult.perfil_id);
  ok('C3 · status_transition = completa', sintesisResult.status_transition === 'completa');
  ok('C4 · perfil tiene schema_version="1.0"', sintesisResult.perfil.schema_version === '1.0');
  ok('C5 · perfil.institucion.tipo = sofom_enr', sintesisResult.perfil.institucion.tipo === 'sofom_enr');
  ok('C6 · perfil.metricas.completitud entre 0 y 1', (() => {
    const c = sintesisResult.perfil.metricas.completitud;
    return c >= 0 && c <= 1;
  })());
  ok('C7 · perfil.cajas tiene ≥ 25 entradas (material real fue ≥25)', Object.keys(sintesisResult.perfil.cajas).length >= 25, Object.keys(sintesisResult.perfil.cajas).length);
  ok('C8 · perfil.resumen_ejecutivo ≥ 200 chars', sintesisResult.perfil.resumen_ejecutivo.length >= 200);

  const [perfilRow] = await testDb
    .select()
    .from(dbSchema.perfil_decision_final)
    .where(eq(dbSchema.perfil_decision_final.sesion_id, sesion_id))
    .limit(1);
  ok('C9 · perfil persistido en perfil_decision_final', !!perfilRow);

  const [sesionRowFinal] = await testDb
    .select()
    .from(dbSchema.sesiones)
    .where(eq(dbSchema.sesiones.id, sesion_id))
    .limit(1);
  ok('C10 · sesion.status = completa', !!sesionRowFinal && sesionRowFinal.status === 'completa');

  // -------------------------------------------------------------------------
  // Fase D · PDF render
  // -------------------------------------------------------------------------
  section('Fase D · PDF render desde perfil real');
  const pdfOut = path.resolve(process.cwd(), 'tmp', 'pipeline-e2e.pdf');
  mkdirSync(path.dirname(pdfOut), { recursive: true });

  try {
    const pdf = await generarPdfSintesis(sintesisResult.perfil);
    writeFileSync(pdfOut, pdf.buffer);
    console.log(`  PDF generado: ${pdfOut} (${pdf.bytes.toLocaleString('en-US')} bytes)`);
    ok('D1 · PDF buffer > 10 KB', pdf.bytes > 10_000);
    ok('D2 · PDF archivo escrito en disco', true);
  } catch (err) {
    console.log(`  ⚠ PDF render falló (puppeteer/chromium puede no estar disponible): ${err instanceof Error ? err.message : err}`);
    ok('D1 · PDF buffer > 10 KB', false, err instanceof Error ? err.message : err);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  section('Cleanup · TRUNCATE de tablas afectadas');
  await resetReviewTables(testDb);
  console.log('  TRUNCATE OK');
  await client.end();

  // -------------------------------------------------------------------------
  // Resumen
  // -------------------------------------------------------------------------
  section(`Resumen · ${passed}/${passed + failed} aserciones ✓${failed ? ` — ${failed} fallos ✗` : ''}`);
  if (failed > 0) {
    console.log('\nFallos:');
    for (const f of failures) console.log(`  · ${f}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[pipeline e2e] error fatal:', err);
  process.exit(1);
});
