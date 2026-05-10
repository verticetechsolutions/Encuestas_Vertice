// Append helper para integración STT → textarea de respuesta.
//
// La lógica vive aislada del componente (HeroPregunta) por dos razones:
//   1. Testeable sin jsdom/RTL — el proyecto no tiene jsdom configurado
//      todavía (vitest.config.ts environment: 'node'). Una util pura corre
//      en cualquier env.
//   2. Reusable si en el futuro otro componente quiere mismo comportamiento
//      (e.g. corrección post-hoc de un segmento ya commiteado).

import type { TranscriptSegment } from './use-deepgram-stream';

export interface AppendResult {
  /** Nuevo texto a setear en el textarea. */
  nextTexto: string;
  /** Cuántos segmentos del history se consumieron en este append. */
  consumidos: number;
}

/**
 * Concatena los segmentos finalizados nuevos al texto previo.
 *
 * Reglas:
 *   - Solo procesa el slice `history.slice(lastAppendedIndex)`. Idempotente
 *     en re-renders.
 *   - Trimea cada segmento y filtra los que quedan vacíos (Deepgram a veces
 *     emite `is_final` con texto " ").
 *   - Inserta un espacio separador entre el texto previo y el fragmento si
 *     el previo no termina en whitespace y no está vacío.
 *   - Si no hay segmentos nuevos no-vacíos, devuelve el texto previo
 *     intacto + `consumidos: history.length` (avanza el cursor para que el
 *     próximo render no reintente los mismos chunks).
 */
export function appendTranscriptSegments(
  textoPrevio: string,
  history: TranscriptSegment[],
  lastAppendedIndex: number
): AppendResult {
  if (history.length <= lastAppendedIndex) {
    return { nextTexto: textoPrevio, consumidos: lastAppendedIndex };
  }
  const nuevos = history.slice(lastAppendedIndex);
  const fragmento = nuevos
    .map((s) => s.text.trim())
    .filter((t) => t.length > 0)
    .join(' ');

  if (!fragmento) {
    return { nextTexto: textoPrevio, consumidos: history.length };
  }

  const sep =
    textoPrevio.length === 0 || /\s$/.test(textoPrevio) ? '' : ' ';
  return {
    nextTexto: textoPrevio + sep + fragmento,
    consumidos: history.length,
  };
}
