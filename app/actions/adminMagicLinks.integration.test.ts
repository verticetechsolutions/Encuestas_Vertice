import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || url.trim().length === 0) {
    return { db: null, client: null, url: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/postgres-js');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require('postgres');
  const client = postgres(url, { prepare: false, max: 5 });
  const db = drizzle(client);
  return { db, client, url };
});

vi.mock('@/lib/db', () => ({ db: hoisted.db }));

const authMock = vi.hoisted(() => ({ authenticated: true }));
vi.mock('@/lib/auth/admin', () => ({
  isAdminAuthenticated: async () => authMock.authenticated,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { eq } from 'drizzle-orm';
import { instituciones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { emitirMagicLink } from './auth';
import { revocarMagicLink, reenviarMagicLink } from './adminMagicLinks';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

async function seedInstWithLink(suffix: string): Promise<{ inst_id: string; token_id: string }> {
  if (!db) throw new Error('no test db');
  const [inst] = await db
    .insert(instituciones)
    .values({
      razon_social: `Test Bank ${suffix}`,
      nombre_comercial: null,
      tipo: 'banco',
      email_contacto: `test${suffix}@bank.example`,
    })
    .returning({ id: instituciones.id });
  await emitirMagicLink(inst.id, { dryRun: true });
  const [t] = await db
    .select({ id: magic_tokens.id })
    .from(magic_tokens)
    .where(eq(magic_tokens.institucion_id, inst.id))
    .limit(1);
  return { inst_id: inst.id, token_id: t.id };
}

describe('adminMagicLinks (integration)', () => {
  beforeEach(async () => {
    authMock.authenticated = true;
    if (db) await resetReviewTables(db);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  describe('revocarMagicLink', () => {
    skip('revoca un token vigente', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('A');
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(true);
      const [row] = await db
        .select({ revoked_at: magic_tokens.revoked_at })
        .from(magic_tokens)
        .where(eq(magic_tokens.id, token_id));
      expect(row.revoked_at).toBeInstanceOf(Date);
    });

    skip('falla con token inexistente', async () => {
      const result = await revocarMagicLink('00000000-0000-0000-0000-000000000000');
      expect(result.ok).toBe(false);
    });

    skip('falla con token ya revocado (idempotencia inversa)', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('B');
      await revocarMagicLink(token_id);
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(false);
    });

    skip('falla sin auth', async () => {
      if (!db) return;
      const { token_id } = await seedInstWithLink('C');
      authMock.authenticated = false;
      const result = await revocarMagicLink(token_id);
      expect(result.ok).toBe(false);
    });
  });

  describe('reenviarMagicLink', () => {
    skip('modo dry_run con auth devuelve URL y revoca previos', async () => {
      if (!db) return;
      const { inst_id, token_id: prev } = await seedInstWithLink('D');
      const result = await reenviarMagicLink(inst_id, 'dry_run');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.magic_url).toMatch(/^http.*\/acceso\//);
      const [prevRow] = await db
        .select({ revoked_at: magic_tokens.revoked_at })
        .from(magic_tokens)
        .where(eq(magic_tokens.id, prev));
      expect(prevRow.revoked_at).toBeInstanceOf(Date);
    });

    skip('modo email sin RESEND_API_KEY → ok:false con mensaje accionable', async () => {
      if (!db) return;
      const prevKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;
      try {
        const { inst_id } = await seedInstWithLink('E');
        const result = await reenviarMagicLink(inst_id, 'email');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/RESEND_API_KEY/);
      } finally {
        if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
      }
    });

    skip('falla sin auth', async () => {
      if (!db) return;
      const { inst_id } = await seedInstWithLink('F');
      authMock.authenticated = false;
      const result = await reenviarMagicLink(inst_id, 'dry_run');
      expect(result.ok).toBe(false);
    });
  });
});
