import { createHmac, randomUUID } from "node:crypto";

import { type BrowserContext, type Page, test } from "@playwright/test";
import { Client } from "pg";

import { accountsTestEnv } from "@/playwright.accounts.config";

let database: Client;

export function setupAccountTests() {
  test.beforeAll(async () => {
    const connectionString = process.env.ACCOUNTS_E2E_DATABASE_URL;
    if (!connectionString)
      throw new Error("Account test database did not start");
    // Playwright can run several files in one worker; closed pg clients cannot reconnect.
    database = new Client({ connectionString });
    await database.connect();
  });

  test.afterAll(async () => {
    await database?.end();
  });
}

let clientIp = 0;

/** Create a user and database session as a provider callback would, and sign the browser in.
 * Each signed-in context gets its own client IP: Better Auth rate-limits per IP and
 * only resets after a quiet window, so one shared localhost bucket would otherwise
 * exhaust across the whole suite. Next.js keeps a client-supplied X-Forwarded-For. */
async function signIn(context: BrowserContext, userId = randomUUID()) {
  clientIp += 1;
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${(process.pid >> 8) & 255}.${process.pid & 255}.${clientIp % 250}`,
  });
  await database.query(
    `INSERT INTO "user" (id, name, email, "updatedAt") VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO NOTHING`,
    [userId, `User ${userId.slice(0, 4)}`, `${userId}@example.test`],
  );
  const sessionId = randomUUID();
  const token = randomUUID();
  await database.query(
    `INSERT INTO session (id, "expiresAt", token, "userId", "updatedAt")
     VALUES ($1, now() + interval '1 day', $2, $3, now())`,
    [sessionId, token, userId],
  );
  const signature = createHmac("sha256", accountsTestEnv.BETTER_AUTH_SECRET)
    .update(token)
    .digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: encodeURIComponent(`${token}.${signature}`),
      url: accountsTestEnv.BETTER_AUTH_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return { userId, sessionId };
}

async function revision(userId: string): Promise<number | undefined> {
  const result = await database.query<{ revision: number }>(
    `SELECT revision FROM account_workspace WHERE "userId" = $1`,
    [userId],
  );
  return result.rows[0]?.revision;
}

function status(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text });
}

async function editFullName(page: Page, name: string) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill(name);
}

function saveButton(page: Page, name = "Save") {
  return page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name, exact: true });
}
export { database, editFullName, revision, saveButton, signIn, status };
