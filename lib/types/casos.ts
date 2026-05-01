// Canonical shape for synthetic / curated cases.
// In Phase 3 the matching Zod schema will be added in lib/schemas/caso_sintetico.ts;
// `z.infer<typeof casoSinteticoSchema>` MUST equal `CasoSintetico` 1:1.

import { tipoInstitucionEnum } from '@/db/schema';

export type TipoInstitucion = (typeof tipoInstitucionEnum.enumValues)[number];

export type DecisionEsperada = 'acepta' | 'rechaza' | 'con_condiciones';

export type OpinionSAT = 'positiva' | 'negativa' | 'no_aplica';

export interface CasoSintetico {
  id: string; // ej. "CASO-032"
  titulo: string;
  resumen_ejecutivo: string; // 1-2 frases para la card
  sector: string; // ej. "Comercio y distribución"
  tipo_credito: string; // ej. "Crédito simple quirografario"
  monto_solicitado_mxn: number;

  necesidad: {
    destino: string;
    desglose: string;
    urgencia: string;
  };

  situacion_financiera: {
    facturacion_mensual_mxn: number;
    facturacion_anual_mxn: number;
    gastos_fijos_mxn: number;
    pasivos_vigentes: string;
    pago_estimado_mxn: number;
    plazo_meses: number;
  };

  historial_crediticio: {
    antiguedad_anos: number;
    retrasos: string;
    score_buro_pm: number | null;
    score_buro_pf: number | null;
    opinion_sat_32d: OpinionSAT;
  };

  garantias: {
    items: Array<{ tipo: string; valor_mxn: number }>;
    suma_mxn: number;
    cobertura_x: number;
  };

  complicaciones: string[];
  documentacion_disponible: string[];

  // Vértice metadata — not from PDF, added when curating
  cajas_objetivo: string[]; // ej. ["to_historial_credito", "ru_monto_max"]
  decision_esperada_por_tipo?: Partial<Record<TipoInstitucion, DecisionEsperada>>;
}
