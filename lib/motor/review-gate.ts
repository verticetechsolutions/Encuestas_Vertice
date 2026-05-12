// Server-side gate para `solicitar_review_seccion` (latency fix).
//
// Sonnet puede emitir review_seccion prematuramente — cada turno en vez de al
// cerrar la sección — lo que dispara una llamada Opus de 30-60s con thinking
// adaptive. Este gate valida precondiciones ANTES de invocar al director y
// rechaza con un tool_result estructurado que Sonnet entiende. La señal
// vuelve al modelo: "todavía no, sigue trabajando con generar_batch_preguntas".
//
// Precondiciones para aceptar review_seccion:
//
//   G1 (already_closed). NO existe review previa para (sesion_id, grupo_ui)
//       con decision_opus ∈ {'avanzar', 'caso_sintetico'} (terminal) — sólo se
//       permite re-emitir review si la anterior fue 'profundizar' (round 2
//       legítimo). Si el grupo ya cerró en round 1, Sonnet debe avanzar al
//       siguiente, no re-dispararlo.
//
//   G2 (snapshot_in_grupo). El snapshot debe contener al menos UNA extracción
//       cuya caja_codigo pertenezca al grupo_ui en cuestión. Si Sonnet emite
//       review sin haber trabajado ninguna caja del grupo, es claramente
//       prematuro.
//
//   G3 (critical_cajas_actionable). Para cada caja crítica aplicable del
//       grupo_ui:
//         - Si su status (computado vía computeMapaIncertidumbre) es terminal
//           (llena | no_aplica | declinada), OK.
//         - Si NO es terminal, debe declararse en `cajas_no_clausuradas` con
//           `turnos_intentados >= MIN_TURNS_PARA_DECLINAR`. Sino, todavía es
//           accionable con un batch directo.
//
// Diseño:
//   - `canCloseSeccion` es async (queries reviews_seccion + listarExtracciones
//     + listarCajasDeclinadas), pero la lógica de decisión pura está en
//     helpers separados (`evaluateGateRules`) para test exhaustivo sin DB.
//   - Devuelve discriminated union para que el caller exhaust-check tipos.

import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reviews_seccion } from '@/db/schema';
import type { GrupoUI, CajaCanon } from '@/lib/schemas/cajas';
import type { CajaNoClausurada, SolicitarReviewSeccionInput } from '@/lib/schemas/review_seccion';
import {
  computeMapaIncertidumbre,
  type CajaState,
} from '@/lib/motor/mapa';
import {
  listarExtraccionesActivas,
  listarCajasDeclinadas,
} from '@/lib/motor/persistence';

// =============================================================================
// Constantes
// =============================================================================

/**
 * Mínimo de turnos directos que Sonnet debe haber intentado sobre una caja
 * antes de poder declararla no clausurada en `cajas_no_clausuradas`. Alineado
 * con la regla 6 del prompt Sonnet ("max 2 intentos directos antes de caso
 * sintético") y con el escalation pattern del Ejemplo 2.
 *
 * Bajarlo permite a Sonnet declinar prematuramente (mala UX, cajas vacías).
 * Subirlo fuerza más rondas — costo de latencia y fatiga del usuario.
 * 2 turnos es el sweet spot validado.
 */
export const MIN_TURNS_PARA_DECLINAR = 2;

// =============================================================================
// Tipos públicos
// =============================================================================

export type GateRejectionReason =
  | 'already_closed' // G1
  | 'snapshot_not_in_grupo' // G2
  | 'critical_cajas_actionable'; // G3

export interface GateAccepted {
  ok: true;
}

export interface GateRejected {
  ok: false;
  razon: GateRejectionReason;
  message: string;
  /**
   * Cajas accionables (status no-terminal + no declaradas en cajas_no_clausuradas
   * con suficientes turnos). Sólo presente cuando razon === 'critical_cajas_actionable'.
   * Sonnet usa esta lista para saber dónde trabajar antes de re-emitir review.
   */
  cajas_pendientes?: Array<{
    caja_codigo: string;
    status: string;
    confianza: number;
    sugerencia: string;
  }>;
}

export type GateResult = GateAccepted | GateRejected;

// =============================================================================
// Entry point
// =============================================================================

export interface CanCloseSeccionArgs {
  sesion_id: string;
  input: SolicitarReviewSeccionInput;
  cajasAplicables: readonly CajaCanon[];
}

/**
 * Decide si el motor puede dispatch a `processSolicitarReview` (que llama a
 * Opus 4.7) o si debe rechazar el tool_call con tool_result error.
 *
 * Implementa G1, G2, G3 en ese orden — short-circuits en el primer fallo.
 */
export async function canCloseSeccion(
  args: CanCloseSeccionArgs
): Promise<GateResult> {
  const { sesion_id, input, cajasAplicables } = args;
  const grupo_ui = input.grupo_ui_codigo;

  // G1: ya hay review terminal para este grupo.
  const yaCerrado = await checkGrupoYaCerrado(sesion_id, grupo_ui);
  if (yaCerrado) {
    return {
      ok: false,
      razon: 'already_closed',
      message:
        `El grupo "${grupo_ui}" ya fue cerrado por el director en una review previa. ` +
        'No vuelvas a emitir solicitar_review_seccion sobre este grupo — avanza con ' +
        'generar_batch_preguntas sobre el siguiente grupo según el orden canónico.',
    };
  }

  // G2: snapshot debe incluir al menos una caja del grupo (Sonnet trabajó algo aquí).
  const cajasDelGrupo = new Set(
    cajasAplicables.filter((c) => c.grupo_ui === grupo_ui).map((c) => c.codigo)
  );
  const snapshotEnGrupo = input.extracciones_snapshot.filter((e) =>
    cajasDelGrupo.has(e.caja_codigo)
  );
  if (snapshotEnGrupo.length === 0) {
    return {
      ok: false,
      razon: 'snapshot_not_in_grupo',
      message:
        `El snapshot que enviaste no contiene ninguna caja del grupo "${grupo_ui}". ` +
        'Trabaja primero las cajas de ese grupo con generar_batch_preguntas antes de ' +
        'pedir review.',
    };
  }

  // G3: críticas del grupo deben estar terminales o declaradas exhaustas.
  const [activas, declinadas] = await Promise.all([
    listarExtraccionesActivas(sesion_id),
    listarCajasDeclinadas(sesion_id),
  ]);
  const mapa = computeMapaIncertidumbre(activas, cajasAplicables, declinadas);

  const pendientes = evaluateCriticasAccionables({
    grupo_ui,
    cajasAplicables,
    cajaStates: mapa.cajas,
    cajas_no_clausuradas: input.cajas_no_clausuradas,
  });

  if (pendientes.length > 0) {
    return {
      ok: false,
      razon: 'critical_cajas_actionable',
      message:
        `El grupo "${grupo_ui}" tiene cajas críticas todavía accionables. ` +
        'Trabájalas con generar_batch_preguntas (mínimo ' +
        `${MIN_TURNS_PARA_DECLINAR} intentos directos por caja antes de declararla ` +
        'en cajas_no_clausuradas y volver a pedir review).',
      cajas_pendientes: pendientes,
    };
  }

  return { ok: true };
}

// =============================================================================
// Helpers de DB
// =============================================================================

/**
 * G1 — busca review previa terminal para (sesion_id, grupo_ui).
 *
 * Terminal = decision_opus ∈ {'avanzar', 'caso_sintetico'}. 'profundizar' NO
 * cuenta porque legítimamente espera un round 2 del mismo grupo.
 *
 * NULL en decision_opus tampoco cuenta — esa fila está in-flight (motor la
 * insertó pero Opus aún no respondió). En la práctica esta condición no se
 * dispara porque processSolicitarReview es síncrono per-request, pero la
 * defensa contra concurrent requests deja el gate sano.
 */
async function checkGrupoYaCerrado(
  sesion_id: string,
  grupo_ui: GrupoUI
): Promise<boolean> {
  const rows = await db
    .select({ decision: reviews_seccion.decision_opus })
    .from(reviews_seccion)
    .where(
      and(
        eq(reviews_seccion.sesion_id, sesion_id),
        eq(reviews_seccion.grupo_ui_codigo, grupo_ui),
        inArray(reviews_seccion.decision_opus, ['avanzar', 'caso_sintetico'])
      )
    )
    .limit(1);
  return rows.length > 0;
}

// =============================================================================
// Helpers puros — testeables sin DB
// =============================================================================

export interface CriticaPendiente {
  caja_codigo: string;
  status: string;
  confianza: number;
  sugerencia: string;
}

/**
 * Pure: dado el estado del mapa + las cajas declaradas como no clausuradas por
 * Sonnet, devuelve la lista de cajas críticas del grupo que SIGUEN siendo
 * accionables (no terminales y no exhausta).
 *
 * Una caja crítica es exhausta si:
 *   - Status terminal en el mapa (llena | no_aplica | declinada).
 *   - O bien Sonnet la declara en cajas_no_clausuradas con
 *     turnos_intentados >= MIN_TURNS_PARA_DECLINAR.
 *
 * Caso especial `contradictoria`: NO es exhausta automáticamente. Necesita
 * Sonnet declararla en cajas_no_clausuradas con razon='contradictoria' (o
 * estancada) Y turnos_intentados >= MIN. Sino se trata como accionable —
 * Sonnet debe re-extraer para resolver el conflicto antes de pedir review.
 */
export function evaluateCriticasAccionables(args: {
  grupo_ui: GrupoUI;
  cajasAplicables: readonly CajaCanon[];
  cajaStates: Record<string, CajaState>;
  cajas_no_clausuradas: readonly CajaNoClausurada[];
}): CriticaPendiente[] {
  const { grupo_ui, cajasAplicables, cajaStates, cajas_no_clausuradas } = args;

  // Map de cajas_no_clausuradas para lookup O(1).
  const exhaustaPorSonnet = new Map<string, CajaNoClausurada>();
  for (const c of cajas_no_clausuradas) {
    exhaustaPorSonnet.set(c.caja_codigo, c);
  }

  const criticas = cajasAplicables.filter(
    (c) => c.grupo_ui === grupo_ui && c.criticidad === 'critica'
  );

  const pendientes: CriticaPendiente[] = [];
  for (const canon of criticas) {
    const state = cajaStates[canon.codigo];
    // Defensa: si el state no existe (mapa stale), tratar como vacia accionable.
    if (!state) {
      pendientes.push({
        caja_codigo: canon.codigo,
        status: 'vacia',
        confianza: 0,
        sugerencia:
          'No hay extracción registrada para esta caja crítica. Pregunta directa primero.',
      });
      continue;
    }

    // Terminal por mapa: OK.
    if (
      state.status === 'llena' ||
      state.status === 'no_aplica' ||
      state.status === 'declinada'
    ) {
      continue;
    }

    // Declarada exhaustiva por Sonnet con suficientes turnos: OK.
    const declarada = exhaustaPorSonnet.get(canon.codigo);
    if (declarada && declarada.turnos_intentados >= MIN_TURNS_PARA_DECLINAR) {
      continue;
    }

    // Accionable. Sugerencia depende del status.
    let sugerencia: string;
    if (state.status === 'vacia') {
      sugerencia = 'Pregunta directa primero, luego reformula con caso concreto si evade.';
    } else if (state.status === 'parcial') {
      sugerencia = `Confianza ${state.confianza.toFixed(2)} — refina la respuesta o pide número/categoría literal.`;
    } else if (state.status === 'contradictoria') {
      sugerencia = 'Resuelve el conflicto: la última respuesta contradice la previa.';
    } else {
      sugerencia = `Estado ${state.status} requiere un turno más antes de declinar.`;
    }

    if (declarada && declarada.turnos_intentados < MIN_TURNS_PARA_DECLINAR) {
      sugerencia += ` Llevas ${declarada.turnos_intentados} turno(s); necesitas al menos ${MIN_TURNS_PARA_DECLINAR}.`;
    }

    pendientes.push({
      caja_codigo: canon.codigo,
      status: state.status,
      confianza: state.confianza,
      sugerencia,
    });
  }

  return pendientes;
}

// Re-export helper SQL para tests que necesiten construir filas reviews_seccion
// con decision_opus específico sin depender del schema entero.
export { sql };
