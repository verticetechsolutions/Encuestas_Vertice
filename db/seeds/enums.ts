// Closed lists referenced by cajas. Source: IMPLEMENTATION.md §5.2.1, §5.2.3.
// These are TS constants (not DB rows) — used by Zod schemas in Phase 3,
// dropdown options in the admin UI, and validation at the engine layer.

import { tipoInstitucionEnum } from '@/db/schema';

// 15 productos (incluye `otro`)
export const PRODUCTOS = [
  'crédito_simple',
  'crédito_revolvente',
  'crédito_hipotecario_empresarial',
  'crédito_puente',
  'crédito_construcción',
  'crédito_bimoneda',
  'factoraje_con_recurso',
  'factoraje_sin_recurso',
  'arrendamiento_puro',
  'arrendamiento_financiero',
  'confirming',
  'cobertura_cambiaria',
  'cartas_crédito',
  'avales_fianzas',
  'otro',
] as const;
export type Producto = (typeof PRODUCTOS)[number];

// 15 sectores (incluye `otro`)
export const SECTORES = [
  'construcción_inmobiliario',
  'transporte_logística',
  'manufactura',
  'agroindustria',
  'comercio_mayoreo',
  'comercio_menudeo',
  'servicios_profesionales',
  'salud',
  'tecnología',
  'energía',
  'minería',
  'turismo',
  'educación',
  'gobierno',
  'otro',
] as const;
export type Sector = (typeof SECTORES)[number];

// 10 zonas geográficas
export const ZONAS = [
  'nacional',
  'cdmx_edomex',
  'bajío',
  'occidente',
  'norte',
  'frontera',
  'sureste',
  'centro',
  'sur',
  'pacífico',
] as const;
export type Zona = (typeof ZONAS)[number];

// 8 tipos de garantía
export const TIPOS_GARANTIA = [
  'hipotecaria_inmueble',
  'prendaria_maquinaria',
  'prendaria_inventario',
  'cesion_derechos',
  'fideicomiso_garantia',
  'aval_patrimonial',
  'cartas_credito_standby',
  'otro',
] as const;
export type TipoGarantia = (typeof TIPOS_GARANTIA)[number];

// Tipos de institución — derivado del pgEnum en db/schema.ts (single source of truth).
// IFPE intencionalmente NO incluida (Ley Fintech art. 22).
export const TIPOS_INSTITUCION = tipoInstitucionEnum.enumValues;
export type TipoInstitucionConst = (typeof TIPOS_INSTITUCION)[number];
