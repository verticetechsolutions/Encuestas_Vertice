// Canonical catalog of the 49 base cajas (5 identidad + 44 núcleo común) plus the
// extension catalog (32 cajas) for tipo-specific cajas (cb_*, cs_*, csp_*, cc_*,
// ca_*, cf_*, cif_*). Per-tipo applicability is materialized in CAJAS_EXTENSION_POR_TIPO.
//
// Source: IMPLEMENTATION.md §5.1, §5.2, §5.3 (post 2026-04-30 rename of mx_* → to_*).
// `extracciones.caja_codigo` in the DB is text (not enum) so v2 can extend without
// migration; this module is the runtime canon the engine validates against.
//
// `permite_no_aplica` (founder D2 follow-up 2026-04-30): the 6 numeric cajas with
// "X o no aplica" / "X o sin requisito" semantics in §5.2 carry the flag so the
// UI can render a "no aplica" toggle and so completitud counts `null` as filled
// only when the flag is true. Default is false; per-caja overrides below.

import { z } from 'zod';
import { TipoInstitucionSchema, type TipoInstitucion } from './casos';

export const CriticidadSchema = z.enum(['critica', 'blanda']);
export type Criticidad = z.infer<typeof CriticidadSchema>;

// Canonical type tags for caja values. Some IMPLEMENTATION.md "Tipo" cells are
// hybrid (e.g. "int o 'sin requisito'", "enum + condiciones"); they collapse here
// to their dominant runtime shape — null/sentinel handling lives in extracción.
export const TipoDatoSchema = z.enum([
  'text', // free string
  'int', // integer (with possible null sentinel for "sin requisito")
  'real', // float / ratio / percentage
  'bool', // true/false
  'enum', // single closed-list value
  'enum_multi', // array of closed-list values
  'tabla', // matrix indexed by another enum (e.g. producto → {min, max})
  'objeto', // discriminated union or composite (e.g. enum + condiciones)
]);
export type TipoDato = z.infer<typeof TipoDatoSchema>;

export const GrupoUISchema = z.enum([
  'identificacion',
  'productos_y_mercado',
  'numeros_del_negocio',
  'operacion',
  'pricing_y_criterio',
  'contacto_y_especificos',
]);
export type GrupoUI = z.infer<typeof GrupoUISchema>;

export const CajaCanonSchema = z.object({
  codigo: z.string(),
  descripcion: z.string(),
  criticidad: CriticidadSchema,
  tipo_dato: TipoDatoSchema,
  grupo_ui: GrupoUISchema,
  // True for cajas where `null` (no aplica / sin requisito) is a valid filled
  // state. Drives the lateral form's "no aplica" toggle and the completitud
  // counter. Optional in literals (treated as `false` when omitted); the 6
  // §5.2 numeric cajas with explicit "o no aplica" / "o sin requisito"
  // semantics set it to true. Use `permiteNoAplica(codigo)` helper.
  permite_no_aplica: z.boolean().optional(),
});
export type CajaCanon = z.infer<typeof CajaCanonSchema>;

// =============================================================================
// Catalog — 5 identidad + 44 núcleo = 49 cajas
// =============================================================================
// FOUNDER REVIEW: criticidad de los 5 id_* es inferida (IMPLEMENTATION.md §5.1
// no la especifica). Marcadas con `// !inferida` para fácil revisión.

export const CAJAS_CANON: CajaCanon[] = [
  // §5.1 Identidad institucional (5)
  { codigo: 'id_razon_social', descripcion: 'Razón social completa', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'identificacion' }, // !inferida
  { codigo: 'id_nombre_comercial', descripcion: 'Nombre comercial', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'identificacion' }, // !inferida
  { codigo: 'id_tipo_institucion', descripcion: 'Tipo de institución (banco, sofom_er, sofom_enr, sofipo, socap, arrendadora, factoraje, ifc, otro)', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'identificacion' }, // !inferida — drives extensión por tipo
  { codigo: 'id_regulacion', descripcion: 'Regulación vigente (cnbv, condusef, shcp, banxico, uif, ninguna)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'identificacion' }, // !inferida — compliance
  { codigo: 'id_anios_operacion', descripcion: 'Años en operación', criticidad: 'blanda', tipo_dato: 'int', grupo_ui: 'identificacion' }, // !inferida

  // §5.2.1 Producto y mercado (7)
  { codigo: 'nm_productos_ofrecidos', descripcion: 'Productos ofrecidos', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_productos_no_ofrecidos', descripcion: 'Productos NO ofrecidos', criticidad: 'blanda', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_sectores_aceptados', descripcion: 'Sectores que financian activamente', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_sectores_excluidos', descripcion: 'Sectores con rechazo automático', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_sectores_ventaja', descripcion: 'Sectores con ventaja competitiva', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_cobertura_geografica', descripcion: 'Cobertura geográfica (10 zonas MX)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },
  { codigo: 'nm_tipos_cliente', descripcion: 'Tipos de cliente atendidos (PF asalariado, PFAE, PM)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'productos_y_mercado' },

  // §5.2.2 Rangos y umbrales (8)
  { codigo: 'ru_monto_min', descripcion: 'Monto mínimo por operación (MXN)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'ru_monto_max', descripcion: 'Monto máximo por operación (MXN)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'ru_ticket_ideal', descripcion: 'Ticket ideal (int o rango)', criticidad: 'blanda', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'ru_moneda', descripcion: 'Moneda (mxn, usd, bimoneda)', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'ru_antiguedad_min', descripcion: 'Antigüedad mínima del cliente en años (int o "sin requisito")', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },
  { codigo: 'ru_facturacion_min', descripcion: 'Facturación mínima anual MXN (int o "sin requisito")', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },
  { codigo: 'ru_score_pm_min', descripcion: 'Score Buró PM mínimo (300-900 o "no aplica")', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },
  { codigo: 'ru_score_pf_min', descripcion: 'Score Buró PF mínimo del representante legal (300-900)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },

  // §5.2.3 Garantías y ratios financieros (7)
  { codigo: 'gr_tipos_garantia', descripcion: 'Tipos de garantía aceptados (8 tipos)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'gr_cobertura_min', descripcion: 'Cobertura mínima de garantía (ratio)', criticidad: 'critica', tipo_dato: 'real', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'gr_dscr_min', descripcion: 'DSCR mínimo (float o "no usa")', criticidad: 'critica', tipo_dato: 'real', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },
  { codigo: 'gr_deuda_ebitda_max', descripcion: 'Deuda/EBITDA máximo (float o "no usa")', criticidad: 'critica', tipo_dato: 'real', grupo_ui: 'numeros_del_negocio', permite_no_aplica: true },
  { codigo: 'gr_capital_contable_min', descripcion: 'Capital contable mínimo (int o ratio)', criticidad: 'blanda', tipo_dato: 'int', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'gr_caida_facturacion_max', descripcion: 'Caída facturación YoY máxima tolerada (%)', criticidad: 'blanda', tipo_dato: 'real', grupo_ui: 'numeros_del_negocio' },
  { codigo: 'gr_ratios_definitorios', descripcion: 'Top 3 ratios definitorios para esta institución', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'numeros_del_negocio' },

  // §5.2.4 Operación (6)
  { codigo: 'op_tiempo_viabilidad', descripcion: 'Tiempo de respuesta de viabilidad', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'operacion' },
  { codigo: 'op_tiempo_comite', descripcion: 'Tiempo a comité', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'operacion' },
  { codigo: 'op_tiempo_fondeo', descripcion: 'Tiempo desde aprobación a fondeo', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'operacion' },
  { codigo: 'op_frecuencia_comite', descripcion: 'Frecuencia de comité (semanal, quincenal, mensual, por_demanda)', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'operacion' },
  { codigo: 'op_documentacion_estandar', descripcion: 'Documentación estándar requerida', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'operacion' },
  { codigo: 'op_eeff_auditados', descripcion: 'EEFF auditados — política (siempre / desde_monto / nunca + monto si aplica)', criticidad: 'blanda', tipo_dato: 'objeto', grupo_ui: 'operacion' },

  // §5.2.5 Pricing y conversión (4)
  { codigo: 'pc_tasas_por_producto', descripcion: 'Tasa típica por producto (tabla producto → min/max/CAT)', criticidad: 'critica', tipo_dato: 'tabla', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'pc_plazos_por_producto', descripcion: 'Plazos por producto en meses (tabla producto → min/max)', criticidad: 'critica', tipo_dato: 'tabla', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'pc_reglas_pricing', descripcion: 'Qué mueve la tasa hacia arriba/abajo', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'pc_conversion_producto', descripcion: 'Reglas "si pide X con perfil Y, ofrecemos Z"', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },

  // §5.2.6 Tolerancias estructuradas (5)
  { codigo: 'to_historial_credito', descripcion: 'Tolerancia a manchas/retrasos en buró, restructuras, días de mora aceptables', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'to_situacion_fiscal', descripcion: 'Tolerancia a 32-D negativa, EFOS recientes, RESICO, irregularidades SAT', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'to_ratios_financieros', descripcion: 'Umbrales blandos en DSCR, deuda/EBITDA, capital de trabajo, márgenes', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'to_colateral', descripcion: 'Flexibilidad en LTV, tipos de garantía aceptables, prendas, avales solidarios', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'to_gobierno_documentacion', descripcion: 'Tolerancia en gobierno corporativo, EEFF sin auditoría, acta sin protocolizar', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'pricing_y_criterio' },

  // §5.2.7 Situaciones especiales (5) — todas son enum + condiciones → 'objeto'
  { codigo: 'se_sin_historial', descripcion: '¿Aceptan clientes sin historial crediticio? (enum + condiciones)', criticidad: 'critica', tipo_dato: 'objeto', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'se_sat_32d_negativa', descripcion: '¿Aceptan opinión SAT 32-D negativa? (enum + condiciones)', criticidad: 'critica', tipo_dato: 'objeto', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'se_concurso_mercantil', descripcion: '¿Aceptan empresas con concurso mercantil concluido? (enum + condiciones)', criticidad: 'blanda', tipo_dato: 'objeto', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'se_socios_extranjeros', descripcion: '¿Aceptan socios extranjeros >49%? (enum + condiciones)', criticidad: 'blanda', tipo_dato: 'objeto', grupo_ui: 'pricing_y_criterio' },
  { codigo: 'se_pep_estructura', descripcion: '¿Aceptan PEP en estructura accionaria? (enum + condiciones)', criticidad: 'critica', tipo_dato: 'objeto', grupo_ui: 'pricing_y_criterio' },

  // §5.2.8 Contacto (2)
  { codigo: 'co_punto_contacto', descripcion: 'Punto único de contacto (nombre + puesto)', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' },
  { codigo: 'co_email_telefono', descripcion: 'Correo + teléfono directos (objeto {email validado, telefono validado MX})', criticidad: 'critica', tipo_dato: 'objeto', grupo_ui: 'contacto_y_especificos' },
];

// Sanity check at module load: must be exactly 49.
if (CAJAS_CANON.length !== 49) {
  throw new Error(`CAJAS_CANON debe tener 49 entradas (5 identidad + 44 núcleo). Tiene ${CAJAS_CANON.length}.`);
}

// =============================================================================
// Catálogo de extensión por tipo — 32 cajas (§5.3)
// =============================================================================
// FOUNDER REVIEW: criticidad y tipo_dato inferidos (IMPLEMENTATION.md §5.3 sólo da
// código + descripción). Marcadas con `// !inferida`. Todas viven en el grupo UI
// `contacto_y_especificos` per §8.2.

// Banco y SOFOM ER comparten el mismo set cb_* (5 cajas).
const CAJAS_CB: CajaCanon[] = [
  { codigo: 'cb_exposicion_max_grupo', descripcion: 'Exposición máxima por grupo económico (% capital o monto)', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cb_comites_regionales', descripcion: '¿Hay comités regionales? Desde qué monto', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cb_programas_gobierno', descripcion: 'Programas FIRA/NAFIN/Bancomext que operan', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cb_lineas_verdes_esg', descripcion: 'Líneas verdes/ESG dedicadas', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cb_project_finance', descripcion: 'Política sobre project finance', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CS: CajaCanon[] = [
  { codigo: 'cs_scoring_alternativo', descripcion: '¿Usan scoring alternativo? Cuál (CFDI, bancarización, etc.)', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cs_sla_total', descripcion: 'SLA total desde solicitud a fondeo', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cs_integracion_digital', descripcion: 'API/integración digital o solo manual', criticidad: 'blanda', tipo_dato: 'enum', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cs_revolvente_ticket', descripcion: 'Línea revolvente y ticket típico', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cs_vinculo_patrimonial', descripcion: 'Vínculo patrimonial con banco (debería ser "ninguno" — si tiene es ER)', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CSP: CajaCanon[] = [
  { codigo: 'csp_nivel_operativo', descripcion: 'Nivel operativo SOFIPO (I, II, III, IV)', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'csp_captacion', descripcion: '¿Captan ahorro? Productos de captación', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'csp_poblacion_objetivo', descripcion: 'Tipo de población objetivo', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CC: CajaCanon[] = [
  { codigo: 'cc_membresia_requerida', descripcion: '¿Solo crédito a socios o también a no-socios?', criticidad: 'critica', tipo_dato: 'enum', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cc_cuota_minima_socio', descripcion: 'Cuota mínima de socio (MXN)', criticidad: 'blanda', tipo_dato: 'int', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cc_sector_cooperativo', descripcion: 'Sector (rural, magisterial, etc.)', criticidad: 'critica', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CA: CajaCanon[] = [
  { codigo: 'ca_tipos_equipo', descripcion: 'Tipos de equipo aceptados (transporte, maquinaria construcción, médico, TI, etc.)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'ca_marcas_preferidas', descripcion: 'Marcas autorizadas o preferidas', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'ca_valor_residual_min', descripcion: 'Valor residual mínimo aceptable (% o MXN)', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'ca_equipo_importado', descripcion: 'Equipo importado (IMMEX, Pedimento)', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'ca_equipo_usado', descripcion: 'Equipo usado y antigüedad máxima', criticidad: 'blanda', tipo_dato: 'text', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'ca_modalidades', descripcion: 'Operan arrendamiento puro, financiero o ambos', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CF: CajaCanon[] = [
  { codigo: 'cf_tipos_factoraje', descripcion: 'Tipos: con recurso, sin recurso, doméstico, internacional, público', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cf_porcentaje_adelanto', descripcion: '% adelanto típico sobre factura', criticidad: 'critica', tipo_dato: 'real', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cf_tasa_mensual', descripcion: 'Tasa típica mensual (%)', criticidad: 'critica', tipo_dato: 'real', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cf_plazo_max_factura', descripcion: 'Plazo máximo de la factura (días)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cf_sectores_pagadores', descripcion: 'Sectores pagadores aceptados (privado, público, etc.)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cf_concentracion_max_pagador', descripcion: 'Concentración máxima por pagador (%)', criticidad: 'blanda', tipo_dato: 'real', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

const CAJAS_CIF: CajaCanon[] = [
  { codigo: 'cif_tipo_ifc', descripcion: 'Tipo de IFC (deuda, capital, copropiedad, regalías)', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cif_tope_proyecto', descripcion: 'Tope por proyecto (MXN)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cif_tope_inversionista', descripcion: 'Tope por inversionista (MXN)', criticidad: 'critica', tipo_dato: 'int', grupo_ui: 'contacto_y_especificos' }, // !inferida
  { codigo: 'cif_sectores_prohibidos', descripcion: 'Sectores prohibidos por Ley Fintech', criticidad: 'critica', tipo_dato: 'enum_multi', grupo_ui: 'contacto_y_especificos' }, // !inferida
];

// Aplicabilidad por tipo. `banco` y `sofom_er` comparten cb_* (per §5.3 header). `otro`
// no tiene extensión — el motor lo trata como "solo CANON aplica".
export const CAJAS_EXTENSION_POR_TIPO: Record<TipoInstitucion, CajaCanon[]> = {
  banco: CAJAS_CB,
  sofom_er: CAJAS_CB,
  sofom_enr: CAJAS_CS,
  sofipo: CAJAS_CSP,
  socap: CAJAS_CC,
  arrendadora: CAJAS_CA,
  factoraje: CAJAS_CF,
  ifc: CAJAS_CIF,
  otro: [],
};

// Sanity check at module load: 32 distinct extension cajas total.
{
  const distinct = new Set<string>();
  for (const tipo of TipoInstitucionSchema.options) {
    for (const c of CAJAS_EXTENSION_POR_TIPO[tipo]) distinct.add(c.codigo);
  }
  if (distinct.size !== 32) {
    throw new Error(
      `CAJAS_EXTENSION_POR_TIPO debe tener 32 cajas distintas (5+5+3+3+6+6+4). Tiene ${distinct.size}.`
    );
  }
}

// =============================================================================
// Lookup helpers
// =============================================================================

const cajasByCodigo: ReadonlyMap<string, CajaCanon> = new Map(CAJAS_CANON.map((c) => [c.codigo, c]));

const cajasExtensionByCodigo: ReadonlyMap<string, CajaCanon> = new Map(
  // Build once; tipo doesn't matter for the lookup since cajas are unique by código
  // (cb_* shows up under both banco and sofom_er but is the same object).
  Object.values(CAJAS_EXTENSION_POR_TIPO).flat().map((c) => [c.codigo, c])
);

export function getCajaCanon(codigo: string): CajaCanon | undefined {
  return cajasByCodigo.get(codigo);
}

export function getCajaExtension(codigo: string): CajaCanon | undefined {
  return cajasExtensionByCodigo.get(codigo);
}

// Combined lookup — CANON first, then any extension caja. Use this when you don't
// know whether a caja is base or tipo-specific (e.g. `extracciones.caja_codigo` validation).
export function getCajaAny(codigo: string): CajaCanon | undefined {
  return cajasByCodigo.get(codigo) ?? cajasExtensionByCodigo.get(codigo);
}

export function isCajaCriticaCanon(codigo: string): boolean {
  return getCajaAny(codigo)?.criticidad === 'critica';
}

export function permiteNoAplica(codigo: string): boolean {
  return getCajaAny(codigo)?.permite_no_aplica === true;
}

export function getCajasByGrupoUI(grupo: GrupoUI): CajaCanon[] {
  return CAJAS_CANON.filter((c) => c.grupo_ui === grupo);
}

// Returns the full set of cajas applicable to a given tipo: CANON + EXTENSION[tipo].
// Used at session creation to compute `sesiones.cajas_aplicables` (the pinned denominator).
export function getCajasAplicables(tipo: TipoInstitucion): CajaCanon[] {
  return [...CAJAS_CANON, ...CAJAS_EXTENSION_POR_TIPO[tipo]];
}

export function countCajasAplicables(tipo: TipoInstitucion): number {
  return CAJAS_CANON.length + CAJAS_EXTENSION_POR_TIPO[tipo].length;
}
