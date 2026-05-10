// Entry point del PDF generator. Recibe un PerfilDecisionFinal y devuelve
// un Buffer con el PDF binario. Esto es lo que la Inngest function
// `sintetizarSesion` consume tras procesar la síntesis.
//
// Pipeline:
//   1. renderToStaticMarkup(template) → HTML string
//   2. launchPdfBrowser() → Browser env-aware
//   3. page.setContent(html) + waitUntil networkidle0
//   4. page.pdf({ format: 'A4', headerTemplate, footerTemplate }) → Buffer
//   5. browser.close() (siempre, incluso en error path → finally)
//
// Storage: el Buffer se devuelve crudo; la decisión de dónde guardarlo
// (Vercel Blob, Postgres bytea, link descargable directo) queda fuera del
// motor de síntesis. Por ahora la Inngest function sólo loguea el size
// para validar que el pipeline produce algo plausible (>20KB).

// `react-dom/server` se importa dinámicamente: Next 15 bloquea su import
// estático desde código que webpack incluye en el bundle de App Router
// ("rendering must use Server Components" check). Este archivo lo consume
// una Inngest function (server-only, fuera del grafo RSC) así que el
// constraint no aplica conceptualmente — pero el linter de Next no
// distingue. El dynamic import resuelve el módulo en runtime y mantiene
// `react-dom/server` fuera del grafo estático del bundler.
//
// `import * as React` cubre el caso classic JSX transform (tsx-cli, scripts)
// además del automatic runtime que usa Next/Vitest. Sin él, scripts que
// corren con classic mode arrojan "React is not defined".
import * as React from 'react';
import type { PerfilDecisionFinal } from '@/lib/schemas/perfil_decision_final';
import { launchPdfBrowser } from './chromium';
import { buildStylesheet } from './styles';
import { PdfTemplate, pdfFooterTemplate, pdfHeaderTemplate } from './template';

async function loadRenderToStaticMarkup() {
  const m = await import('react-dom/server');
  return m.renderToStaticMarkup;
}

export interface GenerarPdfOptions {
  /**
   * Permite saltarse el lanzamiento del browser y devolver solo el HTML
   * pre-render. Útil para tests que no quieren depender de Chromium ni
   * para previews rápidos en herramientas internas.
   */
  htmlOnly?: boolean;
}

export interface PdfResult {
  buffer: Buffer;
  bytes: number;
  /**
   * Sólo presente en `htmlOnly: true`. En modo full devolvemos undefined
   * para no doblar la memoria con el HTML que ya está embebido en el PDF.
   */
  html?: string;
}

/**
 * Genera el PDF de síntesis para un PerfilDecisionFinal. Asume que el perfil
 * ya pasó por `PerfilDecisionFinalConsistenteSchema.parse(...)` upstream
 * (en `lib/motor/sintesis_final.ts:generarSintesis`). NO re-valida.
 */
export async function generarPdfSintesis(
  perfil: PerfilDecisionFinal,
  options: GenerarPdfOptions = {}
): Promise<PdfResult> {
  const stylesheet = buildStylesheet();
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  const html = '<!DOCTYPE html>' + renderToStaticMarkup(<PdfTemplate perfil={perfil} stylesheet={stylesheet} />);

  if (options.htmlOnly) {
    const buffer = Buffer.from(html, 'utf-8');
    return { buffer, bytes: buffer.length, html };
  }

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: pdfHeaderTemplate(),
      footerTemplate: pdfFooterTemplate(perfil),
      margin: { top: '24mm', right: '22mm', bottom: '22mm', left: '22mm' },
    });
    // puppeteer-core v23 returns Uint8Array; normalize a Buffer para que
    // los consumers (Vercel Blob, fs.writeFile, etc.) reciban una API
    // consistente con el resto del repo (que usa Buffer everywhere).
    const buffer = Buffer.from(pdf);
    return { buffer, bytes: buffer.length };
  } finally {
    await browser.close();
  }
}

/**
 * Render del HTML únicamente — útil para snapshot tests, devtools, y
 * preview en `/admin` cuando se quiera ver el documento sin esperar al
 * launch del browser. Async porque `renderToStaticMarkup` se carga
 * dinámicamente (ver comentario al inicio del archivo).
 */
export async function renderPdfHtml(perfil: PerfilDecisionFinal): Promise<string> {
  const stylesheet = buildStylesheet();
  const renderToStaticMarkup = await loadRenderToStaticMarkup();
  return (
    '<!DOCTYPE html>' +
    renderToStaticMarkup(<PdfTemplate perfil={perfil} stylesheet={stylesheet} />)
  );
}
