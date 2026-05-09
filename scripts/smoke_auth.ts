// Smoke E2E para Fase 4 sin dev server: ejercita verificarMagicLink contra la DB
// real para validar los 4 outcomes (ok, consumido, expirado, token_invalido).
//
// Uso: npx tsx scripts/smoke_auth.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { magic_tokens, instituciones } = await import('../db/schema');
  const { emitirMagicLink, verificarMagicLink } = await import('../app/actions/auth');
  const { hashToken } = await import('../lib/auth/tokens');
  const { eq, and } = await import('drizzle-orm');

  // Necesita una institución existente. Usamos la del dry-run anterior, o creamos una
  // nueva si no existe.
  const [inst] = await db
    .select({ id: instituciones.id })
    .from(instituciones)
    .where(eq(instituciones.razon_social, 'Banco Demo Vertice SA'))
    .limit(1);
  if (!inst) {
    console.error('✗ no encontré la institución de prueba; corre primero scripts/invitar.ts');
    process.exit(1);
  }
  const institucion_id = inst.id;
  console.log(`institucion_id: ${institucion_id}`);

  // ---------- Test A: token_invalido --------------------------------------
  const r0 = await verificarMagicLink('TOKEN-INEXISTENTE-12345');
  console.log(`\n[A] token inexistente → ${JSON.stringify(r0)}`);
  if (r0.ok || r0.razon !== 'token_invalido') throw new Error('A: esperaba razon=token_invalido');
  console.log('    ✓ outcome correcto: token_invalido');

  // ---------- Test B: happy path -------------------------------------------
  // Emitimos token fresco vía dryRun para extraer la URL plain.
  const emitB = await emitirMagicLink(institucion_id, { dryRun: true });
  const tokenB = new URL(emitB.url).pathname.split('/').pop()!;
  console.log(`\n[B] token fresco emitido: ${tokenB.slice(0, 8)}...`);
  const r1 = await verificarMagicLink(tokenB);
  console.log(`    primer verify → ${JSON.stringify(r1)}`);
  if (!r1.ok) throw new Error('B: esperaba ok=true en primer verify');
  console.log('    ✓ outcome correcto: ok=true, sesión creada o reanudada');

  // ---------- Test C: consumido (re-verificar token de B) -----------------
  const r2 = await verificarMagicLink(tokenB);
  console.log(`\n[C] re-verify del mismo token → ${JSON.stringify(r2)}`);
  if (r2.ok || r2.razon !== 'consumido') throw new Error('C: esperaba razon=consumido');
  console.log('    ✓ outcome correcto: consumido (consumed_at quedó set)');

  // ---------- Test D: expirado --------------------------------------------
  // Emitimos otro token y lo expiramos manualmente en DB (expires_at en el pasado).
  const emitD = await emitirMagicLink(institucion_id, { dryRun: true });
  const tokenD = new URL(emitD.url).pathname.split('/').pop()!;
  const tokenD_hash = hashToken(tokenD);
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .update(magic_tokens)
    .set({ expires_at: ayer })
    .where(and(eq(magic_tokens.token_hash, tokenD_hash)));
  console.log(`\n[D] token forzado a expirar (expires_at = ${ayer.toISOString()})`);
  const r3 = await verificarMagicLink(tokenD);
  console.log(`    verify → ${JSON.stringify(r3)}`);
  if (r3.ok || r3.razon !== 'expirado') throw new Error('D: esperaba razon=expirado');
  console.log('    ✓ outcome correcto: expirado');

  // ---------- Test E: auto-revoke en reemisión ----------------------------
  // Emitimos tokenE1, luego tokenE2; tokenE1 debe quedar revocado y verificar
  // debe devolver razon='revocado' (paquete admin 2).
  const emitE1 = await emitirMagicLink(institucion_id, { dryRun: true });
  const tokenE1 = new URL(emitE1.url).pathname.split('/').pop()!;
  await emitirMagicLink(institucion_id, { dryRun: true }); // E2: revoca E1
  const r4 = await verificarMagicLink(tokenE1);
  console.log(`\n[E] verify tokenE1 tras reemisión → ${JSON.stringify(r4)}`);
  if (r4.ok) throw new Error('E: esperaba ok=false, recibí ok=true');
  if (!r4.ok && r4.razon !== 'revocado') {
    throw new Error(`E: esperaba razon=revocado, recibí ${r4.razon}`);
  }
  console.log('    ✓ outcome correcto: revocado (auto-revoke en reemisión)');

  console.log('\n✓ smoke E2E auth: 5/5 outcomes correctos (token_invalido, ok, consumido, expirado, revocado)');
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ smoke falló:', err.message ?? err);
  process.exit(1);
});
