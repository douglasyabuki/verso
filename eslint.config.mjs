import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  prettier,
  globalIgnores([
    ".agents/skills/**",
    ".npm-cache/**",
    ".cache/**",
    "public/compiler/**",
    "temp/**",
    "output/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "**/__screenshots__/**",
    "**/__traces__/**",
    ".vitest/**",
    ".vitest-attachments/**",
    "next-env.d.ts",
  ]),
]);
