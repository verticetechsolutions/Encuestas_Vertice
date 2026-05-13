// Wrapper de Vercel Blob storage para PDFs de síntesis (Fase 8).
// Cierre parcial de deuda Fase 8 (storage): wire-up listo, gated por la
// presencia de `BLOB_READ_WRITE_TOKEN`. Cuando el founder provisione el bucket
// y agregue la dep `@vercel/blob`, el dynamic import abajo conecta el camino
// real sin tocar callsites.
//
// Diseño:
//   - `uploadPdfToBlob(buffer, pathname)` retorna la URL pública o `null` si el
//     storage no está configurado. Nunca arroja: el caller decide si tratar
//     "sin URL" como degradación silenciosa o como warning.
//   - El check de env (`BLOB_READ_WRITE_TOKEN`) es la única gate. Si la dep
//     `@vercel/blob` no está instalada, el dynamic import devuelve null y se
//     loguea una vez (no spam).
//   - Las funciones del SDK `put(pathname, body, { access: 'public' })` viven
//     dentro del try/catch para que un fallo de red no rompa la síntesis.
//   El perfil queda persistido sin PDF; un re-run posterior puede llenar la URL.

import { logger } from '@/lib/observability/axiom';

// Flag interno para no spamear logs cuando la dep no está instalada.
let blobDepWarned = false;

interface BlobPutResult {
  url: string;
}

/**
 * Sube un buffer PDF a Vercel Blob. Devuelve la URL pública o `null` si:
 *   - `BLOB_READ_WRITE_TOKEN` no está configurado.
 *   - `@vercel/blob` no está instalada todavía.
 *   - El SDK arroja (red, auth, quota).
 *
 * Path convention: `sintesis/<perfil_id>.pdf`. Se le agrega un suffix random
 * dentro de `put()` por defecto en `@vercel/blob` para evitar colisiones; si
 * queremos URL determinista, pasar `addRandomSuffix: false` en options.
 */
export async function uploadPdfToBlob(
  buffer: Buffer,
  pathname: string
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    // No-config — silencioso. El step de generar-pdf ya loguea bytes; este
    // wrapper no agrega ruido cuando el founder aún no provisionó el bucket.
    return null;
  }

  type BlobModule = {
    put: (
      pathname: string,
      body: Buffer,
      opts: Record<string, unknown>
    ) => Promise<BlobPutResult>;
  };
  let blobModule: BlobModule | null = null;
  try {
    // Dynamic import via `Function` constructor — evita que webpack/tsc traten
    // de resolver `@vercel/blob` at compile-time si la dep no está instalada.
    // Cuando el founder ejecute `npm i @vercel/blob`, este path queda
    // funcional sin más cambios. Cast a unknown→BlobModule explícito porque
    // `import()` indirecto sale como `any`.
    const indirectImport = new Function('m', 'return import(m)') as (
      m: string
    ) => Promise<unknown>;
    blobModule = (await indirectImport('@vercel/blob')) as BlobModule;
  } catch (err) {
    if (!blobDepWarned) {
      blobDepWarned = true;
      logger.warn('storage.blob.dep_missing', {
        message:
          'BLOB_READ_WRITE_TOKEN está configurado pero `@vercel/blob` no está instalado. Ejecuta `npm i @vercel/blob` para activar el storage.',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return null;
  }

  if (!blobModule?.put) return null;

  try {
    const result = await blobModule.put(pathname, buffer, {
      access: 'public',
      contentType: 'application/pdf',
      token,
    });
    return result.url;
  } catch (err) {
    logger.error('storage.blob.put_failed', {
      pathname,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
