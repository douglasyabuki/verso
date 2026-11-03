import type { Page } from "@playwright/test";
import { build } from "esbuild";

let bundled: Promise<string> | undefined;
let pdfBundle: Promise<string> | undefined;

/** Install the pinned PDF.js inspector only in PDF acceptance pages. */
export async function installPdfInspector(page: Page) {
  pdfBundle ??= build({
    stdin: {
      contents: 'export * from "./tests/e2e/pdf-inspector";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "careerPdf",
    platform: "browser",
    minify: true,
  }).then((result) => result.outputFiles[0].text);
  await page.addScriptTag({ content: await pdfBundle });
}

/** Load real domain/controller/storage code into an isolated production-page test.
 * This harness adds no application route or production dependency.
 */
export async function installHarness(page: Page) {
  bundled ??= build({
    stdin: {
      contents:
        'export * from "./lib/career/model"; export * from "./lib/career/output"; export * from "./stores/career/controller"; export * from "./stores/career/persistence"; export * from "./tools/compiler-proof/compiler.mjs";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "careerHarness",
    platform: "browser",
    minify: true,
  }).then((result) => result.outputFiles[0].text);
  await page.addScriptTag({ content: await bundled });
}

declare global {
  interface Window {
    careerHarness: typeof import("@/lib/career/model") &
      typeof import("@/lib/career/output") &
      typeof import("@/stores/career/controller") &
      typeof import("@/stores/career/persistence") &
      typeof import("@/tools/compiler-proof/compiler.mjs");
    careerPdf: typeof import("./pdf-inspector");
  }
}
