// Verifica qué migraciones están aplicadas en la DB.
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  // 1. Tabla pdf_url existe?
  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'perfil_decision_final'
    ORDER BY column_name;
  `;
  console.log('perfil_decision_final cols:', cols.map((c) => c.column_name).join(', '));

  // 2. audit_admin_actions tabla existe?
  const auditExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='audit_admin_actions'
    ) as exists;
  `;
  console.log('audit_admin_actions exists:', auditExists[0].exists);

  // 3. magic_tokens tabla existe?
  const magicExists = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name='magic_tokens'
    ) as exists;
  `;
  console.log('magic_tokens exists:', magicExists[0].exists);
} finally {
  await sql.end();
}
