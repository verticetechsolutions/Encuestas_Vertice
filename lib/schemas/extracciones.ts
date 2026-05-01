// Zod source of truth for extracciones.
// Mirrors the `extracciones` DB row and exposes per-caja value sub-schemas the motor
// uses to validate `valor` (jsonb) once it knows which caja was extracted.
//
// Design:
//   - `ExtraccionSchema` validates the envelope with `valor: z.unknown()`.
//   - `valorSchemaFor(caja_codigo)` returns the right sub-schema for the value.
//     Consumers call `parseExtraccion(raw)` (envelope + value in one shot) or use the
//     two-step parse explicitly when streaming partial results from the LLM.
//   - `version` is explicit (1, 2, 3...) in addition to `superseded_by` self-FK so
//     supersede chains are debuggable without recursive joins.
//   - `caja_codigo` is `text` in the DB by design (v2 cajas no migration). This module
//     enforces the runtime catalog check; unknown cajas fall through to z.unknown()
//     so the motor can still persist + flag, instead of crashing.

import { z } from 'zod';
import { CAJAS_CANON, getCajaAny, type TipoDato } from './cajas';

// =============================================================================
// Per-caja value sub-schemas
// =============================================================================

// to_* (5 cajas) — texto descriptivo libre estructurado por las "señales a escuchar"
// del system prompt de Sonnet (ver IMPLEMENTATION.md §5.2.6 + §7.1).
export const ToleranciaSchema = z.string().min(1, { message: 'tolerancia no puede estar vacía' });
export type Tolerancia = z.infer<typeof ToleranciaSchema>;

// se_* (5 cajas) — enum + condiciones. `condiciones` requerido sii respuesta = 'condicional'.
// D3 founder signoff 2026-04-30: refine en Zod, NO discriminated union en el type.
export const RespuestaSituacionEspecialSchema = z.enum(['si', 'no', 'condicional', 'no_aplica']);
export type RespuestaSituacionEspecial = z.infer<typeof RespuestaSituacionEspecialSchema>;

export const SituacionEspecialSchema = z
  .object({
    respuesta: RespuestaSituacionEspecialSchema,
    condiciones: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.respuesta !== 'condicional' || (d.condiciones !== undefined && d.condiciones.length > 0),
    { message: 'condiciones es requerido cuando respuesta = condicional', path: ['condiciones'] }
  );
export type SituacionEspecial = z.infer<typeof SituacionEspecialSchema>;

// co_email_telefono — objeto con email y teléfono validados independientemente.
// Regex MX per IMPLEMENTATION.md §5.2.8 + memoria feedback_resolved_decisions #4.
export const EmailTelefonoSchema = z.object({
  email: z.string().email({ message: 'email inválido' }),
  telefono: z.string().regex(/^\+?52?\s?\d{10}$/, { message: 'teléfono debe ser MX (10 dígitos)' }),
});
export type EmailTelefono = z.infer<typeof EmailTelefonoSchema>;

// op_eeff_auditados — política con monto condicional.
export const EeffAuditadosSchema = z
  .object({
    politica: z.enum(['siempre', 'desde_monto', 'nunca']),
    monto_min_mxn: z.number().int().nonnegative().optional(),
  })
  .refine((d) => d.politica !== 'desde_monto' || d.monto_min_mxn !== undefined, {
    message: 'monto_min_mxn es requerido cuando politica = desde_monto',
    path: ['monto_min_mxn'],
  });
export type EeffAuditados = z.infer<typeof EeffAuditadosSchema>;

// pc_tasas_por_producto — tabla producto → {min, max, cat?} en tasa anual %.
const TasaEntradaSchema = z
  .object({
    min_pct: z.number().nonnegative(),
    max_pct: z.number().nonnegative(),
    cat_pct: z.number().nonnegative().optional(),
  })
  .refine((d) => d.max_pct >= d.min_pct, { message: 'max_pct debe ser ≥ min_pct', path: ['max_pct'] });
export const TasasPorProductoSchema = z.record(z.string().min(1), TasaEntradaSchema);
export type TasasPorProducto = z.infer<typeof TasasPorProductoSchema>;

// pc_plazos_por_producto — tabla producto → {min_meses, max_meses}.
const PlazoEntradaSchema = z
  .object({
    min_meses: z.number().int().positive(),
    max_meses: z.number().int().positive(),
  })
  .refine((d) => d.max_meses >= d.min_meses, {
    message: 'max_meses debe ser ≥ min_meses',
    path: ['max_meses'],
  });
export const PlazosPorProductoSchema = z.record(z.string().min(1), PlazoEntradaSchema);
export type PlazosPorProducto = z.infer<typeof PlazosPorProductoSchema>;

// =============================================================================
// Generic value sub-schemas (by tipo_dato)
// =============================================================================
// Numeric cajas with "X o no aplica/sin requisito" use null as the sentinel.
// D2 founder signoff 2026-04-30: null/sentinel handling lives here, not in CajaCanonSchema.

export const ValorTextSchema = z.string().min(1);
export const ValorIntSchema = z.number().int().nullable();
export const ValorRealSchema = z.number().nullable();
export const ValorBoolSchema = z.boolean();
export const ValorEnumSchema = z.string().min(1);
export const ValorEnumMultiSchema = z.array(z.string().min(1)).min(1);
export const ValorTablaGenericaSchema = z.record(z.string().min(1), z.unknown());
export const ValorObjetoGenericoSchema = z.record(z.string().min(1), z.unknown());

// =============================================================================
// Resolver: caja_codigo → Zod schema for `valor`
// =============================================================================
// Special cases override generic tipo_dato dispatch.

const SPECIAL_VALOR_SCHEMA: Record<string, z.ZodTypeAny> = {
  // Tolerancias estructuradas (5 cajas to_*)
  to_historial_credito: ToleranciaSchema,
  to_situacion_fiscal: ToleranciaSchema,
  to_ratios_financieros: ToleranciaSchema,
  to_colateral: ToleranciaSchema,
  to_gobierno_documentacion: ToleranciaSchema,

  // Situaciones especiales (5 cajas se_*)
  se_sin_historial: SituacionEspecialSchema,
  se_sat_32d_negativa: SituacionEspecialSchema,
  se_concurso_mercantil: SituacionEspecialSchema,
  se_socios_extranjeros: SituacionEspecialSchema,
  se_pep_estructura: SituacionEspecialSchema,

  // Contacto compuesto
  co_email_telefono: EmailTelefonoSchema,

  // Política con condicional
  op_eeff_auditados: EeffAuditadosSchema,

  // Tablas tipadas
  pc_tasas_por_producto: TasasPorProductoSchema,
  pc_plazos_por_producto: PlazosPorProductoSchema,
};

function genericByTipo(tipo: TipoDato): z.ZodTypeAny {
  switch (tipo) {
    case 'text':
      return ValorTextSchema;
    case 'int':
      return ValorIntSchema;
    case 'real':
      return ValorRealSchema;
    case 'bool':
      return ValorBoolSchema;
    case 'enum':
      return ValorEnumSchema;
    case 'enum_multi':
      return ValorEnumMultiSchema;
    case 'tabla':
      return ValorTablaGenericaSchema;
    case 'objeto':
      return ValorObjetoGenericoSchema;
  }
}

// Resolves CANON + EXTENSION via `getCajaAny`. Extension cajas inherit generic dispatch
// by tipo_dato; only base cajas with composite shapes (to_*, se_*, co_email_telefono,
// op_eeff_auditados, pc_*) get special-cased above.
export function valorSchemaFor(caja_codigo: string): z.ZodTypeAny {
  const special = SPECIAL_VALOR_SCHEMA[caja_codigo];
  if (special) return special;

  const canon = getCajaAny(caja_codigo);
  if (!canon) return z.unknown();
  return genericByTipo(canon.tipo_dato);
}

// =============================================================================
// Envelope schema — mirrors the `extracciones` DB row
// =============================================================================

export const FuenteExtraccionSchema = z.enum(['llm', 'manual']);
export type FuenteExtraccion = z.infer<typeof FuenteExtraccionSchema>;

export const ExtraccionSchema = z.object({
  id: z.string().uuid().optional(),
  sesion_id: z.string().uuid(),
  turno_id: z.string().uuid(),
  caja_codigo: z.string().min(1),
  // Shape depends on caja_codigo. Validate with `valorSchemaFor(caja_codigo).parse(valor)`
  // or use `parseExtraccion(raw)` for combined envelope + value validation.
  valor: z.unknown(),
  confianza: z.number().min(0).max(1),
  fuente: FuenteExtraccionSchema,
  evidencia_textual: z.string().nullable().optional(),
  // Explicit version for debuggability (founder signoff 2026-04-30). Walks alongside
  // `superseded_by` self-FK; both must agree (motor enforces, schema doesn't cross-check).
  version: z.number().int().positive().default(1),
  superseded_by: z.string().uuid().nullable().optional(),
  created_at: z.coerce.date().optional(),
});
export type Extraccion = z.infer<typeof ExtraccionSchema>;

// Combined envelope + per-caja value parse. Returns the fully typed extracción with
// `valor` validated against the right sub-schema.
export function parseExtraccion(raw: unknown): Extraccion & { valor: unknown } {
  const envelope = ExtraccionSchema.parse(raw);
  const valor = valorSchemaFor(envelope.caja_codigo).parse(envelope.valor);
  return { ...envelope, valor };
}

// Sanity check: every special-cased caja_codigo must exist in CANON. Catches typos
// (e.g. renames) at module load instead of runtime mismatches mid-interview.
{
  const canonCodigos = new Set(CAJAS_CANON.map((c) => c.codigo));
  for (const codigo of Object.keys(SPECIAL_VALOR_SCHEMA)) {
    if (!canonCodigos.has(codigo)) {
      throw new Error(
        `extracciones.ts: SPECIAL_VALOR_SCHEMA contiene "${codigo}" que no existe en CAJAS_CANON.`
      );
    }
  }
}
