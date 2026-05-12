'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { instituciones, sesiones, magic_tokens } from '@/db/schema';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { crearInstitucion } from '@/app/actions/instituciones';
import { emitirMagicLink } from '@/app/actions/auth';
import {
  CrearInstitucionInputSchema,
  EditarInstitucionInputSchema,
} from '@/lib/auth/contracts';
import { logger } from '@/lib/observability/axiom';

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
  telefono_contacto: z
    .string()
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null))
    .refine(
      (v) => v === null || /[\d]{6,}/.test(v.replace(/\D/g, '')),
      { message: 'Teléfono inválido: incluye al menos 6 dígitos.' }
    ),
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
    telefono_contacto: formData.get('telefono_contacto')
      ? String(formData.get('telefono_contacto'))
      : null,
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

    // Audit log: institución creada + magic link emitido (el log de
    // emitirMagicLink ya cubre el lado del token; este lo une al evento
    // de creación de la institución).
    logger.admin.institucionCreada({
      institucion_id: inst.institucion_id,
      razon_social: parsed.data.razon_social,
      tipo: parsed.data.tipo,
      emitio_magic_link: true,
    });

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

// ════════════════════════════════════════════════════════════════════════════
// editarInstitucion — actualiza campos editables de una institución existente.
// El admin puede modificar razón social, nombre comercial, tipo, email y
// teléfono. El id no se cambia. Si se pasa email duplicado, devolvemos error
// dedicado (23505). Tras éxito, revalida catálogo + detalle.
// ════════════════════════════════════════════════════════════════════════════

export type EditarInstitucionState =
  | { ok: true; institucion_id: string }
  | { ok: false; error: string }
  | { ok: null };

const EditFormSchema = EditarInstitucionInputSchema;

export async function editarInstitucion(
  institucion_id: string,
  _prevState: EditarInstitucionState,
  formData: FormData
): Promise<EditarInstitucionState> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }
  if (!institucion_id || typeof institucion_id !== 'string') {
    return { ok: false, error: 'ID de institución inválido.' };
  }

  // Construimos el patch solo con los campos presentes en el form (cualquier
  // FormData entry vacío se omite — undefined ≠ null, undefined no toca la
  // columna). nombre_comercial y telefono_contacto sí permiten null explícito
  // (string vacío del input limpia el campo).
  const patch: Record<string, unknown> = {};
  const rs = formData.get('razon_social');
  if (typeof rs === 'string' && rs.trim().length > 0) patch.razon_social = rs.trim();
  const nc = formData.get('nombre_comercial');
  if (nc !== null) {
    const v = String(nc).trim();
    patch.nombre_comercial = v.length > 0 ? v : null;
  }
  const tipo = formData.get('tipo');
  if (typeof tipo === 'string' && tipo.trim().length > 0) patch.tipo = tipo.trim();
  const email = formData.get('email_contacto');
  if (typeof email === 'string' && email.trim().length > 0) patch.email_contacto = email.trim();
  const tel = formData.get('telefono_contacto');
  if (tel !== null) {
    const v = String(tel).trim();
    patch.telefono_contacto = v.length > 0 ? v : null;
  }

  const parsed = EditFormSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  try {
    const result = await db
      .update(instituciones)
      .set({ ...parsed.data, updated_at: new Date() })
      .where(eq(instituciones.id, institucion_id))
      .returning({ id: instituciones.id });

    if (result.length === 0) {
      return { ok: false, error: 'Institución no encontrada.' };
    }

    logger.admin.institucionEditada({
      institucion_id,
      campos: Object.keys(parsed.data),
    });

    revalidatePath('/admin/instituciones');
    revalidatePath(`/admin/instituciones/${institucion_id}`);

    return { ok: true, institucion_id };
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === '23505') {
      return {
        ok: false,
        error: 'Ya existe otra institución con ese email.',
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error desconocido al editar.',
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// eliminarInstitucion — borra una institución. Bloqueado si hay sesiones o
// magic_tokens asociados (FK protection — soft-delete sería ideal pero el
// schema actual no tiene deleted_at). El admin debe limpiar referencias antes.
// ════════════════════════════════════════════════════════════════════════════

export type EliminarInstitucionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      // Si el blocker fueron FKs, devolvemos los conteos para que la UI
      // muestre el porqué.
      sesiones_count?: number;
      magic_tokens_count?: number;
    };

export async function eliminarInstitucion(
  institucion_id: string
): Promise<EliminarInstitucionResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }
  if (!institucion_id || typeof institucion_id !== 'string') {
    return { ok: false, error: 'ID de institución inválido.' };
  }

  // Pre-check FK references — más amigable que dejar que Postgres tire 23503.
  const [sesionesRefs] = await db
    .select({ n: sesiones.id })
    .from(sesiones)
    .where(eq(sesiones.institucion_id, institucion_id))
    .limit(1);
  const [tokenRefs] = await db
    .select({ n: magic_tokens.id })
    .from(magic_tokens)
    .where(eq(magic_tokens.institucion_id, institucion_id))
    .limit(1);

  if (sesionesRefs || tokenRefs) {
    // Conteos exactos para mensaje de error útil.
    const sesionesCount = await db.$count(
      sesiones,
      eq(sesiones.institucion_id, institucion_id)
    );
    const tokensCount = await db.$count(
      magic_tokens,
      eq(magic_tokens.institucion_id, institucion_id)
    );
    return {
      ok: false,
      error:
        'No se puede eliminar: hay actividad asociada. Revoca magic links y archiva las sesiones antes de borrar.',
      sesiones_count: sesionesCount,
      magic_tokens_count: tokensCount,
    };
  }

  try {
    const result = await db
      .delete(instituciones)
      .where(eq(instituciones.id, institucion_id))
      .returning({ id: instituciones.id });

    if (result.length === 0) {
      return { ok: false, error: 'Institución no encontrada.' };
    }

    logger.admin.institucionEliminada({ institucion_id });

    revalidatePath('/admin/instituciones');
    revalidatePath('/admin');

    return { ok: true };
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === '23503') {
      return {
        ok: false,
        error:
          'No se puede eliminar: hay referencias FK que no pre-detectamos.',
      };
    }
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Error desconocido al eliminar.',
    };
  }
}
