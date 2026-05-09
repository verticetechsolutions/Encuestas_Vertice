'use server';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { magic_tokens } from '@/db/schema';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { emitirMagicLink } from './auth';

export type ReenviarMode = 'email' | 'dry_run';

export type ReenviarResult =
  | {
      ok: true;
      mode: ReenviarMode;
      magic_url: string;
      expires_at: string;
      sent_to?: string;
    }
  | { ok: false; error: string };

export async function reenviarMagicLink(
  institucion_id: string,
  mode: ReenviarMode
): Promise<ReenviarResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }

  // Fail-fast en modo email si Resend no está configurado. NO degradamos
  // a dry-run silente para evitar que el admin asuma que el correo salió.
  if (mode === 'email' && !process.env.RESEND_API_KEY) {
    return {
      ok: false,
      error:
        'RESEND_API_KEY no configurada. Usa "Generar URL" para copiar manualmente mientras tanto.',
    };
  }

  try {
    const link = await emitirMagicLink(institucion_id, {
      dryRun: mode === 'dry_run',
    });
    revalidatePath(`/admin/instituciones/${institucion_id}`);
    revalidatePath('/admin/magic-links');
    return {
      ok: true,
      mode,
      magic_url: link.url,
      expires_at: link.expires_at.toISOString(),
      sent_to: link.enviado ? link.email_contacto : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error al reemitir.',
    };
  }
}

export type RevocarResult = { ok: true } | { ok: false; error: string };

export async function revocarMagicLink(
  token_id: string
): Promise<RevocarResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: 'No autorizado.' };
  }

  // UPDATE atómico: solo si está vigente (no consumido, no revocado, no
  // expirado). Si el token ya cambió de estado entre render y click,
  // `returning()` queda vacío y devolvemos error de race.
  const updated = await db
    .update(magic_tokens)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(magic_tokens.id, token_id),
        isNull(magic_tokens.consumed_at),
        isNull(magic_tokens.revoked_at),
        gt(magic_tokens.expires_at, new Date())
      )
    )
    .returning({ institucion_id: magic_tokens.institucion_id });

  if (updated.length === 0) {
    return {
      ok: false,
      error: 'Token no revocable (consumido, expirado o ya revocado).',
    };
  }

  revalidatePath(`/admin/instituciones/${updated[0].institucion_id}`);
  revalidatePath('/admin/magic-links');
  return { ok: true };
}
