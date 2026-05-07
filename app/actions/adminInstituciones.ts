'use server';

import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { crearInstitucion } from '@/app/actions/instituciones';
import { emitirMagicLink } from '@/app/actions/auth';
import { CrearInstitucionInputSchema } from '@/lib/auth/contracts';

// State retornado al cliente vía useActionState. Discriminada por `ok` para
// que el form pueda renderizar éxito vs. errores sin null-checks profundos.
export type CrearInstitucionConLinkState =
  | {
      ok: true;
      institucion_id: string;
      cajas_aplicables: number;
      magic_url: string;
      expires_at: string; // ISO — Date no serializa cleanly cross-boundary
    }
  | { ok: false; error: string }
  | { ok: null }; // estado inicial pre-submit

const FormSchema = CrearInstitucionInputSchema.extend({
  // El form puede enviar nombre_comercial vacío; convertirlo a null antes de
  // que valide el schema base (que pide string|null no string-vacío).
  nombre_comercial: z
    .string()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

// Action invocada desde el form en /admin/instituciones/nueva. Crea la fila +
// emite magic link en modo dry-run (no manda email). El admin copia la URL al
// portapapeles desde la UI cliente.
export async function crearInstitucionConLink(
  _prevState: CrearInstitucionConLinkState,
  formData: FormData
): Promise<CrearInstitucionConLinkState> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }

  const raw = {
    razon_social: String(formData.get('razon_social') ?? ''),
    nombre_comercial: formData.get('nombre_comercial')
      ? String(formData.get('nombre_comercial'))
      : null,
    tipo: String(formData.get('tipo') ?? ''),
    email_contacto: String(formData.get('email_contacto') ?? ''),
  };

  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  try {
    const inst = await crearInstitucion(parsed.data);
    const link = await emitirMagicLink(inst.institucion_id, { dryRun: true });
    return {
      ok: true,
      institucion_id: inst.institucion_id,
      cajas_aplicables: inst.cajas_aplicables,
      magic_url: link.url,
      expires_at: link.expires_at.toISOString(),
    };
  } catch (err) {
    // Postgres unique_violation (email_contacto duplicado) cae aquí — el code
    // 23505 sale en err.cause.code. No exponemos detalles SQL al cliente,
    // pero damos un mensaje accionable.
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === '23505') {
      return {
        ok: false,
        error:
          'Ya existe una institución con ese email. Verifica el catálogo.',
      };
    }
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Error desconocido al crear.',
    };
  }
}
