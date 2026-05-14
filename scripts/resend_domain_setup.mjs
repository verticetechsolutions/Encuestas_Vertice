// Crea o lee el dominio en Resend via API. Devuelve los TXT records que
// tienes que poner en Cloudflare (DKIM + SPF + DMARC).
//
// Idempotente: si el dominio ya existe, lee y muestra los records.
// Uso:
//   node scripts/resend_domain_setup.mjs verticemexico.com

import { config } from 'dotenv';
config({ path: '.env.local' });

const domain = process.argv[2];
if (!domain) {
  console.error('Uso: node scripts/resend_domain_setup.mjs <dominio>');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('RESEND_API_KEY no configurada en .env.local');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};

async function listDomains() {
  const res = await fetch('https://api.resend.com/domains', { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(`list failed: ${res.status} ${JSON.stringify(data)}`);
  return data.data ?? [];
}

async function createDomain(name) {
  const res = await fetch('https://api.resend.com/domains', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ name, region: 'us-east-1' }),
  });
  const data = await res.json();
  if (!res.ok) {
    // 422 = ya existe — caer al getDomain via list
    if (res.status === 422 || res.status === 409) {
      console.log(`(domain exists, fetching) ${data.message ?? ''}`);
      return null;
    }
    throw new Error(`create failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function getDomain(id) {
  const res = await fetch(`https://api.resend.com/domains/${id}`, { headers: HEADERS });
  const data = await res.json();
  if (!res.ok) throw new Error(`get failed: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log(`--- Resend domain setup: ${domain} ---\n`);

  // 1. Buscar si ya existe
  console.log('[1] Listing existing domains...');
  const existing = await listDomains();
  let target = existing.find((d) => d.name === domain);
  if (target) {
    console.log(`    Found existing: id=${target.id} status=${target.status} region=${target.region}`);
  } else {
    console.log(`    Not found. Creating...`);
    const created = await createDomain(domain);
    if (created) {
      target = created;
      console.log(`    Created: id=${target.id} status=${target.status}`);
    } else {
      // Race condition o list incompleto — refresh
      const after = await listDomains();
      target = after.find((d) => d.name === domain);
      if (!target) throw new Error('Created but not findable. Try again.');
    }
  }

  // 2. Obtener detalles + DNS records
  console.log('\n[2] Fetching DNS records...');
  const full = await getDomain(target.id);
  const records = full.records ?? [];
  console.log(`    Status: ${full.status}`);
  console.log(`    Records: ${records.length}\n`);

  // 3. Imprimir tabla
  console.log('--- DNS records a agregar en Cloudflare ---\n');
  records.forEach((r, i) => {
    console.log(`Record ${i + 1}: ${r.record} (${r.purpose ?? r.type})`);
    console.log(`  Type:    ${r.type}`);
    console.log(`  Name:    ${r.name}`);
    console.log(`  Value:   ${r.value}`);
    if (r.ttl) console.log(`  TTL:     ${r.ttl}`);
    if (r.priority !== undefined) console.log(`  Priority: ${r.priority}`);
    console.log(`  Status:  ${r.status ?? 'pending'}`);
    console.log('');
  });

  // 4. Resumen final
  console.log('--- Resumen ---');
  console.log(`Domain ID:     ${target.id}`);
  console.log(`Domain Status: ${full.status}`);
  console.log(`Region:        ${full.region}`);
  console.log(`Verify URL:    POST https://api.resend.com/domains/${target.id}/verify`);
  console.log(`Cloudflare:    https://dash.cloudflare.com/  → ${domain} → DNS → Records → Add`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
