// Test aislado de la síntesis final — sin Sonnet, sin Opus director.
// Solo seedea 35+ cajas via persistirExtraccionesBatch y dispara procesarSintesisFinal.
// Sirve para iterar barato sobre el bug C7 (Opus emite cajas={} en vez de
// expandir las 54 entradas). Cost: ~$0.05/run (1 call Opus 4.7).
//
// Invocar:  npx tsx scripts/test_sintesis_solo.ts
//           VERTICE_DEBUG_SINTESIS=1 npx tsx scripts/test_sintesis_solo.ts

import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error('DATABASE_URL_TEST no está en .env.local');
  process.exit(1);
}
process.env.DATABASE_URL = testUrl;

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, hint?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    const h = hint !== undefined ? '\n      hint: ' + JSON.stringify(hint, null, 2).slice(0, 500) : '';
    console.log(`  ✗ ${name}${h}`);
    failed++;
  }
}

async function main() {
  const { sql, eq } = await import('drizzle-orm');
  const { createTestDb, resetReviewTables, seedSesion } = await import('../lib/motor/test-db');
  const { persistirTurnoAgente, persistirExtraccionesBatch, listarExtraccionesActivas } =
    await import('../lib/motor/persistence');
  const { computeMapaIncertidumbre } = await import('../lib/motor/mapa');
  const { getCajasAplicables } = await import('../lib/schemas/cajas');
  const { transicionarSesionASintetizando } = await import('../lib/motor/review');
  const { procesarSintesisFinal } = await import('../lib/motor/sintesis_final');
  const dbSchema = await import('../db/schema');

  console.log('============================================================');
  console.log(' Test aislado · Síntesis Opus 4.7 con effort=xhigh');
  console.log('============================================================');

  const { db: testDb, client } = createTestDb();
  await resetReviewTables(testDb);

  const { institucion_id, sesion_id } = await seedSesion(testDb, { tipo: 'sofom_enr' });
  await testDb.execute(sql`UPDATE sesiones SET cajas_aplicables = 54 WHERE id = ${sesion_id}::uuid`);
  console.log(`  sesion_id=${sesion_id.slice(0, 8)}…  tipo=sofom_enr  cajas_aplicables=54`);

  const turno = await persistirTurnoAgente({
    sesion_id,
    contenido_texto: '[seed]',
    fuente: 'sonnet_genera',
    modelo_llm: 'claude-sonnet-4-6',
  });

  // Reuso del seed del pipeline E2E completo (5 identidad + 30 extras = 35).
  const extracciones = [
    // identificacion
    { caja_codigo: 'id_razon_social', valor: 'Vértice Financiero, S.A. de C.V., SOFOM ENR', confianza: 0.97, evidencia_textual: '[seed] razón social' },
    { caja_codigo: 'id_nombre_comercial', valor: 'Vértice Capital', confianza: 0.97, evidencia_textual: '[seed] comercial' },
    { caja_codigo: 'id_tipo_institucion', valor: 'sofom_enr', confianza: 0.97, evidencia_textual: '[seed] tipo' },
    { caja_codigo: 'id_regulacion', valor: ['cnbv', 'condusef'], confianza: 0.95, evidencia_textual: '[seed] regulación' },
    { caja_codigo: 'id_anios_operacion', valor: 7, confianza: 0.97, evidencia_textual: '[seed] 7 años' },
    // productos_y_mercado
    { caja_codigo: 'nm_productos_ofrecidos', valor: ['credito_simple', 'capital_trabajo', 'factoraje'], confianza: 0.92, evidencia_textual: '[seed] cartera enfocada a PME' },
    { caja_codigo: 'nm_sectores_aceptados', valor: ['manufactura', 'comercio_mayorista', 'logistica'], confianza: 0.88, evidencia_textual: '[seed] sectores foco' },
    { caja_codigo: 'nm_sectores_excluidos', valor: ['casinos', 'armas', 'cannabis'], confianza: 0.95, evidencia_textual: '[seed] exclusiones compliance' },
    { caja_codigo: 'nm_cobertura_geografica', valor: ['cdmx_y_metro', 'bajio', 'monterrey_y_metro'], confianza: 0.9, evidencia_textual: '[seed] 3 zonas' },
    { caja_codigo: 'nm_tipos_cliente', valor: ['pm', 'pfae'], confianza: 0.93, evidencia_textual: '[seed] PM y PFAE' },
    // numeros_del_negocio
    { caja_codigo: 'ru_monto_min', valor: 500000, confianza: 0.95, evidencia_textual: '[seed] mínimo 500k' },
    { caja_codigo: 'ru_monto_max', valor: 25000000, confianza: 0.92, evidencia_textual: '[seed] tope 25 mdp' },
    { caja_codigo: 'ru_moneda', valor: 'mxn', confianza: 0.99, evidencia_textual: '[seed] solo MXN' },
    { caja_codigo: 'ru_antiguedad_min', valor: 2, confianza: 0.88, evidencia_textual: '[seed] 2 años' },
    { caja_codigo: 'ru_facturacion_min', valor: 12000000, confianza: 0.85, evidencia_textual: '[seed] 12 mdp' },
    { caja_codigo: 'ru_score_pm_min', valor: 600, confianza: 0.7, evidencia_textual: '[seed] score PM 600' },
    { caja_codigo: 'ru_score_pf_min', valor: 680, confianza: 0.85, evidencia_textual: '[seed] score PF 680' },
    { caja_codigo: 'gr_tipos_garantia', valor: ['hipotecaria', 'fiduciaria', 'aval_personal'], confianza: 0.86, evidencia_textual: '[seed] 3 tipos' },
    { caja_codigo: 'gr_cobertura_min', valor: 1.4, confianza: 0.84, evidencia_textual: '[seed] LTV 1.4x' },
    { caja_codigo: 'gr_dscr_min', valor: 1.15, confianza: 0.82, evidencia_textual: '[seed] DSCR mín 1.15' },
    { caja_codigo: 'gr_deuda_ebitda_max', valor: 4, confianza: 0.8, evidencia_textual: '[seed] D/E max 4x' },
    { caja_codigo: 'gr_ratios_definitorios', valor: 'DSCR + cobertura + apalancamiento', confianza: 0.84, evidencia_textual: '[seed] 3 ratios' },
    // operacion
    { caja_codigo: 'op_tiempo_viabilidad', valor: '48-72 horas', confianza: 0.9, evidencia_textual: '[seed] viabilidad rápida' },
    { caja_codigo: 'op_tiempo_comite', valor: '2-3 semanas', confianza: 0.86, evidencia_textual: '[seed] comité quincenal' },
    { caja_codigo: 'op_tiempo_fondeo', valor: '5-7 días hábiles tras firma', confianza: 0.88, evidencia_textual: '[seed] fondeo' },
    { caja_codigo: 'op_frecuencia_comite', valor: 'quincenal', confianza: 0.95, evidencia_textual: '[seed] quincenal' },
    { caja_codigo: 'op_documentacion_estandar', valor: 'EEFF, declaraciones, KYC, garantía evaluada', confianza: 0.9, evidencia_textual: '[seed] doc estándar' },
    // pricing_y_criterio
    { caja_codigo: 'to_historial_credito', valor: 'Restructuras concluidas ≥6 meses OK. Mora pasada ≤60 días aceptable. Mora abierta es rechazo automático.', confianza: 0.9, evidencia_textual: '[seed] postura buró' },
    { caja_codigo: 'to_ratios_financieros', valor: 'Tolerantes a un trimestre de EBITDA negativo si hay justificación. DSCR < 1.0 es no.', confianza: 0.85, evidencia_textual: '[seed] postura ratios' },
    { caja_codigo: 'pc_reglas_pricing', valor: 'Tasa sube con riesgo sector/antigüedad; baja con garantía hipotecaria y track previo.', confianza: 0.82, evidencia_textual: '[seed] pricing' },
    { caja_codigo: 'se_sin_historial', valor: { respuesta: 'condicional', condiciones: 'requiere aval con buró sólido' }, confianza: 0.86, evidencia_textual: '[seed] sin historial' },
    { caja_codigo: 'se_sat_32d_negativa', valor: { respuesta: 'no' }, confianza: 0.92, evidencia_textual: '[seed] 32-D negativa' },
    { caja_codigo: 'se_pep_estructura', valor: { respuesta: 'condicional', condiciones: 'declaración + due diligence reforzada' }, confianza: 0.85, evidencia_textual: '[seed] PEP' },
    // contacto
    { caja_codigo: 'co_punto_contacto', valor: 'Director de Crédito · Lic. Patricia Robles', confianza: 0.94, evidencia_textual: '[seed] contacto' },
    { caja_codigo: 'co_email_telefono', valor: { email: 'credito@verticefinanciero.mx', telefono: '+525512345678' }, confianza: 0.95, evidencia_textual: '[seed] email/tel' },
  ];

  const seeded = await persistirExtraccionesBatch({
    sesion_id,
    turno_id: turno.turno_id,
    extracciones,
  });
  console.log(`  ${seeded.length} cajas seedeadas`);

  const cajasApl = getCajasAplicables('sofom_enr');
  const activas = await listarExtraccionesActivas(sesion_id);
  const mapa = computeMapaIncertidumbre(activas, cajasApl, []);
  console.log(`  Material: ${activas.length}/${cajasApl.length} cajas | críticas ${(mapa.cajas_criticas_pct * 100).toFixed(0)}% | global ${(mapa.confianza_global * 100).toFixed(0)}%`);

  console.log('\n  Transicionando sesión a sintetizando…');
  await transicionarSesionASintetizando(sesion_id);

  console.log('  Invocando Opus 4.7 síntesis (effort=xhigh, adaptive thinking, max=32K)…');
  const t0 = Date.now();
  let result;
  try {
    result = await procesarSintesisFinal(sesion_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ✗ Síntesis falló: ${msg}`);
    if (err && typeof err === 'object' && 'issues' in err) {
      console.error(`    issues:`, JSON.stringify((err as { issues: unknown }).issues, null, 2));
    }
    await resetReviewTables(testDb);
    await client.end();
    process.exit(1);
  }
  const elapsed = Date.now() - t0;

  console.log(`\n  Síntesis OK · ${(elapsed / 1000).toFixed(1)}s · perfil_id=${result.perfil_id.slice(0, 8)}… version=${result.version}`);

  console.log('\n  Aserciones:');
  ok('perfil tiene schema_version="1.0"', result.perfil.schema_version === '1.0');
  ok('perfil.institucion.tipo = sofom_enr', result.perfil.institucion.tipo === 'sofom_enr');
  ok('perfil.metricas.completitud entre 0 y 1', result.perfil.metricas.completitud >= 0 && result.perfil.metricas.completitud <= 1);
  const cajasCount = Object.keys(result.perfil.cajas).length;
  ok(`perfil.cajas tiene 54 entradas (CANON + EXT[sofom_enr])`, cajasCount === 54, { actual: cajasCount });
  ok(`perfil.cajas tiene ≥ 35 entradas con fuente='llm' (material seedeado)`, (() => {
    return Object.values(result.perfil.cajas).filter((c) => c.fuente === 'llm').length >= 30;
  })(), Object.values(result.perfil.cajas).filter((c) => c.fuente === 'llm').length);
  ok('resumen_ejecutivo ≥ 200 chars', result.perfil.resumen_ejecutivo.length >= 200, result.perfil.resumen_ejecutivo.length);
  ok('status_transition = completa', result.status_transition === 'completa');

  // Distribución por fuente
  const porFuente: Record<string, number> = {};
  for (const c of Object.values(result.perfil.cajas)) {
    porFuente[c.fuente] = (porFuente[c.fuente] ?? 0) + 1;
  }
  console.log(`\n  Distribución de fuentes:`);
  for (const [f, n] of Object.entries(porFuente)) console.log(`    · ${f.padEnd(20)} ${n}`);

  await resetReviewTables(testDb);
  await client.end();

  console.log(`\n  ${passed}/${passed + failed} aserciones ✓${failed ? ` — ${failed} fallos ✗` : ''}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[test síntesis] error fatal:', err);
  process.exit(1);
});
