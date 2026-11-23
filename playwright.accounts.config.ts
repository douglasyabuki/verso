import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  ".cache/ms-playwright",
);

const baseURL = "http://127.0.0.1:3101";

/** Test-only values for an isolated database; not credentials for any real service.
 * OAuth providers are never contacted: specs seed database sessions directly. */
export const accountsTestEnv = {
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: "isolated-account-e2e-secret-with-32-plus-characters",
  GITHUB_CLIENT_ID: "account-e2e-client",
  GITHUB_CLIENT_SECRET: "account-e2e-secret",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

export default defineConfig({
  testDir: "./tests/e2e/accounts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  // Separate from the guest suite so concurrent runs never delete each other's artifacts.
  outputDir: "test-results/accounts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "node tools/accounts-e2e-database.mjs",
      // The app inherits DATABASE_URL. Fixtures read the same URL from the
      // suite-specific variable so they cannot fall back to a local .env URL.
      wait: {
        stdout: new RegExp(
          String.raw`^Account test database ready: (?<DATABASE_URL>(?<ACCOUNTS_E2E_DATABASE_URL>postgresql://postgres@127\.0\.0\.1:\d+/postgres))$`,
          "m",
        ),
      },
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
    },
    {
      command:
        "npm run build && npm run start -- --hostname 127.0.0.1 --port 3101",
      url: baseURL,
      env: accountsTestEnv,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 300_000,
    },
  ],
});
