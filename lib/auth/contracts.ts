// Types and Zod schemas shared by the auth-related server actions.
// Lives outside `app/actions/*` because Next 15 `'use server'` files may only
// export async functions — types, interfaces, and Zod schemas have to live elsewhere.

import { z } from 'zod';
import { TipoInstitucionSchema } from '@/lib/schemas/casos';

// ---- crearInstitucion -------------------------------------------------------
export const CrearInstitucionInputSchema = z.object({
  razon_social: z.string().min(1),
  nombre_comercial: z.string().min(1).nullable(),
  tipo: TipoInstitucionSchema,
  email_contacto: z.string().email(),
});
export type CrearInstitucionInput = z.infer<typeof CrearInstitucionInputSchema>;

export interface CrearInstitucionResult {
  institucion_id: string;
  cajas_aplicables: number;
}

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
