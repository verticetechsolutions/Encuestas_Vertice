// Preview UI mode — refresca cuantas veces quieras sin tokens, cookies, DB
// ni /api/turn. Renderiza el shell con `preview=true` que apaga autosave y
// stub-ea enviarBatch (rota fixture y mueve panel).
//
// Por qué existe esta ruta:
//   El flujo prod (magic link → bienvenida → consent → /entrevista/{id}) es
//   single-use, gated por middleware con cookie + sesion_id, y vulnerable al
//   "primer compile lag" en dev (~30-50s). Esa cadena rompe el loop "edito
//   tailwind → recargo → veo cambios". Esta ruta vive fuera de
//   /entrevista/* para esquivar el middleware y no toca DB.
//
//   404 en producción (NODE_ENV=production) — solo dev.

import { notFound } from 'next/navigation';
import {
  CAJAS_CANON,
  CAJAS_EXTENSION_POR_TIPO,
  GrupoUISchema,
  type GrupoUI,
} from '@/lib/schemas/cajas';
import { EntrevistaShell } from '../../entrevista/[sesion_id]/entrevista-shell';

function totalesParaTipoBanco(): Record<GrupoUI, number> {
  const out = {} as Record<GrupoUI, number>;
  for (const g of GrupoUISchema.options) out[g] = 0;
  for (const c of CAJAS_CANON) out[c.grupo_ui]++;
  for (const c of CAJAS_EXTENSION_POR_TIPO.banco ?? []) out[c.grupo_ui]++;
  return out;
}

export default function PreviewUIPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <EntrevistaShell
      sesion_id="00000000-0000-0000-0000-000000000000"
      nombre_institucion="Banco Demo"
      totales_por_grupo={totalesParaTipoBanco()}
      preview
    />
  );
}
