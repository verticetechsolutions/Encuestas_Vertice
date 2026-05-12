'use server';

import { db } from '@/lib/db';
import { instituciones } from '@/db/schema';
import { countCajasAplicables } from '@/lib/schemas/cajas';
import {
  CrearInstitucionInputSchema,
  type CrearInstitucionInput,
  type CrearInstitucionResult,
} from '@/lib/auth/contracts';

// Mirrors the 5 id_* cajas of CAJAS_CANON. The admin (Vértice team) fills these on
// invitation; the entrevistado just confirms `id_anios_operacion` later (D1 signoff).
export async function crearInstitucion(
  input: CrearInstitucionInput
): Promise<CrearInstitucionResult> {
  const parsed = CrearInstitucionInputSchema.parse(input);
  const cajas_aplicables = countCajasAplicables(parsed.tipo);
  const [row] = await db
    .insert(instituciones)
    .values({
      razon_social: parsed.razon_social,
      nombre_comercial: parsed.nombre_comercial,
      tipo: parsed.tipo,
      email_contacto: parsed.email_contacto,
      telefono_contacto: parsed.telefono_contacto,
    })
    .returning({ id: instituciones.id });
  return { institucion_id: row.id, cajas_aplicables };
}
