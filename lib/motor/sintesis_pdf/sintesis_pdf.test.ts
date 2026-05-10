// Tests del PDF generator. Estrategia:
//   - Tests `htmlOnly` corren rápido (sin Chromium, sin red) y validan que el
//     template produce HTML semántico, con todas las secciones, las cajas
//     correctamente agrupadas, y el resumen ejecutivo splitado en párrafos.
//   - Tests del PDF real (binario) están detrás de skip-if-no-chromium guard
//     porque CI sin puppeteer/chromium serverless no puede correrlos. Si el
//     `puppeteer` devDep está instalado, corren localmente y validan los
//     magic bytes %PDF- en el buffer.
//
// El fixture `fakePerfil()` cubre los 6 grupos UI con al menos 1 caja por
// grupo para asegurar que el rendering de secciones funciona end-to-end.

import { describe, it, expect } from 'vitest';
import { renderPdfHtml, generarPdfSintesis } from './index';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';

function fakePerfil(): PerfilDecisionFinal {
  return {
    schema_version: '1.0',
    institucion: {
      id: '11111111-1111-1111-1111-111111111111',
      razon_social: 'Banca Vértice de México, S.A.',
      nombre_comercial: 'Vértice',
      tipo: 'banco',
    },
    sesion_id: '22222222-2222-2222-2222-222222222222',
    generado_at: new Date('2026-05-09T18:30:00Z'),
    metricas: {
      cajas_llenas: 42,
      cajas_aplicables: 81,
      completitud: 42 / 81,
      confianza_global: 0.78,
      cajas_criticas_pct: 0.65,
      cajas_blandas_pct: 0.45,
      casos_sinteticos_aplicados: 2,
      fatiga_detectada: false,
    },
    cajas: {
      // identificacion
      id_razon_social: {
        valor: 'Banca Vértice de México, S.A.',
        confianza: 0.98,
        fuente: 'llm',
        evidencia_textual: '"Banca Vértice de México"',
        intentos: 1,
      },
      id_tipo_institucion: {
        valor: 'banco',
        confianza: 0.95,
        fuente: 'llm',
        evidencia_textual: null,
        intentos: 1,
      },
      // productos_y_mercado
      nm_productos_ofrecidos: {
        valor: ['credito_simple', 'credito_revolvente', 'factoraje'],
        confianza: 0.85,
        fuente: 'llm',
        evidencia_textual: '"hacemos crédito simple, revolvente y factoraje"',
        intentos: 1,
      },
      // numeros_del_negocio
      ru_monto_min: {
        valor: 500000,
        confianza: 0.92,
        fuente: 'llm',
        evidencia_textual: '"medio millón mínimo"',
        intentos: 1,
      },
      ru_score_pm_min: {
        valor: null,
        confianza: 0.85,
        fuente: 'llm',
        evidencia_textual: '"no usamos score buró"',
        intentos: 1,
      },
      // operacion (caja típica imaginada — usaremos una declinada)
      op_tiempo_aprobacion: {
        valor: '5-10 días hábiles',
        confianza: 0.72,
        fuente: 'llm',
        evidencia_textual: null,
        intentos: 2,
      },
      // pricing_y_criterio
      pc_tasa_promedio: {
        valor: 0.18,
        confianza: 0.55,
        fuente: 'llm',
        evidencia_textual: '"alrededor de 18 puntos"',
        intentos: 3,
      },
      // contacto_y_especificos
      co_email_telefono: {
        valor: { email: 'credito@vertice.mx', telefono: '+52-55-1234-5678' },
        confianza: 0.99,
        fuente: 'manual',
        evidencia_textual: null,
        intentos: 1,
      },
      // declined sample
      gr_dscr_min: {
        valor: null,
        confianza: 0,
        fuente: 'decline_to_answer',
        evidencia_textual: null,
        intentos: 2,
      },
    },
    resumen_ejecutivo:
      'Banca Vértice opera como banco múltiple con foco en pyme media. Los rangos cementan crédito simple a partir de 500K MXN, sin requisito de score buró, lo cual sugiere apetito por reciprocidad operativa.\n\nLa cobertura geográfica se concentra en CDMX y Bajío, con factoraje como producto secundario. La sesión cerró con dos casos sintéticos aplicados, principalmente en pricing y criterios de operación.',
  };
}

describe('PDF template (htmlOnly)', () => {
  it('genera HTML con doctype + html/head/body válidos', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="es-MX">');
    expect(html).toContain('<body>');
    expect(html).toContain('</body></html>');
  });

  it('incluye razón social en cover y title', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html).toContain('Banca Vértice de México, S.A.');
    expect(html).toContain('Vértice · Banca Vértice de México');
  });

  it('renderiza chip del tipo de institución traducido', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html).toContain('Banco múltiple');
  });

  it('formatea completitud como porcentaje en MX locale', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // 42/81 = 51.85% — Intl.NumberFormat MX usa "%" sin espacio.
    expect(html).toMatch(/52\s*%|51[\.,]9\s*%|51[\.,]85\s*%/);
  });

  it('agrupa cajas por grupo_ui con sus títulos español', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html).toContain('Identificación institucional');
    expect(html).toContain('Productos y mercado');
    expect(html).toContain('Números del negocio');
    expect(html).toContain('Pricing y criterio');
  });

  it('separa el resumen ejecutivo en párrafos via \\n\\n', async () => {
    const html = await renderPdfHtml(fakePerfil());
    const matches = html.match(/<div class="summary__body"[^>]*>([\s\S]*?)<\/div>/);
    expect(matches).toBeTruthy();
    const body = matches![1];
    const pCount = (body.match(/<p>/g) ?? []).length;
    expect(pCount).toBe(2);
  });

  it('renderiza valor null como "No aplica" cuando permite_no_aplica', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // ru_score_pm_min tiene permite_no_aplica: true en CAJAS_CANON
    expect(html).toContain('No aplica / sin requisito');
  });

  it('formatea montos MXN para cajas con codigo monto/facturacion', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // ru_monto_min = 500000 → $500,000
    expect(html).toContain('500,000');
  });

  it('formatea arrays como bullets', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // nm_productos_ofrecidos = [3 items]
    expect(html).toContain('• credito_simple');
    expect(html).toContain('• factoraje');
  });

  it('formatea objetos con email/telefono como key: value', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html).toContain('email: credito@vertice.mx');
    expect(html).toContain('telefono: +52-55-1234-5678');
  });

  it('incluye sección "Cajas sin cierre" cuando hay declined', async () => {
    const html = await renderPdfHtml(fakePerfil());
    expect(html).toContain('Cajas sin cierre');
    expect(html).toContain('gr_dscr_min');
  });

  it('marca confianza baja con clase --low', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // pc_tasa_promedio confianza 0.55 → debería tener --low
    expect(html).toContain('box-row__confianza--low');
  });

  it('embed font-face CSS si geist está instalado, fallback comment si no', async () => {
    const html = await renderPdfHtml(fakePerfil());
    // Una de las dos formas: woff2 base64 o comentario fallback
    const hasFont = html.includes('@font-face') && html.includes('woff2-variations');
    const hasFallback = html.includes('geist fonts no disponibles');
    expect(hasFont || hasFallback).toBe(true);
  });

  it('htmlOnly path devuelve buffer del HTML serializado', async () => {
    const result = await generarPdfSintesis(fakePerfil(), { htmlOnly: true });
    expect(result.bytes).toBeGreaterThan(5000);
    expect(result.html).toBeDefined();
    expect(result.html!.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
  });
});

// =============================================================================
// PDF binario — solo si Chromium está disponible
// =============================================================================
//
// Estos tests intentan launch real del browser via puppeteer (full devDep).
// Skipean si la importación o el launch falla — útil para CI sin Chrome.
// Localmente con `puppeteer` instalado deberían correr verde.

const canRunChromium = await tryDetectChromium();

describe.skipIf(!canRunChromium)('PDF binario (chromium real)', () => {
  it('produce un PDF con magic bytes %PDF- y >20KB', async () => {
    const perfil = fakePerfil();
    const result = await generarPdfSintesis(perfil);
    expect(result.bytes).toBeGreaterThan(20_000);
    const head = result.buffer.subarray(0, 5).toString('utf-8');
    expect(head).toBe('%PDF-');
    // EOF marker — todos los PDFs terminan con %%EOF.
    const tail = result.buffer.subarray(-6).toString('utf-8');
    expect(tail.includes('%%EOF')).toBe(true);
  }, 60_000);
});

async function tryDetectChromium(): Promise<boolean> {
  try {
    const p = await import('puppeteer');
    p.executablePath();
    return true;
  } catch {
    return false;
  }
}
