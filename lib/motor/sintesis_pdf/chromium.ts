// Browser launcher para `generarPdfSintesis`. Resolución env-aware para que
// el mismo entry point funcione idéntico en dev (Chrome/Edge del sistema o
// puppeteer full) y en serverless (Vercel + AWS Lambda) usando el binario
// reducido de @sparticuz/chromium.
//
// Decisión de stack: puppeteer-core como API estable y `@sparticuz/chromium`
// como provider del binario. En dev el `puppeteer` full (devDep ya presente
// pre-Phase 8) trae su propio Chrome bundleado — lo reusamos via
// `puppeteer.executablePath()` para no obligar a instalar Chrome system-wide.
//
// Si el usuario corre tests locales sin `puppeteer` (futuro cleanup), el
// fallback es `process.env.PUPPETEER_EXECUTABLE_PATH` o falla con mensaje
// accionable. Cero magic — el path se resuelve explícitamente y el error
// dice qué env var setear.

import type { Browser } from 'puppeteer-core';

// Detecta entornos serverless donde el binario de Chrome no está disponible
// y usamos @sparticuz/chromium. Cubre Vercel, AWS Lambda directo, y CloudRun.
function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL ||
      process.env.K_SERVICE // Cloud Run
  );
}

export async function launchPdfBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');

  if (isServerlessRuntime()) {
    // Path serverless: @sparticuz/chromium provee binary + args optimizados
    // para Lambda (no-sandbox, single-process, gpu-disabled, etc.). El
    // executablePath() es async porque el módulo extrae el binario tar.br
    // en /tmp la primera vez (cache subsecuente).
    const chromiumModule = await import('@sparticuz/chromium');
    const chromium = chromiumModule.default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // A4 a 150dpi aprox.
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // Path local: preferimos el Chrome bundleado por `puppeteer` (full) si
  // está instalado como devDep — reuso es lo correcto si ya está bajado.
  // Si no, caemos a PUPPETEER_EXECUTABLE_PATH (Chrome/Edge del sistema).
  const executablePath = await resolveLocalExecutablePath();
  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath,
    headless: true,
  });
}

async function resolveLocalExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // puppeteer (full) bundlea Chrome y expone el path desde su browser registry.
  // El import dinámico evita tipar puppeteer en runtime cuando no está.
  try {
    const fullPuppeteer: { executablePath: () => string } = await import('puppeteer');
    return fullPuppeteer.executablePath();
  } catch {
    throw new Error(
      'No Chrome executable found for PDF rendering. ' +
        'Install `puppeteer` as devDep (provides bundled Chrome) or set ' +
        'PUPPETEER_EXECUTABLE_PATH to a Chrome/Edge binary path.'
    );
  }
}
