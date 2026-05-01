// Magic-link token primitives. Plain token only ever appears in the email URL;
// DB stores the SHA-256 hash. This means a leaked DB doesn't leak working tokens.

import { randomBytes, createHash } from 'crypto';

export const MAGIC_TOKEN_TTL_DAYS = 7;

// 24 random bytes → ~32 char base64url string. URL-safe (no `+/=` padding).
export function generateMagicToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function magicTokenExpiry(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + MAGIC_TOKEN_TTL_DAYS);
  return d;
}
