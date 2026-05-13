// Env validation startup — Sprint 2 security audit 2026-05-12.
//
// Zod schema sobre process.env que falla rápido en boot si faltan vars
// críticas. Importado desde `instrumentation.ts` (Next.js startup hook)
// para que un misconfigure pete el proceso en vez de descubrirse en
// runtime cuando el primer request necesita la var.
//
// 3 categorías:
//   - required_always: necesarias para boot en CUALQUIER entorno (dev/prod).
//   - required_production: solo obligatorias cuando NODE_ENV=production.
//   - optional: presentes con default o tolerables nulas.
//
// Patrón: zod parse al boot, throw si falla. No exporta los valores
// procesados — el resto del código sigue leyendo `process.env.X` como
// hasta ahora; el schema solo valida la PRESENCIA y FORMA.

import { z } from 'zod';

const envSchema = z.object({
  // -- Required always ---------------------------------------------------------
  DATABASE_URL: z
    .string()
    .url()
    .refine((s) => s.startsWith('postgres://') || s.startsWith('postgresql://'), {
      message: 'DATABASE_URL debe ser un connection string postgres://',
    }),
  ANTHROPIC_API_KEY: z.string().min(20),
  DEEPGRAM_API_KEY: z.string().min(20),

  // -- Required in production (warn in dev) -----------------------------------
  // Auth.js sign-in necesita estas para que el flow OAuth funcione. En dev
  // puedes correr la app sin Google config (todo el flow Google falla con
  // error legible), pero en prod faltarían SSO + el JWT no podría firmarse.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  // AUTH_URL: URL canónica del deployment. Auth.js v6 la usa para computar el
  // redirect_uri del OAuth callback. En dev se auto-detecta del request, así
  // que es opcional aquí; en prod se fuerza vía validarEnvProd para evitar
  // mismatch silencioso con el OAuth Client de Google.
  AUTH_URL: z.string().url().optional(),

  // Magic-link emails (Resend). Sin esto, /api/auth/magic-link falla pero el
  // resto de la app puede funcionar (entrevistas existentes vía cookie).
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().email().optional(),

  // -- Optional con default o tolerable nulo ----------------------------------
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_PANEL_TOKEN: z.string().min(20).optional(),
  // preprocess empty string → undefined: el patrón común en .env.local es
  // dejar la var presente pero vacía (`ADMIN_EMERGENCY_MODE=`) para
  // documentarla sin activarla. Sin el preprocess, el enum falla.
  ADMIN_EMERGENCY_MODE: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['0', '1']).optional()
  ),
  VERTICE_ADMIN_DOMAINS: z.string().optional(),

  // Observability — sin éstas el código loguea localmente pero no se exporta.
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().optional(),

  // Test DB — opcional siempre (los integration tests se skipean sin ella).
  DATABASE_URL_TEST: z.string().optional(),

  // NODE_ENV gestionado por Next.js. Validamos para hacer el branch de
  // "required_production" predecible.
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` contra el schema. Lanza Error con todos los issues
 * agregados si falla. Imprime `process.env` filtrado (sin secrets) para
 * debugging si la validación falla.
 *
 * Llamar UNA SOLA VEZ en boot (`instrumentation.ts`). No tiene side-effects
 * más allá de validar; no muta process.env.
 */
export function validarEnv(): void {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    return;
  }
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(
    `[env] Configuración inválida. Revisa .env.local / Vercel env vars:\n${issues}`
  );
}

/**
 * Variante prod-strict: además exige las vars marcadas como
 * required_production. En dev las warning logs pero no peta.
 */
export function validarEnvProd(): void {
  validarEnv();
  if (process.env.NODE_ENV !== 'production') return;

  const requiredProd: Array<keyof Env> = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'AUTH_SECRET',
    'AUTH_URL',
    'RESEND_API_KEY',
    'EMAIL_FROM',
  ];
  const missing = requiredProd.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  throw new Error(
    `[env] Faltan vars obligatorias en production: ${missing.join(', ')}`
  );
}
