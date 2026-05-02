import { defineConfig } from 'vitest/config';

// Vite 5+ resolves tsconfig "paths" natively when `resolve.tsconfigPaths`
// is enabled, so we don't need the vite-tsconfig-paths plugin.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'db/migrations/**'],
  },
});
