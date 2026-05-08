// Helper para parsear el query param `?status=` del índice global de sesiones.
// `VALID_STATUSES` es un espejo manual del enum `sesionStatusEnum` de
// `db/schema.ts` — si ese enum cambia, este archivo debe actualizarse a mano
// (no importamos del schema para mantener el helper puro y libre de dependencias
// transitivas a Drizzle).
// Si el input está vacío o no contiene ningún valor válido, cae al default
// operativo: las sesiones "vivas" (abiertas o en síntesis).

export const VALID_STATUSES = [
  'abierta',
  'pausada',
  'sintetizando',
  'completa',
  'abandonada',
] as const;

export type SesionStatus = (typeof VALID_STATUSES)[number];

const DEFAULT: SesionStatus[] = ['abierta', 'sintetizando'];

export function parseStatusFilter(raw: string | undefined): SesionStatus[] {
  if (!raw) return [...DEFAULT];
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const valid = parts.filter((s): s is SesionStatus =>
    (VALID_STATUSES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : [...DEFAULT];
}
