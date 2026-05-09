// FIELD_LABELS — map código → descripción humana, derivado de CAJAS_CANON
// + CAJAS_EXTENSION_POR_TIPO. Single source of truth: el catálogo Zod en
// schemas/cajas.ts ya tiene `descripcion` por caja, así que no duplicamos.
//
// Uso típico: en el right rail de la encuesta, donde antes mostrábamos
// `<code>nm_productos_ofrecidos</code>` ahora mostramos `getFieldLabel(c)`
// → "Productos ofrecidos".

import { CAJAS_CANON, CAJAS_EXTENSION_POR_TIPO } from './schemas/cajas';

const allCajas = [
  ...CAJAS_CANON,
  ...Object.values(CAJAS_EXTENSION_POR_TIPO).flat(),
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  allCajas.map((caja) => [caja.codigo, caja.descripcion])
);

export function getFieldLabel(codigo: string): string {
  return FIELD_LABELS[codigo] ?? codigo;
}
