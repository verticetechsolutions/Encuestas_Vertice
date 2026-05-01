// detectarFatiga — pure rules sobre la historia de turnos del usuario.
// No LLM, no DB. La idea es no agotar al subdirector con demasiadas preguntas.
//
// 4 reglas (per IMPLEMENTATION.md §7.3):
//   1. silencio_pausa: gap previo al último turno > 30s.
//   2. keyword: el último turno contiene una frase de hartazgo ("ya no sé", "siguiente",
//      "no aplica" sola, etc.).
//   3. brevedad: los últimos 3 turnos tienen < 5 palabras cada uno.
//   4. velocidad: WPM del último turno cae > 40% respecto al baseline de los primeros 5.
//
// Si cualquiera dispara, el motor escribe sesiones.fatiga_detectada=true y considera cerrar.
// La función puede correr en cliente o servidor — solo recibe la historia.

export interface TurnoUsuario {
  texto: string;
  // Tiempo desde que se mostró la pregunta/batch hasta que el usuario soltó la respuesta.
  // En segundos. Opcional porque la voz lo da naturalmente; en texto puede no medirse.
  duracion_segundos?: number;
  // Tiempo de inactividad inmediatamente previo a este turno (silencio antes de hablar/teclear).
  silencio_previo_segundos?: number;
}

export type TipoFatiga = 'silencio_pausa' | 'keyword' | 'brevedad' | 'velocidad';

export type FatigaResultado =
  | { detectada: false }
  | { detectada: true; tipo: TipoFatiga; evidencia: string };

const SILENCIO_THRESHOLD_S = 30;
const BREVEDAD_PALABRAS_MIN = 5;
const BREVEDAD_TURNOS = 3;
const VELOCIDAD_BASELINE_TURNOS = 5;
const VELOCIDAD_DECLIVE_PCT = 0.4;

// Regex tolerante. JS \b es ASCII-only; "é" no cuenta como word char, por eso usamos
// lookahead explícito (?=...) en vez de \b después de tokens con acento.
const FIN = String.raw`(?=\s|[.,!?]|$)`;
const KEYWORDS_FATIGA: readonly RegExp[] = [
  new RegExp(String.raw`\bya\s+no\s+s[eé]` + FIN, 'i'),
  new RegExp(String.raw`\bno\s+s[eé]` + FIN, 'i'),
  /\bsiguiente(\s+pregunta)?\b/i,
  /(^|\s)ya\s*[.!]?\s*$/i, // "ya" como cierre del turno
  new RegExp(String.raw`\bp[aá]sa(le)?` + FIN, 'i'),
  /\bno\s+aplica\b/i,
];

export function detectarFatiga(turnos: readonly TurnoUsuario[]): FatigaResultado {
  if (turnos.length === 0) return { detectada: false };
  const last = turnos[turnos.length - 1];

  // 1. silencio
  if ((last.silencio_previo_segundos ?? 0) > SILENCIO_THRESHOLD_S) {
    return {
      detectada: true,
      tipo: 'silencio_pausa',
      evidencia: `silencio previo: ${last.silencio_previo_segundos}s`,
    };
  }

  // 2. keyword
  for (const re of KEYWORDS_FATIGA) {
    const match = re.exec(last.texto);
    if (match) {
      return { detectada: true, tipo: 'keyword', evidencia: match[0].trim() };
    }
  }

  // 3. brevedad
  if (turnos.length >= BREVEDAD_TURNOS) {
    const slice = turnos.slice(-BREVEDAD_TURNOS);
    if (slice.every((t) => contarPalabras(t.texto) < BREVEDAD_PALABRAS_MIN)) {
      return {
        detectada: true,
        tipo: 'brevedad',
        evidencia: `${BREVEDAD_TURNOS} turnos consecutivos con < ${BREVEDAD_PALABRAS_MIN} palabras`,
      };
    }
  }

  // 4. velocidad — solo si tenemos baseline y duración del último turno
  if (turnos.length > VELOCIDAD_BASELINE_TURNOS && (last.duracion_segundos ?? 0) > 0) {
    const baseline = turnos.slice(0, VELOCIDAD_BASELINE_TURNOS);
    const baselineWPM = wpmPromedio(baseline);
    const lastWPM = wpm(last);
    if (baselineWPM > 0 && lastWPM < baselineWPM * (1 - VELOCIDAD_DECLIVE_PCT)) {
      return {
        detectada: true,
        tipo: 'velocidad',
        evidencia: `WPM cayó de ${baselineWPM.toFixed(0)} a ${lastWPM.toFixed(0)} (≥ ${(VELOCIDAD_DECLIVE_PCT * 100).toFixed(0)}% declive)`,
      };
    }
  }

  return { detectada: false };
}

function contarPalabras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function wpm(t: TurnoUsuario): number {
  if (!t.duracion_segundos || t.duracion_segundos <= 0) return 0;
  return contarPalabras(t.texto) / (t.duracion_segundos / 60);
}

function wpmPromedio(turnos: readonly TurnoUsuario[]): number {
  const valores = turnos.map(wpm).filter((w) => w > 0);
  if (valores.length === 0) return 0;
  return valores.reduce((s, w) => s + w, 0) / valores.length;
}
