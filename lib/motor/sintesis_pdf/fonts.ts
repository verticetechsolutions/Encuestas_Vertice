// Embedding de Geist Sans + Geist Mono variable woff2 como base64 dentro del
// HTML que pasamos a Chromium. Razón: el binario de @sparticuz/chromium en
// serverless NO tiene fuentes del sistema, y descargas externas en runtime
// son frágiles + violan offline-first. Embedding garantiza fidelidad
// pixel-perfect entre dev local y producción.
//
// Las variable woff2 cubren todo el rango de pesos en un único archivo
// (~70KB cada una). Total ~140KB raw → ~190KB base64. Aceptable para
// inline; el browser cachea la fuente decodificada y el cost de parse
// es one-shot por documento.
//
// Cargado lazy + memoizado: la primera invocación lee node_modules y
// codifica; las siguientes reusan la string. En tests sin geist (e.g. CI
// con node_modules pruned), la lectura falla con error claro y el
// `embedFontsCss()` devuelve un fallback CSS con system stack premium.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Path absoluto al woff2 variable dentro de `geist`. Calculado a partir del
// CWD del proceso para que funcione tanto en Next runtime como en tests.
function geistAssetPath(family: 'sans' | 'mono'): string {
  const subdir = family === 'sans' ? 'geist-sans' : 'geist-mono';
  const filename = family === 'sans' ? 'Geist-Variable.woff2' : 'GeistMono-Variable.woff2';
  return join(process.cwd(), 'node_modules', 'geist', 'dist', 'fonts', subdir, filename);
}

let _cachedSansBase64: string | null = null;
let _cachedMonoBase64: string | null = null;
let _cachedFallback = false;

function readBase64OrNull(path: string): string | null {
  try {
    return readFileSync(path).toString('base64');
  } catch {
    return null;
  }
}

/**
 * Devuelve un bloque CSS con `@font-face` rules que embeben Geist Sans +
 * Geist Mono variable woff2 inline. Si los archivos no están disponibles
 * (geist no instalado), devuelve un comentario CSS y deja al stack default
 * resolver — el render seguirá funcional (system fonts) aunque no idéntico.
 */
export function embedFontsCss(): string {
  if (_cachedSansBase64 === null && _cachedMonoBase64 === null && !_cachedFallback) {
    _cachedSansBase64 = readBase64OrNull(geistAssetPath('sans'));
    _cachedMonoBase64 = readBase64OrNull(geistAssetPath('mono'));
    if (!_cachedSansBase64 || !_cachedMonoBase64) {
      _cachedFallback = true;
    }
  }

  if (_cachedFallback || !_cachedSansBase64 || !_cachedMonoBase64) {
    return '/* geist fonts no disponibles — usando system stack premium */';
  }

  return `
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url(data:font/woff2;base64,${_cachedSansBase64}) format('woff2-variations');
}
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url(data:font/woff2;base64,${_cachedMonoBase64}) format('woff2-variations');
}
`.trim();
}

/**
 * Stack de fuentes de uso en el resto del CSS. Geist primero, fallback a
 * system fonts premium si el embedding falla. Mantener en sync con
 * `--font-sans` del proyecto principal cuando sea posible.
 */
export const FONT_STACKS = {
  sans: `'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  mono: `'Geist Mono', ui-monospace, 'SF Mono', 'Consolas', 'Liberation Mono', monospace`,
  // Editorial heading stack — un poco más pesado, sirve para los displays
  // de la portada. Geist sigue siendo la base; el peso 600+ le da peso
  // editorial sin necesitar otra familia.
  display: `'Geist', ui-serif, Georgia, 'Times New Roman', serif`,
} as const;
