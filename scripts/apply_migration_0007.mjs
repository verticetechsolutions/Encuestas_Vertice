// Aplica db/migrations/0007_add_pdf_url.sql contra DATABASE_URL.
// Idempotente: agrega ADD COLUMN IF NOT EXISTS para que re-runs sean safe.

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no está set en .env.local');
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  console.log('Aplicando migración 0007 (idempotente) contra', url.replace(/:[^:@]+@/, ':***@'));
  await client.unsafe(`
    ALTER TABLE "perfil_decision_final"
      ADD COLUMN IF NOT EXISTS "pdf_url" text;
  `);
  console.log('OK: pdf_url columna agregada (o ya existía).');

  // Verifica
  const cols = await client`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'perfil_decision_final' AND column_name = 'pdf_url';
  `;
  console.log('Verify:', cols.length === 1 ? 'pdf_url presente ✓' : 'pdf_url AUSENTE ✗');
} catch (err) {
  console.error('FAIL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
