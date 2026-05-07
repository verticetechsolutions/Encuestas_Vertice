// computeMapaIncertidumbre — pure function, no LLM, no DB.
// Recibe el catálogo de cajas aplicables a la sesión + las extracciones
// acumuladas, devuelve el estado por caja, agregados, y top N a atacar.
//
// Ejecutar tras cada turno (latencia esperada <50ms). El resultado alimenta:
//   - el motor (decide si cerrar la sesión, qué priorizar en el siguiente batch)
//   - la UI (panel lateral con porcentajes por sección)
//   - la persistencia (`mapa_incertidumbre_snapshots` por turno para auditar)
//
// Decisiones de diseño:
//   - "Llena" requiere confianza ≥ 0.80 (críticas) o 0.65 (blandas), per §5.4.
//   - "No aplica" es llena para fines de completitud — extracción manual con
//     valor=null y confianza ≥ threshold cuenta como cerrada (founder D2).
//   - "Declinada" es terminal por decisión del motor (Phase 5 step 5: review
//     handoff Sonnet→Opus). Cuenta como llena en cajas_*_pct (la sesión no
//     pudo cerrarla, motor la acepta así). Excluida de top_cajas_a_atacar para
//     que Sonnet no la repregunte. Se override sobre cualquier estado previo
//     (incluso contradictoria) — la decisión vive server-side y manda.
//   - "Contradictoria" se detecta cuando hay múltiples extracciones no-superseded
//     con valores distintos sobre la misma caja. Surface bug para el operador,
//     no resolución automática.
//   - confianza_global pondera críticas 2x sobre blandas para que la métrica refleje
//     prioridad de cierre (la institución no firma sin críticas resueltas).
//     Declinadas conservan la confianza de su última extracción (0 si nunca
//     se extrajo) — bajan el score honestamente sin inflar artificialmente.

import type { CajaCanon, Criticidad } from '@/lib/schemas/cajas';
import type { Extraccion } from '@/lib/schemas/extracciones';

export const CONFIANZA_MIN_CRITICA = 0.8;
export const CONFIANZA_MIN_BLANDA = 0.65;

export type CajaStatus =
  | 'llena'
  | 'parcial'
  | 'vacia'
  | 'no_aplica'
  | 'declinada'
  | 'contradictoria';

export interface CajaState {
  codigo: string;
  criticidad: Criticidad;
  status: CajaStatus;
  confianza: number; // 0..1; 0 si vacía
  evidencias_count: number;
  ultima_extraccion_id: string | null;
}

export interface MapaIncertidumbre {
  cajas: Record<string, CajaState>;
  // Ratio cajas críticas con status 'llena' | 'no_aplica' | 'declinada' / total
  // críticas aplicables. Declinadas cuentan como cerradas (motor las terminó).
  cajas_criticas_pct: number;
  cajas_blandas_pct: number;
  // Confianza ponderada (críticas peso 2, blandas peso 1) sobre todas las cajas aplicables.
  confianza_global: number;
  // Códigos de las top N cajas a atacar próximas: críticas primero, dentro de cada
  // grupo las parciales antes que las vacías (más cerca de threshold = más rentable),
  // contradictorias siempre arriba. Declinadas excluidas (no se repreguntan).
  top_cajas_a_atacar: string[];
}

export function computeMapaIncertidumbre(
  extracciones: readonly Extraccion[],
  cajasAplicables: readonly CajaCanon[],
  cajasDeclinadas: readonly string[] = [],
  topN = 3
): MapaIncertidumbre {
  const declinadasSet = new Set(cajasDeclinadas);

  const porCaja = new Map<string, Extraccion[]>();
  for (const e of extracciones) {
    if (e.superseded_by) continue; // ignora extracciones sustituidas
    const list = porCaja.get(e.caja_codigo) ?? [];
    list.push(e);
    porCaja.set(e.caja_codigo, list);
  }

  const cajas: Record<string, CajaState> = {};
  for (const canon of cajasAplicables) {
    cajas[canon.codigo] = collapseCaja(
      canon,
      porCaja.get(canon.codigo) ?? [],
      declinadasSet.has(canon.codigo)
    );
  }

  const criticas = cajasAplicables.filter((c) => c.criticidad === 'critica');
  const blandas = cajasAplicables.filter((c) => c.criticidad === 'blanda');

  const isFilled = (s: CajaState) =>
    s.status === 'llena' || s.status === 'no_aplica' || s.status === 'declinada';

  const cajas_criticas_pct =
    criticas.length === 0 ? 1 : criticas.filter((c) => isFilled(cajas[c.codigo])).length / criticas.length;
  const cajas_blandas_pct =
    blandas.length === 0 ? 1 : blandas.filter((c) => isFilled(cajas[c.codigo])).length / blandas.length;

  const sumPonderada =
    criticas.reduce((s, c) => s + cajas[c.codigo].confianza * 2, 0) +
    blandas.reduce((s, c) => s + cajas[c.codigo].confianza * 1, 0);
  const denom = criticas.length * 2 + blandas.length * 1;
  const confianza_global = denom === 0 ? 0 : sumPonderada / denom;

  // Top N a atacar — orden de prioridad:
  //   1. status === 'contradictoria' (siempre primero, son bugs operacionales)
  //   2. criticidad === 'critica' antes que 'blanda'
  //   3. status === 'parcial' antes que 'vacia' (más cerca de threshold)
  //   4. dentro del mismo bucket, mayor confianza primero (más rentable)
  const orden: Record<CajaStatus, number> = {
    contradictoria: 0,
    parcial: 1,
    vacia: 2,
    llena: 3, // excluidas abajo
    no_aplica: 4, // excluidas abajo
    declinada: 5, // excluidas abajo (motor decidió terminal)
  };

  const candidatas = cajasAplicables
    .filter((c) => {
      const s = cajas[c.codigo];
      return s.status !== 'llena' && s.status !== 'no_aplica' && s.status !== 'declinada';
    })
    .sort((a, b) => {
      const sa = cajas[a.codigo];
      const sb = cajas[b.codigo];
      if (sa.status !== sb.status && (sa.status === 'contradictoria' || sb.status === 'contradictoria')) {
        return orden[sa.status] - orden[sb.status];
      }
      if (a.criticidad !== b.criticidad) return a.criticidad === 'critica' ? -1 : 1;
      if (sa.status !== sb.status) return orden[sa.status] - orden[sb.status];
      return sb.confianza - sa.confianza;
    });

  return {
    cajas,
    cajas_criticas_pct,
    cajas_blandas_pct,
    confianza_global,
    top_cajas_a_atacar: candidatas.slice(0, topN).map((c) => c.codigo),
  };
}

function collapseCaja(
  canon: CajaCanon,
  extracciones: Extraccion[],
  declinada: boolean
): CajaState {
  // Override `declinada` corre primero: motor terminó la caja por handoff Sonnet→Opus
  // (cap_casos_alcanzado, cap_turnos_alcanzado, estancada_post_profundizar, etc.).
  // Gana sobre cualquier estado de extracción para que top_cajas_a_atacar la excluya.
  // Si hay extracciones previas, conserva confianza/evidencia de la última (no
  // perdemos señal al sintetizar). Si no las hay, confianza=0 — bajamos el score
  // honestamente sin inflar.
  if (declinada) {
    if (extracciones.length === 0) {
      return {
        codigo: canon.codigo,
        criticidad: canon.criticidad,
        status: 'declinada',
        confianza: 0,
        evidencias_count: 0,
        ultima_extraccion_id: null,
      };
    }
    const ordenadas = [...extracciones].sort((a, b) => {
      if (a.version !== b.version) return b.version - a.version;
      const ta = a.created_at?.getTime?.() ?? 0;
      const tb = b.created_at?.getTime?.() ?? 0;
      return tb - ta;
    });
    const latest = ordenadas[0];
    return {
      codigo: canon.codigo,
      criticidad: canon.criticidad,
      status: 'declinada',
      confianza: latest.confianza,
      evidencias_count: extracciones.length,
      ultima_extraccion_id: latest.id ?? null,
    };
  }

  if (extracciones.length === 0) {
    return {
      codigo: canon.codigo,
      criticidad: canon.criticidad,
      status: 'vacia',
      confianza: 0,
      evidencias_count: 0,
      ultima_extraccion_id: null,
    };
  }

  // Última por version (mayor = más reciente). En caso de empate, por created_at.
  const ordenadas = [...extracciones].sort((a, b) => {
    if (a.version !== b.version) return b.version - a.version;
    const ta = a.created_at?.getTime?.() ?? 0;
    const tb = b.created_at?.getTime?.() ?? 0;
    return tb - ta;
  });
  const latest = ordenadas[0];

  // Contradictoria: 2+ extracciones no-superseded con valores distintos.
  const distinctValores = new Set(extracciones.map((e) => JSON.stringify(e.valor ?? null)));
  if (distinctValores.size > 1) {
    return {
      codigo: canon.codigo,
      criticidad: canon.criticidad,
      status: 'contradictoria',
      confianza: latest.confianza,
      evidencias_count: extracciones.length,
      ultima_extraccion_id: latest.id ?? null,
    };
  }

  const threshold = canon.criticidad === 'critica' ? CONFIANZA_MIN_CRITICA : CONFIANZA_MIN_BLANDA;
  const cumple = latest.confianza >= threshold;

  // Validez del valor para cierre terminal (Phase 3 D2 follow-up):
  // `null` solo es terminal cuando el canon declara `permite_no_aplica=true`.
  // Si el valor es null en una caja que NO acepta no_aplica, cae a parcial
  // aunque cumpla threshold — el aliado debe ingresar un valor real, ese
  // null es data inválida que el form lateral no debería permitir.
  const valorEsNull = latest.valor === null;
  const aceptaNull = canon.permite_no_aplica === true;
  const valorValidoParaCierre = !valorEsNull || aceptaNull;
  const cumpleTerminal = cumple && valorValidoParaCierre;

  // no_aplica: extracción manual con valor null y confianza ≥ threshold, sobre una
  // caja que declara `permite_no_aplica=true`. Solo `manual` porque el LLM puede
  // escribir null como "sin requisito"/"no usa" para cajas numéricas ambiguas —
  // la diferencia "no aplica" explícita la marca el usuario en el form lateral.
  const esNoAplica =
    cumpleTerminal && latest.fuente === 'manual' && valorEsNull && aceptaNull;

  const status: CajaStatus = esNoAplica ? 'no_aplica' : cumpleTerminal ? 'llena' : 'parcial';

  return {
    codigo: canon.codigo,
    criticidad: canon.criticidad,
    status,
    confianza: latest.confianza,
    evidencias_count: extracciones.length,
    ultima_extraccion_id: latest.id ?? null,
  };
}
