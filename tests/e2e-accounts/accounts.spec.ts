import { createHmac, randomUUID } from "node:crypto";

import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Client } from "pg";

import { accountsTestEnv } from "../../playwright.accounts.config";

const database = new Client({ connectionString: accountsTestEnv.DATABASE_URL });

test.beforeAll(async () => {
  await database.connect();
});

test.afterAll(async () => {
  await database.end();
});

/** Create a user and database session as a provider callback would, and sign the browser in. */
async function signIn(context: BrowserContext, userId = randomUUID()) {
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

function saveButton(page: Page) {
  return page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true });
}

test("saves to the account, survives reload, and isolates another user", async ({
  page,
  browser,
}) => {
  const { userId } = await signIn(page.context());
  await page.goto("/");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await editFullName(page, "Ana Account");
  await saveButton(page).click();
  await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();
  expect(await revision(userId)).toBe(1);

  await page.reload();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "Ana Account",
  );

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(other);
  await otherPage.goto("/");
  await expect(
    status(otherPage, /^Saved to account · revision 0$/),
  ).toBeVisible();
  await otherPage.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(
    otherPage.getByRole("textbox", { name: "Full name" }),
  ).toHaveValue("");
  const api = await otherPage.request.get("/api/account/workspace");
  expect(api.status()).toBe(403); // no session-binding header: rejected
  await other.close();
});

test("retries an interrupted Save with the same operation and commits once", async ({
  page,
}) => {
  const { userId } = await signIn(page.context());
  await page.goto("/");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  let dropped = false;
  await page.route("**/api/account/workspace/operations", async (route) => {
    if (dropped) return route.continue();
    dropped = true;
    await route.fetch(); // the server commits...
    await route.abort("connectionreset"); // ...but the response is lost
  });
  await editFullName(page, "Interrupted");
  await saveButton(page).click();
  await expect(
    status(page, "Not yet saved to your account · kept on this device"),
  ).toBeVisible();
  expect(await revision(userId)).toBe(1);

  await saveButton(page).click();
  await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();
  expect(await revision(userId)).toBe(1);
});

test("keeps the draft when the session expires before Save", async ({
  page,
}) => {
  const { userId, sessionId } = await signIn(page.context());
  await page.goto("/");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await database.query(
    `UPDATE session SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`,
    [sessionId],
  );
  await editFullName(page, "Expired session");
  await saveButton(page).click();
  await expect(
    status(page, "Not saved to your account · sign in again"),
  ).toBeVisible();
  await expect(page.getByText("Your sign-in expired").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "Expired session",
  );
  expect(await revision(userId)).toBe(0);
});

test("signs out with unconfirmed work kept on this device for the same user", async ({
  page,
}) => {
  const { userId } = await signIn(page.context());
  await page.goto("/");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await page.route("**/api/account/workspace/operations", (route) =>
    route.abort("internetdisconnected"),
  );
  await editFullName(page, "Pending on device");
  await saveButton(page).click();
  await expect(
    status(page, "Not yet saved to your account · kept on this device"),
  ).toBeVisible();

  await page.goto("/?scope=settings/account");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("button", { name: "Sign out", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("not been confirmed by your account");
  await confirm.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    settings.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  expect(await revision(userId)).toBe(0);

  await page.unroute("**/api/account/workspace/operations");
  await signIn(page.context(), userId);
  await page.goto("/?scope=settings/data");
  await expect(page.getByLabel("Unresolved recovery")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore draft" }).first(),
  ).toBeVisible();
});

test("imports the guest workspace only after review and leaves it unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await expect(status(page, /^Saved locally · revision 0$/)).toBeVisible();
  await editFullName(page, "Guest Author");
  await saveButton(page).click();
  await expect(status(page, /^Saved locally · revision 1$/)).toBeVisible();

  const { userId } = await signIn(page.context());
  await page.goto("/?scope=settings/account");
  // The modal Settings dialog hides the toolbar status; wait on panel content.
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings.getByText("Signed in as")).toBeVisible();
  await settings
    .getByRole("button", { name: "Review guest workspace import" })
    .click();
  const review = page.getByRole("dialog", {
    name: "Review guest workspace import",
  });
  await expect(review).toContainText("Nothing is merged");
  await review
    .getByRole("button", { name: "Continue without exporting snapshot" })
    .click();
  await review.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(review).toBeHidden();
  await expect.poll(() => revision(userId)).toBe(1);
  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "Guest Author",
  );
  const guest = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("verso-local", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction("heads")
            .objectStore("heads")
            .get("guest");
          get.onsuccess = () => {
            resolve(
              String(
                get.result.document.profile.fields.find(
                  (field: { key: string }) => field.key === "fullName",
                )?.wording?.["en-US"] ?? "",
              ),
            );
            open.result.close();
          };
        };
      }),
  );
  expect(guest).toBe("Guest Author");
});
