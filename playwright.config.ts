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
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm run build && npm run start -- --hostname localhost --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
