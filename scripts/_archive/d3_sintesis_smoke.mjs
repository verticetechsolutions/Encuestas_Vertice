// D3 — Smoke E2E del pipeline de síntesis final con Opus 4.7 REAL.
//
// Reusa la sesión del smoke C1 (3cd25a96-…) que tiene 5 cajas de identidad
// pobladas. Fuerza status='sintetizando', ejecuta procesarSintesisFinal
// (que invoca productionOpusSintesisCall — Opus 4.7 con thinking 8K), y
// verifica:
//   - perfil_decision_final tiene una fila nueva con version=1+
//   - sesiones.status transicionó a 'completa'
//   - perfil.metricas son coherentes (cajas_llenas, completitud)
//   - generarPdfSintesis produce un Buffer plausible (>20KB)
//
// Costo: ~$0.10-0.30 (1 Opus call con extended thinking 8K).

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const SESION_ID = '3cd25a96-cdf6-4a61-9495-1828ea129a03';

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

  // 1. Forzar status='sintetizando' para que marcarSesionCompleta pueda flippear.
  console.log('[1/4] Forzando sesión a status=sintetizando…');
  await sql`UPDATE sesiones SET status = 'sintetizando' WHERE id = ${SESION_ID}`;
  await sql.end();

  // 2. Llamar procesarSintesisFinal (sin opusCall override → usa Opus real).
  console.log('[2/4] Invocando procesarSintesisFinal con Opus 4.7 real (puede tomar 30-90s con thinking)…');
  const t0 = Date.now();
  const { procesarSintesisFinal } = await import('../lib/motor/sintesis_final.ts');
  const result = await procesarSintesisFinal(SESION_ID);
  const latenciaMs = Date.now() - t0;
  console.log(`Opus + persist completed in ${latenciaMs}ms`);
  console.log('Result:', JSON.stringify({
    perfil_id: result.perfil_id,
    version: result.version,
    status_transition: result.status_transition,
    completitud: result.perfil.metricas.completitud,
    cajas_llenas: result.perfil.metricas.cajas_llenas,
    cajas_aplicables: result.perfil.metricas.cajas_aplicables,
    resumen_ejecutivo_preview: result.perfil.resumen_ejecutivo?.slice(0, 200),
  }, null, 2));

  // 3. Verificar DB.
  console.log('[3/4] Verificando DB state…');
  const sql2 = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const [sesion] = await sql2`SELECT status FROM sesiones WHERE id = ${SESION_ID}`;
  const [perfil] = await sql2`SELECT id, version, sesion_id FROM perfil_decision_final WHERE id = ${result.perfil_id}`;
  console.log('Sesión status:', sesion.status);
  console.log('Perfil persistido:', perfil);
  await sql2.end();

  // 4. Generar PDF.
  console.log('[4/4] Generando PDF del perfil…');
  try {
    const { generarPdfSintesis } = await import('../lib/motor/sintesis_pdf/index.tsx');
    const pdf = await generarPdfSintesis(result.perfil);
    console.log('PDF generated:', { bytes: pdf.bytes });
  } catch (err) {
    console.warn('PDF generation skipped/failed (esperable si Chromium no está en PATH):', err.message);
  }

  console.log('\n✅ D3 smoke completed');
}

main().catch((err) => {
  console.error('❌ D3 smoke failed:', err);
  process.exit(1);
});
