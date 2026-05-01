import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// drizzle-kit doesn't auto-load Next-style .env.local — wire it explicitly.
config({ path: '.env.local' });

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
