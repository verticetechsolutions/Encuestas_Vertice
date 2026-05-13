// Aplica db/migrations/0006_sso_usuarios_audit.sql contra DATABASE_URL.
// Usa el cliente `postgres` ya en deps (drizzle lo usa internamente).
// Idempotente bajo "fresh DB" — todas las sentences son CREATE TYPE/TABLE/INDEX
// sin IF NOT EXISTS, asume que la migración no se ha aplicado todavía.

import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'db', 'migrations', '0006_sso_usuarios_audit.sql');
const sql = readFileSync(sqlPath, 'utf-8');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no está set en .env.local');
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  console.log('Aplicando migración 0006 contra', url.replace(/:[^:@]+@/, ':***@'));
  // postgres-js permite ejecutar múltiples statements separados por ;
  // pero requiere usar el método .unsafe para SQL crudo.
  await client.unsafe(sql);
  console.log('✓ Migración 0006 aplicada.');

  // Verificación: las 3 tablas existen.
  const [{ exists: usuarios }] = await client`SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuarios'
  )`;
  const [{ exists: dominios }] = await client`SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'institucion_dominios_permitidos'
  )`;
  const [{ exists: audit }] = await client`SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_admin_actions'
  )`;
  console.log({ usuarios, dominios, audit });
  if (!usuarios || !dominios || !audit) {
    console.error('FAIL: una o más tablas no existen después de la migración.');
    process.exit(2);
  }
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : String(err));
  process.exit(3);
} finally {
  await client.end();
}
