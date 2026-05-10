// Script para generar un PDF de síntesis de muestra a disco. Útil para
// revisar visualmente el diseño sin levantar todo el pipeline Inngest +
// Opus + DB. Uso:
//   npx tsx scripts/preview_sintesis_pdf.ts [outpath]
//
// Default outpath: ./tmp/sintesis-preview.pdf

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { generarPdfSintesis } from '@/lib/motor/sintesis_pdf';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';

function buildPerfilMuestra(): PerfilDecisionFinal {
  return {
    schema_version: '1.0',
    institucion: {
      id: '11111111-1111-1111-1111-111111111111',
      razon_social: 'Banca Vértice de México, S.A. Institución de Banca Múltiple',
      nombre_comercial: 'Vértice Capital',
      tipo: 'banco',
    },
    sesion_id: '22222222-2222-2222-2222-222222222222',
    generado_at: new Date(),
    metricas: {
      cajas_llenas: 64,
      cajas_aplicables: 81,
      completitud: 64 / 81,
      confianza_global: 0.82,
      cajas_criticas_pct: 0.78,
      cajas_blandas_pct: 0.55,
      casos_sinteticos_aplicados: 3,
      fatiga_detectada: false,
    },
    cajas: {
      // identificacion (5)
      id_razon_social: { valor: 'Banca Vértice de México, S.A.', confianza: 0.99, fuente: 'manual', evidencia_textual: null, intentos: 1 },
      id_nombre_comercial: { valor: 'Vértice Capital', confianza: 0.95, fuente: 'manual', evidencia_textual: null, intentos: 1 },
      id_tipo_institucion: { valor: 'banco', confianza: 0.98, fuente: 'manual', evidencia_textual: null, intentos: 1 },
      id_regulacion: { valor: ['cnbv', 'condusef', 'banxico'], confianza: 0.92, fuente: 'llm', evidencia_textual: '"regulados por CNBV, también supervisados por Banxico"', intentos: 1 },
      id_anios_operacion: { valor: 14, confianza: 0.88, fuente: 'llm', evidencia_textual: '"14 años de operación"', intentos: 1 },

      // productos_y_mercado (algunos)
      nm_productos_ofrecidos: { valor: ['credito_simple', 'credito_revolvente', 'factoraje', 'arrendamiento_puro'], confianza: 0.91, fuente: 'llm', evidencia_textual: '"ofrecemos crédito simple, revolvente, factoraje y arrendamiento puro"', intentos: 1 },
      nm_productos_no_ofrecidos: { valor: ['hipoteca'], confianza: 0.78, fuente: 'llm', evidencia_textual: '"no hacemos hipoteca"', intentos: 1 },
      nm_sectores_aceptados: { valor: ['manufactura', 'comercio_mayorista', 'tecnologia', 'logistica'], confianza: 0.86, fuente: 'llm', evidencia_textual: '"foco en manufactura mediana, comercio mayorista, tech y logística"', intentos: 2 },
      nm_sectores_excluidos: { valor: ['casinos', 'armas', 'cannabis', 'minería'], confianza: 0.95, fuente: 'llm', evidencia_textual: '"excluimos compliance: casinos, armas, cannabis, minería"', intentos: 1 },
      nm_cobertura_geografica: { valor: ['cdmx_y_metro', 'bajio', 'guadalajara_y_metro', 'monterrey_y_metro'], confianza: 0.89, fuente: 'llm', evidencia_textual: null, intentos: 1 },
      nm_tipos_cliente: { valor: ['pm'], confianza: 0.93, fuente: 'llm', evidencia_textual: '"sólo personas morales"', intentos: 1 },

      // numeros_del_negocio (rangos + ratios)
      ru_monto_min: { valor: 2000000, confianza: 0.97, fuente: 'llm', evidencia_textual: '"mínimo 2 millones"', intentos: 1 },
      ru_monto_max: { valor: 50000000, confianza: 0.94, fuente: 'llm', evidencia_textual: '"hasta 50 millones por operación"', intentos: 1 },
      ru_ticket_ideal: { valor: 8000000, confianza: 0.72, fuente: 'llm', evidencia_textual: '"el sweet spot es alrededor de 8 millones"', intentos: 1 },
      ru_moneda: { valor: 'mxn', confianza: 0.99, fuente: 'llm', evidencia_textual: '"todo en pesos"', intentos: 1 },
      ru_antiguedad_min: { valor: 3, confianza: 0.91, fuente: 'llm', evidencia_textual: '"empresas con al menos 3 años"', intentos: 1 },
      ru_facturacion_min: { valor: 30000000, confianza: 0.85, fuente: 'llm', evidencia_textual: '"facturación mínima 30 mdp"', intentos: 1 },
      ru_score_pm_min: { valor: null, confianza: 0.88, fuente: 'llm', evidencia_textual: '"no usamos score buró PM, lo evaluamos cualitativamente"', intentos: 1 },
      ru_score_pf_min: { valor: 700, confianza: 0.82, fuente: 'llm', evidencia_textual: '"score 700+ en buró del rep legal"', intentos: 1 },
      gr_tipos_garantia: { valor: ['hipotecaria', 'fiduciaria', 'prendaria_mueble', 'aval_personal', 'fianza'], confianza: 0.79, fuente: 'llm', evidencia_textual: null, intentos: 2 },
      gr_cobertura_min: { valor: 1.3, confianza: 0.88, fuente: 'llm', evidencia_textual: '"cobertura mínima 1.3x"', intentos: 1 },
      gr_dscr_min: { valor: 1.2, confianza: 0.55, fuente: 'llm', evidencia_textual: '"buscamos al menos 1.2 de DSCR"', intentos: 3 },
      gr_deuda_ebitda_max: { valor: null, confianza: 0.75, fuente: 'llm', evidencia_textual: '"no usamos ese ratio rígidamente"', intentos: 2 },

      // operacion (algunos)
      op_eeff_auditados: { valor: { requerido: true, condiciones: 'arriba de 50 mdp facturación' }, confianza: 0.84, fuente: 'llm', evidencia_textual: null, intentos: 1 },

      // pricing
      pc_tasa_promedio: { valor: 0.165, confianza: 0.62, fuente: 'llm', evidencia_textual: '"tasa promedio gira alrededor de 16-17%"', intentos: 2 },

      // contacto
      co_email_telefono: { valor: { email: 'credito@vertice.mx', telefono: '+52-55-1234-5678' }, confianza: 0.99, fuente: 'manual', evidencia_textual: null, intentos: 1 },

      // declined
      to_situacion_fiscal: { valor: null, confianza: 0, fuente: 'decline_to_answer', evidencia_textual: null, intentos: 2 },
    },
    resumen_ejecutivo:
      'Vértice Capital opera como banco múltiple regulado por CNBV con 14 años de antigüedad. Los rangos cementan crédito simple a partir de 2 mdp y techo de 50 mdp por operación, con ticket ideal alrededor de 8 mdp. La política favorece pyme media con facturación mínima 30 mdp en sectores manufactura, comercio mayorista, tech y logística — exclusiones por compliance habituales (casinos, armas, cannabis, minería).\n\nLa decisión privilegia análisis cualitativo sobre score buró rígido: no usan score PM y declaran que no aplican deuda/EBITDA con un mínimo fijo. DSCR mínimo de 1.2 y cobertura de garantía 1.3x son los ratios definitorios. Cobertura geográfica concentrada en CDMX, Bajío, Guadalajara y Monterrey, con foco en personas morales.\n\nLa sesión se cerró tras tres casos sintéticos aplicados, principalmente para calibrar tolerancia en pricing y situación fiscal — esta última quedó sin cierre por preferir no responder en el formato directo.',
  };
}

async function main() {
  const outpath = resolve(process.argv[2] ?? join('tmp', 'sintesis-preview.pdf'));
  mkdirSync(dirname(outpath), { recursive: true });

  console.log(`Renderizando PDF de muestra → ${outpath}`);
  const t0 = Date.now();
  const result = await generarPdfSintesis(buildPerfilMuestra());
  const elapsed = Date.now() - t0;

  writeFileSync(outpath, result.buffer);
  console.log(`OK · ${result.bytes.toLocaleString('en-US')} bytes · ${elapsed} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
