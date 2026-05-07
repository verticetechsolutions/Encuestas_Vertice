// Types and Zod schemas for the respuesta-related server actions.
// Lives outside `app/actions/respuestas.ts` because Next 15 `'use server'` files
// may only export async functions — types, interfaces, and Zod schemas have to
// live elsewhere (memoria feedback_use_server_only_async).

import { z } from 'zod';

// Stored shape inside `sesiones.metadata.borrador_respuestas`.
// Keys are batch pregunta_ids (opaque strings); values are the user-typed text.
export const BorradorRespuestasMapSchema = z.record(z.string(), z.string());
export type BorradorRespuestasMap = z.infer<typeof BorradorRespuestasMapSchema>;

// Input for guardarRespuestaPendiente.
export const GuardarRespuestaPendienteInputSchema = z.object({
  sesion_id: z.string().uuid(),
  pregunta_id: z.string().min(1),
  // Empty string is allowed: it represents the user clearing their draft.
  texto: z.string().max(20_000),
});
export type GuardarRespuestaPendienteInput = z.infer<
  typeof GuardarRespuestaPendienteInputSchema
>;

export type GuardarRespuestaPendienteResult =
  | { ok: true; guardado_at: string }
  | { ok: false; error: 'sesion_no_disponible' | 'input_invalido' };
