// SSE bytes → UIMessageChunk converter pipeline.
//
// Background del bug F2 (doc bugs-encontrados-2026-05-11-e2e §F2):
// `readUIMessageStream` (AI SDK v6) espera `ReadableStream<UIMessageChunk>`
// (objetos parseados), no los bytes SSE crudos de `Response.body`. Pasar
// `res.body` directo crasheaba con "Cannot read properties of undefined
// (reading 'startsWith')" — la lib hace `chunk.startsWith(...)` asumiendo
// strings/objetos parseados.
//
// La solución (mismo pipeline que DefaultChatTransport.processResponseStream):
//   bytes → parseJsonEventStream(uiMessageChunkSchema) → unwrap success/error
//
// Este helper lo encapsula para que:
//   1. Sea testeable sin DOM (Node 22 trae ReadableStream y TextEncoder).
//   2. Regression-guarde contra anyone que vuelva a pasar `res.body` raw
//      a `readUIMessageStream`. El test fuerza el pipeline correcto.
//   3. Permita instrumentation point único (ej. logging de chunks malformados)
//      en un futuro sin tocar `enviarBatch`.

import {
  parseJsonEventStream,
  uiMessageChunkSchema,
  type UIMessageChunk,
} from 'ai';

/**
 * Convierte un stream de bytes SSE (típicamente `Response.body`) en un
 * `ReadableStream<UIMessageChunk>` listo para `readUIMessageStream`.
 *
 * Errores de parsing (chunk inválido contra el schema, JSON malformado) se
 * propagan como throw en el reader del stream resultante. El caller decide
 * surface al usuario via `terminateOnError: true` en readUIMessageStream o
 * try/catch del for-await.
 */
export function sseBytesToUIChunks(
  sseBytes: ReadableStream<Uint8Array>
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({
    stream: sseBytes,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream<
      { success: true; value: UIMessageChunk } | { success: false; error: Error },
      UIMessageChunk
    >({
      transform(chunk, controller) {
        if (!chunk.success) throw chunk.error;
        controller.enqueue(chunk.value);
      },
    })
  );
}
