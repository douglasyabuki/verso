import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".cache/ms-playwright");

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: { include: ["pdfjs-dist", "pdfjs-dist/web/pdf_viewer.mjs"] },
  resolve: { alias: { "@": path.resolve(".") } },
  esbuild: { jsx: "automatic" },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.unit.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          setupFiles: ["tests/browser/setup.ts"],
          include: ["tests/browser/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
