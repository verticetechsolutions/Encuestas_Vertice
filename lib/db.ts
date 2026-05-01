// Drizzle client. Module-scoped singleton — Next.js may reload this file across
// HMR boundaries in dev; the underlying postgres client manages its own pool.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no configurada');

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
