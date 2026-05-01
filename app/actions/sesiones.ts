'use server';

import { db } from '@/lib/db';
import { sesiones, instituciones } from '@/db/schema';
import { countCajasAplicables } from '@/lib/schemas/cajas';
import { eq, and } from 'drizzle-orm';
import type { CrearOReanudarSesionResult } from '@/lib/auth/contracts';

// Reanuda la última sesión `abierta` de la institución, o crea una nueva si no hay.
// Una institución puede acumular sesiones cerradas (completas/abandonadas); la abierta
// es siempre única — el motor de cierre fuerza estado terminal antes de iniciar otra.
export async function crearOReanudarSesion(
  institucion_id: string
): Promise<CrearOReanudarSesionResult> {
  const abierta = await db
    .select({ id: sesiones.id })
    .from(sesiones)
    .where(and(eq(sesiones.institucion_id, institucion_id), eq(sesiones.status, 'abierta')))
    .limit(1);
  if (abierta.length > 0) {
    return { sesion_id: abierta[0].id, reanudada: true };
  }

  const [inst] = await db
    .select({ tipo: instituciones.tipo })
    .from(instituciones)
    .where(eq(instituciones.id, institucion_id))
    .limit(1);
  if (!inst) throw new Error(`institucion_id ${institucion_id} no encontrada`);
  const cajas_aplicables = countCajasAplicables(inst.tipo);

  const [nueva] = await db
    .insert(sesiones)
    .values({
      institucion_id,
      cajas_aplicables,
    })
    .returning({ id: sesiones.id });
  return { sesion_id: nueva.id, reanudada: false };
}

export async function registrarConsentimiento(sesion_id: string): Promise<void> {
  await db
    .update(sesiones)
    .set({ consentimiento_at: new Date() })
    .where(eq(sesiones.id, sesion_id));
}
