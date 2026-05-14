// Setea un pdf_url fake en el perfil del smoke para validar UX cuando Blob sube OK.
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sesion_id = '99999999-9999-9999-9999-999999999999';
const fake_url = 'https://example-blob.vercel-storage.com/sintesis/smoke-fase8.pdf';

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const r = await sql`
    UPDATE perfil_decision_final
    SET pdf_url = ${fake_url}
    WHERE sesion_id = ${sesion_id}
    RETURNING id, pdf_url;
  `;
  console.log('Updated:', r[0]);
} finally {
  await sql.end();
}
