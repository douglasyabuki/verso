import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Keep managed browsers inside the workspace, including on restricted machines.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  ".cache/ms-playwright",
);

// Use IPv4 loopback consistently so readiness cannot find an unrelated IPv6 server.
const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e/guest",
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  // Each Playwright config owns its output directory: a run empties it on start,
  // so a shared folder would delete another run's in-progress trace artifacts.
  outputDir: "test-results/e2e",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: /storage-quota\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /storage-quota\.spec\.ts/,
    },
  ],
  webServer: {
    command:
      "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    // Guest acceptance must stay guest-only even when local account env exists.
    // Explicit process values take precedence over Next's .env files.
    env: {
      DATABASE_URL: "",
      BETTER_AUTH_SECRET: "",
      BETTER_AUTH_URL: baseURL,
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 300_000,
  },
});
