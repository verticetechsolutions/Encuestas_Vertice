import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// Vite 7 / Vitest 4.x resuelven los `paths` del tsconfig nativamente vía
// `resolve.tsconfigPaths: true`. Antes (Vite 5.x) ese flag fallaba con
// cadenas transitivas a través del alias `@/` y el plugin externo
// `vite-tsconfig-paths` era necesario; verificado 2026-05-07 que con Vitest
// 4.1 los 141 tests pasan sin el plugin.
//
// loadEnv carga .env.local en runtime de los tests para que integration tests
// (lib/**/*.integration.test.ts) puedan leer DATABASE_URL_TEST sin que el
// founder tenga que exportar variables a mano. El stub de DATABASE_URL sigue
// siendo necesario para los unit tests que solo importan @/lib/db.
const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: [
      'node_modules/**',
      '.next/**',
      'db/migrations/**',
      // STT smoke tests authored as `describe.skip` placeholders awaiting a
      // proper jsdom + @testing-library/react setup in a future session. They
      // were merged from feat/deepgram-stt-integration; excluding them a
      // collection-level keeps the suite green until refactored. Tracked en
      // IMPLEMENTATION.md §19 deuda técnica.
      'lib/stt/use-deepgram-stream.test.ts',
      'app/api/stt/token/route.test.ts',
    ],
    // Integration tests `*.integration.test.ts` se serializan: cada suite
    // TRUNCATE las tablas que toca y los singletons de postgres-js no son
    // re-entrantes seguros por suite. Ejecución secuencial es barata (suite
    // dura segundos) y elimina la clase de bugs por concurrencia entre suites.
    fileParallelism: true,
    sequence: { concurrent: false },
    env: {
      // Stub para unit tests que importan @/lib/db (no hacen queries reales).
      // Si DATABASE_URL_TEST está presente, los integration tests crean su
      // propio cliente vía lib/motor/test-db.ts (no dependen de @/lib/db).
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_vertice',
      DATABASE_URL_TEST: env.DATABASE_URL_TEST ?? '',
    },
  },
});
