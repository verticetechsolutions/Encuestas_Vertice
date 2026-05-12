// Types and Zod schemas shared by the auth-related server actions.
// Lives outside `app/actions/*` because Next 15 `'use server'` files may only
// export async functions — types, interfaces, and Zod schemas have to live elsewhere.

import { z } from 'zod';
import { TipoInstitucionSchema } from '@/lib/schemas/casos';

// ---- crearInstitucion -------------------------------------------------------
// Validación liviana del teléfono — tolerante a variantes (+52, lada, espacios,
// guiones, ext). Mínimo 6 dígitos para descartar typos accidentales.
const TelefonoSchema = z
  .string()
  .nullable()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : null))
  .refine(
    (v) => v === null || /[\d]{6,}/.test(v.replace(/\D/g, '')),
    { message: 'Teléfono inválido: incluye al menos 6 dígitos.' }
  );

export const CrearInstitucionInputSchema = z.object({
  razon_social: z.string().min(1),
  nombre_comercial: z.string().min(1).nullable(),
  tipo: TipoInstitucionSchema,
  email_contacto: z.string().email(),
  telefono_contacto: TelefonoSchema,
});
export type CrearInstitucionInput = z.infer<typeof CrearInstitucionInputSchema>;

export interface CrearInstitucionResult {
  institucion_id: string;
  cajas_aplicables: number;
}

// ---- editarInstitucion ------------------------------------------------------
// Todos los campos opcionales (parcial), pero al menos uno requerido. El id
// va por separado (no es editable).
export const EditarInstitucionInputSchema = z
  .object({
    razon_social: z.string().min(1).optional(),
    nombre_comercial: z.string().min(1).nullable().optional(),
    tipo: TipoInstitucionSchema.optional(),
    email_contacto: z.string().email().optional(),
    telefono_contacto: TelefonoSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Sin cambios — provee al menos un campo.',
  });
export type EditarInstitucionInput = z.infer<typeof EditarInstitucionInputSchema>;

// ---- crearOReanudarSesion ---------------------------------------------------
export interface CrearOReanudarSesionResult {
  sesion_id: string;
  reanudada: boolean;
}

// ---- emitirMagicLink --------------------------------------------------------
export interface EmitirMagicLinkOptions {
  // En modo dry-run no manda email; devuelve la URL para que el caller la imprima
  // (útil cuando RESEND_API_KEY no está configurada todavía).
  dryRun?: boolean;
}

export interface EmitirMagicLinkResult {
  url: string;
  enviado: boolean;
  expires_at: Date;
  // Email al que se envió (modo email) o se hubiera enviado (dry-run).
  // Permite al caller mostrar "Enviado a contacto@x.com" sin re-query.
  email_contacto: string;
}

// ---- verificarMagicLink -----------------------------------------------------
export type VerificarMagicLinkOutcome =
  | { ok: true; sesion_id: string; reanudada: boolean }
  | { ok: false; razon: 'token_invalido' | 'expirado' | 'consumido' | 'institucion_no_encontrada' | 'revocado' };
