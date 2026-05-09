// Integration test del auto-revoke en emitirMagicLink contra Postgres real.

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

import { eq, and, isNull } from 'drizzle-orm';
import { instituciones, magic_tokens } from '@/db/schema';
import { resetReviewTables } from '@/lib/motor/test-db';
import { emitirMagicLink, verificarMagicLink } from './auth';

const { db, client, url } = hoisted;
const skip = !url ? it.skip : it;

describe('emitirMagicLink (integration)', () => {
  beforeEach(async () => {
    if (db) await resetReviewTables(db);
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  skip('revoca tokens vigentes previos al emitir uno nuevo', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test@bank.example',
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const second = await emitirMagicLink(inst.id, { dryRun: true });

    const vigentes = await db
      .select({ id: magic_tokens.id, revoked_at: magic_tokens.revoked_at })
      .from(magic_tokens)
      .where(
        and(
          eq(magic_tokens.institucion_id, inst.id),
          isNull(magic_tokens.consumed_at),
          isNull(magic_tokens.revoked_at)
        )
      );
    expect(vigentes).toHaveLength(1);
    expect(first.url).not.toEqual(second.url);
  });

  skip('NO revoca tokens consumidos al emitir uno nuevo', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 2',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test2@bank.example',
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const tokenPlain = new URL(first.url).pathname.split('/').pop()!;
    const result = await verificarMagicLink(tokenPlain);
    expect(result.ok).toBe(true);

    await emitirMagicLink(inst.id, { dryRun: true });

    const allTokens = await db
      .select({
        consumed_at: magic_tokens.consumed_at,
        revoked_at: magic_tokens.revoked_at,
      })
      .from(magic_tokens)
      .where(eq(magic_tokens.institucion_id, inst.id));

    const consumed = allTokens.filter((t: { consumed_at: Date | null; revoked_at: Date | null }) => t.consumed_at);
    expect(consumed).toHaveLength(1);
    expect(consumed[0].revoked_at).toBeNull();
  });

  skip('verificarMagicLink rechaza token revocado con razon revocado', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 3',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test3@bank.example',
      })
      .returning({ id: instituciones.id });

    const first = await emitirMagicLink(inst.id, { dryRun: true });
    const tokenPlain = new URL(first.url).pathname.split('/').pop()!;
    await emitirMagicLink(inst.id, { dryRun: true });

    const result = await verificarMagicLink(tokenPlain);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.razon).toBe('revocado');
  });

  skip('emitirMagicLink retorna email_contacto', async () => {
    if (!db) return;
    const [inst] = await db
      .insert(instituciones)
      .values({
        razon_social: 'Test Bank 4',
        nombre_comercial: null,
        tipo: 'banco',
        email_contacto: 'test4@bank.example',
      })
      .returning({ id: instituciones.id });

    const result = await emitirMagicLink(inst.id, { dryRun: true });
    expect(result.email_contacto).toBe('test4@bank.example');
  });
});
