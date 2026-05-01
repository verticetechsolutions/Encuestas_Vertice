// Zod is the source of truth for the synthetic-case shape.
// Types are derived via z.infer so type and runtime validator never desync.

import { z } from 'zod';
import { tipoInstitucionEnum } from '@/db/schema';

// Mirror the pgEnum values one-to-one
export const TipoInstitucionSchema = z.enum(tipoInstitucionEnum.enumValues);
export type TipoInstitucion = z.infer<typeof TipoInstitucionSchema>;

export const DecisionEsperadaSchema = z.enum(['acepta', 'rechaza', 'con_condiciones']);
export type DecisionEsperada = z.infer<typeof DecisionEsperadaSchema>;

export const OpinionSATSchema = z.enum(['positiva', 'negativa', 'no_aplica']);
export type OpinionSAT = z.infer<typeof OpinionSATSchema>;

// Partial<Record<TipoInstitucion, DecisionEsperada>> in Zod form.
// All 9 keys explicit + .partial() yields { banco?: D; sofom_er?: D; ... } which is
// structurally equivalent to Partial<Record<TipoInstitucion, DecisionEsperada>>.
const DecisionEsperadaPorTipoSchema = z
  .object({
    banco: DecisionEsperadaSchema,
    sofom_er: DecisionEsperadaSchema,
    sofom_enr: DecisionEsperadaSchema,
    sofipo: DecisionEsperadaSchema,
    socap: DecisionEsperadaSchema,
    arrendadora: DecisionEsperadaSchema,
    factoraje: DecisionEsperadaSchema,
    ifc: DecisionEsperadaSchema,
    otro: DecisionEsperadaSchema,
  })
  .partial();

export const NecesidadSchema = z.object({
  destino: z.string(),
  desglose: z.string(),
  urgencia: z.string(),
});

export const SituacionFinancieraSchema = z.object({
  facturacion_mensual_mxn: z.number(),
  facturacion_anual_mxn: z.number(),
  gastos_fijos_mxn: z.number(),
  pasivos_vigentes: z.string(),
  pago_estimado_mxn: z.number(),
  plazo_meses: z.number(),
});

export const HistorialCrediticioSchema = z.object({
  antiguedad_anos: z.number(),
  retrasos: z.string(),
  score_buro_pm: z.number().nullable(),
  score_buro_pf: z.number().nullable(),
  opinion_sat_32d: OpinionSATSchema,
});

export const GarantiaItemSchema = z.object({
  tipo: z.string(),
  valor_mxn: z.number(),
});

export const GarantiasSchema = z.object({
  items: z.array(GarantiaItemSchema),
  suma_mxn: z.number(),
  cobertura_x: z.number(),
});

export const CasoSinteticoSchema = z.object({
  id: z.string(), // ej. "CASO-032"
  titulo: z.string(),
  resumen_ejecutivo: z.string(),
  sector: z.string(),
  tipo_credito: z.string(),
  monto_solicitado_mxn: z.number(),
  necesidad: NecesidadSchema,
  situacion_financiera: SituacionFinancieraSchema,
  historial_crediticio: HistorialCrediticioSchema,
  garantias: GarantiasSchema,
  complicaciones: z.array(z.string()),
  documentacion_disponible: z.array(z.string()),

  // Vértice metadata — added when curating, not in PDF
  cajas_objetivo: z.array(z.string()),
  decision_esperada_por_tipo: DecisionEsperadaPorTipoSchema.optional(),
});

export type CasoSintetico = z.infer<typeof CasoSinteticoSchema>;
