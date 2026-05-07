// Drizzle client. Module-scoped singleton — Next.js may reload this file across
// HMR boundaries en dev; el postgres client subyacente maneja su propio pool.
//
// Inicialización lazy via Proxy. Razón: en `/preview/ui` (modo founder iterando
// CSS sin cookies/DB) Next.js carga eagerly los server actions de la app —
// incluyendo `app/actions/respuestas.ts` que hace `import { db } from '@/lib/db'`
// — aunque la página no llame ninguna action. Si este módulo arrojara al
// import por DATABASE_URL ausente, /preview/ui sería 500 incluso con
// preview_mode=true en el store. Con lazy init: el módulo carga sin error;
// solo throw cuando alguien efectivamente accede a una propiedad de `db`.
// Producción no cambia (la primera request accede a db inmediatamente).

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no configurada');
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = real[prop as keyof Db];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
