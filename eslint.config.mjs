import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stubs `describe.skip` excluidos también del runner de vitest
    // (ver vitest.config.ts `test.exclude`). Llevan `@ts-nocheck` como
    // marcador TODO hasta que el setup jsdom + @testing-library/react aterrice.
    "lib/stt/use-deepgram-stream.test.ts",
    "app/api/stt/token/route.test.ts",
  ]),
]);

export default eslintConfig;
