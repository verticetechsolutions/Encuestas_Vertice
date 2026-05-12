// Crea una institución y emite el primer magic link.
// Uso:
//   npx tsx scripts/invitar.ts \
//     --razon-social "Banco Ejemplo S.A." \
//     --tipo banco \
//     --email contacto@banco.example \
//     [--nombre-comercial "Banco Ej"] \
//     [--dry-run]
//
// --dry-run imprime la URL del magic link sin mandar email — útil cuando RESEND_API_KEY
// está vacía o cuando estás validando flujos en local.

import { config } from 'dotenv';
config({ path: '.env.local' });

interface Args {
  razon_social: string;
  nombre_comercial: string | null;
  tipo: string;
  email: string;
  dry_run: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { nombre_comercial: null, dry_run: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--razon-social':
        out.razon_social = v;
        i++;
        break;
      case '--nombre-comercial':
        out.nombre_comercial = v;
        i++;
        break;
      case '--tipo':
        out.tipo = v;
        i++;
        break;
      case '--email':
        out.email = v;
        i++;
        break;
      case '--dry-run':
        out.dry_run = true;
        break;
      default:
        if (k.startsWith('--')) throw new Error(`flag desconocido: ${k}`);
    }
  }
  if (!out.razon_social || !out.tipo || !out.email) {
    throw new Error('faltan flags obligatorios: --razon-social, --tipo, --email');
  }
  return out as Args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Dynamic imports — el módulo `lib/db.ts` lee DATABASE_URL al inicializar; sus
  // imports deben ocurrir DESPUÉS de que dotenv pobló process.env. Imports estáticos
  // se hoistean arriba del `config()` y truenan con "DATABASE_URL no configurada".
  const { crearInstitucion } = await import('../app/actions/instituciones');
  const { emitirMagicLink } = await import('../app/actions/auth');
  const { TipoInstitucionSchema } = await import('../lib/schemas/casos');

  const tipoParsed = TipoInstitucionSchema.safeParse(args.tipo);
  if (!tipoParsed.success) {
    throw new Error(`--tipo debe ser uno de: ${TipoInstitucionSchema.options.join(', ')}`);
  }

  const inst = await crearInstitucion({
    razon_social: args.razon_social,
    nombre_comercial: args.nombre_comercial,
    tipo: tipoParsed.data,
    email_contacto: args.email,
    telefono_contacto: null,
  });
  console.log(`✓ institución creada: ${inst.institucion_id} (${inst.cajas_aplicables} cajas aplicables)`);

  const link = await emitirMagicLink(inst.institucion_id, { dryRun: args.dry_run });
  console.log(`✓ magic link emitido (expira ${link.expires_at.toISOString()})`);
  console.log(`  url: ${link.url}`);
  if (link.enviado) {
    console.log(`✓ email enviado a ${args.email} vía Resend`);
  } else {
    console.log(`  (dry-run — no se envió email; abre la url manualmente para validar)`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ error:', err.message ?? err);
  process.exit(1);
});
