'use server';

import { db } from '@/lib/db';
import { magic_tokens, instituciones } from '@/db/schema';
import { generateMagicToken, hashToken, magicTokenExpiry } from '@/lib/auth/tokens';
import { sendMagicLink } from '@/lib/email/resend';
import { crearOReanudarSesion } from '@/app/actions/sesiones';
import { eq, and, isNull } from 'drizzle-orm';
import type {
  EmitirMagicLinkOptions,
  EmitirMagicLinkResult,
  VerificarMagicLinkOutcome,
} from '@/lib/auth/contracts';
import { logger } from '@/lib/observability/axiom';

// Emite token plain (vive solo en la URL del email) + guarda hash en DB. Cada
// emisión ejecuta auto-revoke transaccional de tokens previos no consumidos y
// no revocados para esta institución, garantizando "máximo un token vigente
// por institución". Admin maneja explícitamente la reemisión vía paquete 2.
export async function emitirMagicLink(
  institucion_id: string,
  opts: EmitirMagicLinkOptions = {}
): Promise<EmitirMagicLinkResult> {
  const [inst] = await db
    .select({
      id: instituciones.id,
      razon_social: instituciones.razon_social,
      email_contacto: instituciones.email_contacto,
    })
    .from(instituciones)
    .where(eq(instituciones.id, institucion_id))
    .limit(1);
  if (!inst) throw new Error(`institucion_id ${institucion_id} no encontrada`);

  const plain = generateMagicToken();
  const token_hash = hashToken(plain);
  const expires_at = magicTokenExpiry();

  // Auto-revoke + insert atómico. Cualquier token previo no consumido y no
  // revocado para esta institución queda revocado en el mismo statement antes
  // de insertar el nuevo. Garantiza la invariante "máximo un token vigente
  // por institución" que asume `verificarMagicLink` y la UI admin.
  await db.transaction(async (tx) => {
    await tx
      .update(magic_tokens)
      .set({ revoked_at: new Date() })
      .where(
        and(
          eq(magic_tokens.institucion_id, institucion_id),
          isNull(magic_tokens.consumed_at),
          isNull(magic_tokens.revoked_at)
        )
      );
    await tx.insert(magic_tokens).values({
      token_hash,
      institucion_id,
      expires_at,
    });
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/acceso/${plain}`;

  // Audit log: NUNCA loguear el plain token. Solo el prefix del hash para
  // correlación con otros eventos (revocación, consumo).
  logger.admin.magicLinkEmitido({
    institucion_id,
    token_hash_prefix: token_hash.slice(0, 8),
    expires_at: expires_at.toISOString(),
    dry_run: opts.dryRun === true,
  });

  if (opts.dryRun) {
    return { url, enviado: false, expires_at, email_contacto: inst.email_contacto };
  }

  await sendMagicLink({
    to: inst.email_contacto,
    url,
    razon_social: inst.razon_social,
    expiresAt: expires_at,
  });
  return { url, enviado: true, expires_at, email_contacto: inst.email_contacto };
}

// Verifica el token plain del URL contra el hash almacenado. Outcome explícito (no
// excepciones) porque la página necesita renderizar mensajes distintos por causa.
// Esta función NO setea la cookie — eso lo hace el caller después de un outcome ok,
// para mantener el verify testeable sin contexto de request.
export async function verificarMagicLink(plain: string): Promise<VerificarMagicLinkOutcome> {
  const token_hash = hashToken(plain);
  const [row] = await db
    .select({
      id: magic_tokens.id,
      institucion_id: magic_tokens.institucion_id,
      expires_at: magic_tokens.expires_at,
      consumed_at: magic_tokens.consumed_at,
      revoked_at: magic_tokens.revoked_at,
    })
    .from(magic_tokens)
    .where(eq(magic_tokens.token_hash, token_hash))
    .limit(1);

  if (!row) return { ok: false, razon: 'token_invalido' };
  if (row.consumed_at) return { ok: false, razon: 'consumido' };
  if (row.revoked_at) return { ok: false, razon: 'revocado' };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, razon: 'expirado' };

  // Crea/reanuda sesión PRIMERO; si falla, lanzamos antes de marcar consumed_at,
  // así el token sigue vigente y el usuario puede reintentar el mismo link.
  // Si la sesión se crea OK pero el UPDATE falla (raro), el usuario no podría
  // re-entrar con este token — pediría otro vía admin.
  const sesionResult = await crearOReanudarSesion(row.institucion_id);
  await db
    .update(magic_tokens)
    .set({ consumed_at: new Date() })
    .where(eq(magic_tokens.id, row.id));

  return { ok: true, sesion_id: sesionResult.sesion_id, reanudada: sesionResult.reanudada };
}
