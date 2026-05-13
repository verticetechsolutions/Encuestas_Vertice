// Verifica que el login Google haya insertado la fila correcta en `usuarios`.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const rows = await client`SELECT id, email, role, institucion_id, google_sub IS NOT NULL AS has_google_sub, ultimo_login_at FROM usuarios ORDER BY created_at DESC LIMIT 5`;
  console.log('usuarios (latest 5):');
  for (const r of rows) console.log(' ', r);
  const audit = await client`SELECT action, target_type, target_id, created_at FROM audit_admin_actions ORDER BY created_at DESC LIMIT 5`;
  console.log('audit_admin_actions (latest 5):');
  for (const r of audit) console.log(' ', r);
} finally {
  await client.end();
}
