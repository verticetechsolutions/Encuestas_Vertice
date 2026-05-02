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
  },
});
