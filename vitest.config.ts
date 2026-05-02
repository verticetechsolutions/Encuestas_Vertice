import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// vite-tsconfig-paths plugin is required: el `resolve.tsconfigPaths: true`
// nativo de Vite resuelve mal cadenas transitivas a través del alias @/
// (verificado: tests fallan al cargar @/db/schema vía import chain). El plugin
// sí lo hace bien.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'db/migrations/**'],
    // DATABASE_URL stub: lib/db.ts arroja en module-load si está unset. Los unit
    // tests no hacen queries reales (solo importan el módulo), así que basta con
    // una URL parseable. Tests E2E (step vi) usan DATABASE_URL real de Neon
    // branch via .env.local — esa override gana en runtime.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_vertice',
    },
  },
});
