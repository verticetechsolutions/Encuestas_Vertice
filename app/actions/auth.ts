'use server';

import { db } from '@/lib/db';
import { magic_tokens, instituciones } from '@/db/schema';
import { generateMagicToken, hashToken, magicTokenExpiry } from '@/lib/auth/tokens';
import { sendMagicLink } from '@/lib/email/resend';
import { crearOReanudarSesion } from '@/app/actions/sesiones';
import { eq } from 'drizzle-orm';
import type {
  EmitirMagicLinkOptions,
  EmitirMagicLinkResult,
  VerificarMagicLinkOutcome,
} from '@/lib/auth/contracts';

// Emite token plain (vive solo en la URL del email) + guarda hash en DB. Idempotente:
// si la institución ya tiene un token vigente, emite uno nuevo igualmente — el
// anterior queda válido hasta que expire o sea consumido. No invalidamos para evitar
// race conditions con correos en tránsito.
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
  await db.insert(magic_tokens).values({
    token_hash,
    institucion_id,
    expires_at,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/acceso/${plain}`;

  if (opts.dryRun) {
    return { url, enviado: false, expires_at };
  }

  await sendMagicLink({
    to: inst.email_contacto,
    url,
    razon_social: inst.razon_social,
    expiresAt: expires_at,
  });
  return { url, enviado: true, expires_at };
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
    })
    .from(magic_tokens)
    .where(eq(magic_tokens.token_hash, token_hash))
    .limit(1);

  if (!row) return { ok: false, razon: 'token_invalido' };
  if (row.consumed_at) return { ok: false, razon: 'consumido' };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, razon: 'expirado' };

  // Marca consumido y crea/reanuda sesión. Si la creación de sesión falla, el token
  // queda consumido pero sin sesión — el usuario tendría que pedir otro link.
  const sesionResult = await crearOReanudarSesion(row.institucion_id);
  await db
    .update(magic_tokens)
    .set({ consumed_at: new Date() })
    .where(eq(magic_tokens.id, row.id));

  return { ok: true, sesion_id: sesionResult.sesion_id, reanudada: sesionResult.reanudada };
}
