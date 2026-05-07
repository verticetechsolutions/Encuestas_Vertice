// Persistencia de turnos + extracciones (Phase 5 step posterior).
//
// Cierra los TODOs de `app/api/turn/route.ts`:
//   - persistirTurnoUsuario / persistirTurnoAgente → tabla `turnos_conversacion`.
//   - persistirExtraccionesBatch → tabla `extracciones` con supersede chain.
//
// Decisiones de diseño:
//
// 1. `numero_turno` atómico. NO leemos `MAX(numero_turno)` en JS para luego
//    insertar — eso hace race condition con turnos concurrentes (improbable en
//    MVP pero gratis evitarlo). Usamos un INSERT ... SELECT que computa el
//    siguiente número en una sola query atómica, con RETURNING para tomar el
//    valor real persistido.
//
// 2. Supersede chain dentro de transacción. `persistirExtraccionesBatch`
//    usa `db.transaction()`:
//      a) Valida cada `valor` contra `valorSchemaFor(caja_codigo)`.
//         Si una falla → arroja `ExtraccionInvalidaError` y la transacción
//         rollback (las que ya insertamos en el mismo batch se revierten).
//         El caller (route handler /api/turn) prefiltra con `valorSchemaFor`
//         antes de llamar a este batch, así errores aislados no rollbackean.
//      b) Para cada extracción nueva:
//          - INSERT primero (toma el id retornado).
//          - UPDATE de la previa NO superseded (si existe) settando
//            `superseded_by = nueva_id`.
//      c) Las dos operaciones en este orden evitan que la previa quede sin
//         supersedeo si el INSERT falla por integrity.
//
// 3. Duplicados en el mismo batch para la misma caja. Determinístico:
//    procesamos en el ORDEN del array de input. La última extracción gana.
//    Las intermedias quedan en historial pero con `superseded_by` apuntando a
//    la siguiente del batch. Solo la última tiene `superseded_by IS NULL`.
//    Decisión: respetamos el orden que Sonnet emitió porque puede haber lógica
//    de "primero un valor draft, luego refino con evidencia adicional" en una
//    sola tool_use call.

import { sql, eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { turnos_conversacion, extracciones } from '@/db/schema';
import { valorSchemaFor, type Extraccion } from '@/lib/schemas/extracciones';

// =============================================================================
// Errores
// =============================================================================

/**
 * Arroja durante `persistirExtraccionesBatch` cuando una extracción falla
 * validación contra `valorSchemaFor(caja_codigo)`. La transacción que la
 * envuelve hace rollback automático. El caller debe capturar esta clase y
 * decidir su política (re-intentar con subset válido, devolver al modelo, etc.).
 */
export class ExtraccionInvalidaError extends Error {
  public readonly caja_codigo: string;
  public readonly indice: number;
  public readonly causa: unknown;

  constructor(args: { caja_codigo: string; indice: number; causa: unknown }) {
    const causaMsg =
      args.causa instanceof Error ? args.causa.message : String(args.causa);
    super(
      `Extracción inválida en índice ${args.indice} (caja=${args.caja_codigo}): ${causaMsg}`
    );
    this.name = 'ExtraccionInvalidaError';
    this.caja_codigo = args.caja_codigo;
    this.indice = args.indice;
    this.causa = args.causa;
  }
}

// =============================================================================
// Helpers públicos
// =============================================================================

/**
 * Cuenta turnos previos para esta sesión. NO se usa en los persistirTurno*
 * (esos hacen el cómputo atómico vía SQL); está expuesto para auditoría +
 * tests + diagnóstico.
 */
export async function siguienteNumeroTurno(sesion_id: string): Promise<number> {
  const [row] = await db.execute<{ siguiente: number }>(sql`
    SELECT COALESCE(MAX(numero_turno), 0) + 1 AS siguiente
    FROM turnos_conversacion
    WHERE sesion_id = ${sesion_id}
  `);
  return Number(row?.siguiente ?? 1);
}

/**
 * Lista las extracciones ACTIVAS (no superseded) para una sesión, ordenadas por
 * fecha. Las consume `computeMapaIncertidumbre` para producir el snapshot que
 * alimenta el panel de progreso UI tras cada `registrar_extraccion`.
 *
 * Filtramos por `superseded_by IS NULL` y NO por `fuente`: el form lateral
 * (founder edita "no aplica" manualmente) también participa del mapa.
 */
export async function listarExtraccionesActivas(
  sesion_id: string
): Promise<Extraccion[]> {
  // NOTA: la tabla extracciones NO tiene columna `version` (decisión actual:
  // versionado se infiere por cadena de supersede_by). El schema Zod sí la
  // declara con default(1) para no romper tipos cuando el motor compone
  // Extraccion in-memory; al hidratar desde DB inyectamos `version: 1` que
  // es ignorado por computeMapaIncertidumbre (solo desempata por created_at).
  const rows = await db
    .select()
    .from(extracciones)
    .where(and(eq(extracciones.sesion_id, sesion_id), isNull(extracciones.superseded_by)))
    .orderBy(extracciones.created_at);

  return rows.map((r) => ({
    id: r.id,
    sesion_id: r.sesion_id,
    turno_id: r.turno_id,
    caja_codigo: r.caja_codigo,
    valor: r.valor,
    confianza: r.confianza,
    fuente: r.fuente as Extraccion['fuente'],
    evidencia_textual: r.evidencia_textual,
    version: 1,
    superseded_by: r.superseded_by ?? null,
    created_at: r.created_at,
  }));
}

// =============================================================================
// persistirTurnoUsuario
// =============================================================================

export interface PersistirTurnoUsuarioInput {
  sesion_id: string;
  contenido_texto: string;
  fuente: 'usuario_tipea' | 'usuario_voz';
}

export interface PersistirTurnoResult {
  turno_id: string;
  numero_turno: number;
}

/**
 * Inserta el turno del USUARIO con `numero_turno` computado atómicamente vía
 * subquery. Retorna el id + número para encadenar extracciones que el agente
 * derive en respuesta a este turno.
 */
export async function persistirTurnoUsuario(
  input: PersistirTurnoUsuarioInput
): Promise<PersistirTurnoResult> {
  const [row] = await db.execute<{ id: string; numero_turno: number }>(sql`
    INSERT INTO turnos_conversacion
      (sesion_id, numero_turno, rol, contenido_texto, fuente)
    SELECT
      ${input.sesion_id}::uuid,
      COALESCE(MAX(numero_turno), 0) + 1,
      'usuario'::rol_turno,
      ${input.contenido_texto},
      ${input.fuente}::fuente_turno
    FROM turnos_conversacion
    WHERE sesion_id = ${input.sesion_id}::uuid
    RETURNING id, numero_turno
  `);
  if (!row) {
    throw new Error('persistirTurnoUsuario: INSERT no retornó fila');
  }
  return { turno_id: row.id, numero_turno: Number(row.numero_turno) };
}

// =============================================================================
// persistirTurnoAgente
// =============================================================================

export interface PersistirTurnoAgenteInput {
  sesion_id: string;
  contenido_texto: string;
  fuente: 'sonnet_genera' | 'opus_caso_sintetico';
  modelo_llm: string; // 'claude-sonnet-4-6' | 'claude-opus-4-7'
  tokens_input?: number;
  tokens_output?: number;
  latencia_ms?: number;
}

/**
 * Inserta el turno del AGENTE (Sonnet u Opus). Mismo patrón atómico que
 * `persistirTurnoUsuario`. La estrategia de `app/api/turn/route.ts` es:
 *   - Llamar esta función con `contenido_texto = ''` ANTES del stream para
 *     reservar un `turno_id` al cual anclar las extracciones del primer tool_use.
 *   - Al cierre del stream, actualizar `contenido_texto` con la respuesta
 *     acumulada de Sonnet (function `actualizarContenidoTurnoAgente` abajo).
 *
 * Esta forma de "placeholder al inicio + UPDATE al final" mantiene la integridad
 * de la FK `extracciones.turno_id` sin tener que bufferear extracciones en
 * memoria por toda la duración del stream (alternativa equivalente pero más
 * frágil ante crashes mid-stream).
 */
export async function persistirTurnoAgente(
  input: PersistirTurnoAgenteInput
): Promise<PersistirTurnoResult> {
  const [row] = await db.execute<{ id: string; numero_turno: number }>(sql`
    INSERT INTO turnos_conversacion
      (sesion_id, numero_turno, rol, contenido_texto, fuente,
       modelo_llm, tokens_input, tokens_output, latencia_ms)
    SELECT
      ${input.sesion_id}::uuid,
      COALESCE(MAX(numero_turno), 0) + 1,
      'agente'::rol_turno,
      ${input.contenido_texto},
      ${input.fuente}::fuente_turno,
      ${input.modelo_llm},
      ${input.tokens_input ?? null}::integer,
      ${input.tokens_output ?? null}::integer,
      ${input.latencia_ms ?? null}::integer
    FROM turnos_conversacion
    WHERE sesion_id = ${input.sesion_id}::uuid
    RETURNING id, numero_turno
  `);
  if (!row) {
    throw new Error('persistirTurnoAgente: INSERT no retornó fila');
  }
  return { turno_id: row.id, numero_turno: Number(row.numero_turno) };
}

/**
 * Actualiza `contenido_texto` (y opcionalmente las métricas de tokens/latencia)
 * de un turno agente que se persistió como placeholder. Usado por el route
 * handler al cerrar el stream con la respuesta acumulada.
 */
export async function actualizarContenidoTurnoAgente(input: {
  turno_id: string;
  contenido_texto: string;
  tokens_input?: number;
  tokens_output?: number;
  latencia_ms?: number;
}): Promise<void> {
  await db
    .update(turnos_conversacion)
    .set({
      contenido_texto: input.contenido_texto,
      ...(input.tokens_input !== undefined ? { tokens_input: input.tokens_input } : {}),
      ...(input.tokens_output !== undefined ? { tokens_output: input.tokens_output } : {}),
      ...(input.latencia_ms !== undefined ? { latencia_ms: input.latencia_ms } : {}),
    })
    .where(eq(turnos_conversacion.id, input.turno_id));
}

// =============================================================================
// persistirExtraccionesBatch
// =============================================================================

export interface ExtraccionInput {
  caja_codigo: string;
  valor: unknown;
  confianza: number;
  evidencia_textual: string;
}

export interface ExtraccionPersistedResult {
  caja_codigo: string;
  extraccion_id: string;
  /** Solo presente si esta extracción supersedió a una previa. */
  supersedido_id?: string;
}

export interface PersistirExtraccionesBatchInput {
  sesion_id: string;
  turno_id: string;
  extracciones: ExtraccionInput[];
}

/**
 * Persiste un batch de extracciones con supersede chain en transacción.
 *
 * Para cada extracción `e` (en orden de input):
 *   1. Resuelve `valorSchemaFor(e.caja_codigo)` y valida `e.valor`.
 *      Si falla → arroja `ExtraccionInvalidaError` (rollback de toda la
 *      transacción).
 *   2. Inserta nueva fila en `extracciones` con `fuente='llm'`, anclada al
 *      `turno_id`.
 *   3. Settea `superseded_by = nueva_id` en la previa NO superseded (si existe)
 *      para `(sesion_id, caja_codigo)`.
 *
 * Determinismo en duplicados intra-batch: si el batch trae dos extracciones
 * para la misma caja, la primera se persiste, luego la segunda se persiste y
 * supersede a la primera en la misma transacción. Resultado neto: solo la
 * última tiene `superseded_by IS NULL`.
 */
export async function persistirExtraccionesBatch(
  input: PersistirExtraccionesBatchInput
): Promise<ExtraccionPersistedResult[]> {
  const { sesion_id, turno_id } = input;

  // Drizzle expone .transaction() con el mismo shape de db dentro del callback.
  // Si el callback arroja, la lib rollback automáticamente.
  return await db.transaction(async (tx) => {
    const out: ExtraccionPersistedResult[] = [];

    for (let i = 0; i < input.extracciones.length; i++) {
      const e = input.extracciones[i];

      // Paso 1: validar valor contra el sub-schema de la caja.
      const subSchema = valorSchemaFor(e.caja_codigo);
      const parsed = subSchema.safeParse(e.valor);
      if (!parsed.success) {
        throw new ExtraccionInvalidaError({
          caja_codigo: e.caja_codigo,
          indice: i,
          causa: parsed.error,
        });
      }

      // Paso 2: insertar la nueva extracción.
      const [inserted] = await tx
        .insert(extracciones)
        .values({
          sesion_id,
          turno_id,
          caja_codigo: e.caja_codigo,
          valor: parsed.data as unknown as object,
          confianza: e.confianza,
          fuente: 'llm',
          evidencia_textual: e.evidencia_textual,
        })
        .returning({ id: extracciones.id });
      if (!inserted) {
        throw new Error(
          `persistirExtraccionesBatch: INSERT no retornó fila para caja=${e.caja_codigo}`
        );
      }
      const nuevaId = inserted.id;

      // Paso 3: supersedeo. Buscamos extracciones previas para esta caja en
      // esta sesión que NO estén ya superseded y que NO sean la que acabamos
      // de insertar. Si hay alguna (en MVP debería haber a lo sumo 1, pero
      // somos defensivos), las marcamos.
      const supersedidas = await tx
        .update(extracciones)
        .set({ superseded_by: nuevaId })
        .where(
          and(
            eq(extracciones.sesion_id, sesion_id),
            eq(extracciones.caja_codigo, e.caja_codigo),
            isNull(extracciones.superseded_by),
            // Nunca nos auto-supersedeamos en el mismo paso.
            // (eq id != nuevaId) — usamos sql para "<>"
            sql`${extracciones.id} <> ${nuevaId}`
          )
        )
        .returning({ id: extracciones.id });

      // Para el shape de retorno: si hubo más de una previa supersedida (caso
      // patológico), reportamos la primera. El historial completo queda en DB.
      const result: ExtraccionPersistedResult = {
        caja_codigo: e.caja_codigo,
        extraccion_id: nuevaId,
      };
      if (supersedidas.length > 0) {
        result.supersedido_id = supersedidas[0].id;
      }
      out.push(result);
    }

    return out;
  });
}
