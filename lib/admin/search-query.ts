// Helpers para el route handler /admin/api/search.
//
// sanitizeQuery: trim + cap de longitud + escape de wildcards LIKE para que el
// usuario no pueda inyectar `%` o `_` y forzar match cualquiera.
// isUuidish: detecta si el query parece un UUID parcial — sólo entonces
// disparamos la query contra `sesiones.id::text ILIKE`.

export const SEARCH_MIN_LEN = 2;
export const SEARCH_MAX_LEN = 100;

export function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, SEARCH_MAX_LEN)
    .replace(/[%_\\]/g, '\\$&');
}

const UUIDISH_RE = /^[0-9a-f-]{4,36}$/i;

export function isUuidish(q: string): boolean {
  return UUIDISH_RE.test(q);
}
