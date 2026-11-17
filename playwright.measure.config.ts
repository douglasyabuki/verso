import { defineConfig, devices } from "@playwright/test";

import application from "./playwright.config";

// Capacity and compiler measurements are explicit acceptance work, separate
// from routine regression runs. No retries or skipped behavioral cases.
export default defineConfig({
  ...application,
  testDir: "./tests/measurements",
  testIgnore: [],
  testMatch: /workspace-performance\.spec\.ts/,
  outputDir: "test-results/measure",
  workers: 1,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
