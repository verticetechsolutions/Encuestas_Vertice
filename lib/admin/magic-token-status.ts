// Deriva el estado de un magic_token desde sus timestamps. Sin estado mutable
// en DB para evitar drift. Precedencia: consumido > revocado > expirado >
// vigente. Razón: si ya se consumió, esa es la verdad histórica relevante;
// un revoke posterior es ruido.

export type MagicStatus = 'vigente' | 'consumido' | 'expirado' | 'revocado';

export const VALID_MAGIC_STATUSES = [
  'vigente',
  'consumido',
  'expirado',
  'revocado',
] as const satisfies readonly MagicStatus[];

interface TokenLike {
  consumed_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}

export function magicTokenStatus(
  t: TokenLike,
  now: Date = new Date()
): MagicStatus {
  if (t.consumed_at) return 'consumido';
  if (t.revoked_at) return 'revocado';
  if (t.expires_at.getTime() < now.getTime()) return 'expirado';
  return 'vigente';
}
