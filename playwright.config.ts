import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Keep managed browsers inside the workspace, including on restricted machines.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  ".cache/ms-playwright",
);

const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /workspace-performance\.spec\.ts/,
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: /(storage-quota|workspace-performance)\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /(storage-quota|workspace-performance)\.spec\.ts/,
    },
  ],
  webServer: {
    command:
      "npm run build && npm run start -- --hostname localhost --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 300_000,
  },
});
