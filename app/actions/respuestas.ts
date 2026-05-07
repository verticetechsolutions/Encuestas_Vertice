'use server';

// Server Action that autosaves the user's draft answer for a single pregunta in
// the current batch. Persistence target is `sesiones.metadata.borrador_respuestas`
// (jsonb) — we don't want a dedicated table for volatile drafts. Atomic merge via
// `jsonb_build_object`/`||` so concurrent updates from multiple PreguntaCard
// debounces don't clobber each other.
//
// The store dispatches this with a 1.5s debounce per pregunta (memoria
// feedback_resolved_decisions §6 autosave_1.5s). Failures DO NOT block the user —
// the caller logs and moves on; the user's typing in the textarea is still
// intact in the Zustand store, and a successful next save will overwrite.

import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { sesiones } from '@/db/schema';
import {
  GuardarRespuestaPendienteInputSchema,
  type GuardarRespuestaPendienteInput,
  type GuardarRespuestaPendienteResult,
} from './respuestas.contracts';
import { logger } from '@/lib/observability/axiom';

export async function guardarRespuestaPendiente(
  raw: GuardarRespuestaPendienteInput
): Promise<GuardarRespuestaPendienteResult> {
  const parsed = GuardarRespuestaPendienteInputSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('respuesta.input_invalido', {
      error: parsed.error.message,
    });
    return { ok: false, error: 'input_invalido' };
  }
  const { sesion_id, pregunta_id, texto } = parsed.data;

  // Verificar que la sesión existe y está abierta. No bloqueamos en
  // `consentimiento_at` — si llegamos hasta acá el cliente ya pasó la gate.
  const [sesion] = await db
    .select({ status: sesiones.status })
    .from(sesiones)
    .where(eq(sesiones.id, sesion_id))
    .limit(1);
  if (!sesion || sesion.status !== 'abierta') {
    return { ok: false, error: 'sesion_no_disponible' };
  }

  // Atomic merge dentro del jsonb metadata. Generamos:
  //   metadata = COALESCE(metadata, '{}') || jsonb_build_object(
  //     'borrador_respuestas',
  //     COALESCE(metadata->'borrador_respuestas', '{}') || jsonb_build_object(<pregunta_id>, <texto>)
  //   )
  // Así múltiples preguntas debouncing en paralelo no pisan keys distintos.
  try {
    await db
      .update(sesiones)
      .set({
        metadata: sql`COALESCE(${sesiones.metadata}, '{}'::jsonb) || jsonb_build_object(
          'borrador_respuestas',
          COALESCE(${sesiones.metadata} -> 'borrador_respuestas', '{}'::jsonb) || jsonb_build_object(${pregunta_id}::text, ${texto}::text)
        )`,
      })
      .where(eq(sesiones.id, sesion_id));
  } catch (err) {
    logger.warn('respuesta.persistencia_fallida', {
      sesion_id,
      pregunta_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: 'sesion_no_disponible' };
  }

  return { ok: true, guardado_at: new Date().toISOString() };
}
