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

function saveButton(page: Page, name = "Save") {
  return page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name, exact: true });
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

  // The prepared request keeps its operation ID; Save becomes an explicit retry.
  await saveButton(page, "Retry save").click();
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

/** Count freshness reads (full or conditional workspace loads) made by one page. */
function countWorkspaceReads(page: Page) {
  const reads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/account/workspace") reads.push(url.search);
  });
  return reads;
}

async function focus(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}

test.describe("account sync", () => {
  test("concurrent same-scope Saves commit one version and retain the losing draft", async ({
    browser,
  }) => {
    const userId = randomUUID();
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    try {
      await signIn(deviceA, userId);
      await signIn(deviceB, userId);
      const a = await deviceA.newPage();
      const b = await deviceB.newPage();
      await a.goto("/");
      await b.goto("/");
      await expect(status(b, /^Saved to account · revision 0$/)).toBeVisible();
      await editFullName(a, "Concurrent A");
      await editFullName(b, "Concurrent B");

      // Hold both requests until both clients have dispatched from revision 0.
      let arrived = 0;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      for (const page of [a, b]) {
        await page.route(
          "**/api/account/workspace/operations",
          async (route) => {
            if (++arrived === 2) release();
            await ready;
            await route.continue();
          },
        );
      }
      await Promise.all([saveButton(a).click(), saveButton(b).click()]);
      await expect
        .poll(async () => {
          return (
            (await a
              .getByRole("region", { name: "Conflicting versions" })
              .count()) +
            (await b
              .getByRole("region", { name: "Conflicting versions" })
              .count())
          );
        })
        .toBe(1);
      expect(await revision(userId)).toBe(1);
      const loser = (await a
        .getByRole("region", { name: "Conflicting versions" })
        .count())
        ? a
        : b;
      const panel = loser.getByRole("region", { name: "Conflicting versions" });
      await expect(panel).toContainText("Concurrent A");
      await expect(panel).toContainText("Concurrent B");
      await expect(
        loser.getByRole("textbox", { name: "Full name" }),
      ).toHaveValue(loser === a ? "Concurrent A" : "Concurrent B");
    } finally {
      await deviceA.close();
      await deviceB.close();
    }
  });

  test("checks once on returning after a long suspended clock and retains a conflicting draft", async ({
    browser,
  }) => {
    const userId = randomUUID();
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    try {
      await signIn(deviceA, userId);
      await signIn(deviceB, userId);
      const a = await deviceA.newPage();
      const b = await deviceB.newPage();
      await b.clock.install();
      await a.goto("/");
      await b.goto("/");
      await expect(status(b, /^Saved to account · revision 0$/)).toBeVisible();
      await editFullName(b, "Draft before suspension");
      const reads = countWorkspaceReads(b);
      await editFullName(a, "Saved while away");
      await saveButton(a).click();
      await expect(status(a, /^Saved to account · revision 1$/)).toBeVisible();

      // Jump wall time without firing missed timers, as when a sleeping client resumes.
      await b.clock.setSystemTime(Date.now() + 2 * 60 * 60_000);
      await focus(b);
      const panel = b.getByRole("region", { name: "Conflicting versions" });
      await expect(panel).toContainText("Saved while away");
      await expect(panel).toContainText("Draft before suspension");
      await b.clock.runFor(1_000);
      expect(reads).toHaveLength(1);
      expect(await revision(userId)).toBe(1);
    } finally {
      await deviceA.close();
      await deviceB.close();
    }
  });

  test("switching accounts during a freshness response never adopts the previous owner's content", async ({
    page,
    browser,
  }) => {
    const ownerA = await signIn(page.context());
    await page.clock.install();
    await page.goto("/");
    await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
    await editFullName(page, "Private to A");
    await saveButton(page).click();
    await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();

    // Make the held response carry a newer private document, rather than an
    // unchanged-identity response, using an independent storage context.
    const remote = await browser.newContext();
    try {
      await signIn(remote, ownerA.userId);
      const other = await remote.newPage();
      await other.goto("/");
      await editFullName(other, "Private remote A");
      await saveButton(other).click();
      await expect(
        status(other, /^Saved to account · revision 2$/),
      ).toBeVisible();
    } finally {
      await remote.close();
    }

    let captured!: () => void;
    const requested = new Promise<void>((resolve) => {
      captured = resolve;
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/account/workspace?*", async (route) => {
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response }).catch(() => {}); // owner disposal may abort it
    });
    await page.clock.runFor(61_000);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await requested;
    const ownerB = await signIn(page.context());
    await focus(page);
    await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
    release();
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
      "",
    );
    await page.getByRole("textbox", { name: "Full name" }).fill("Private to B");
    await saveButton(page).click();
    await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();
    expect(await revision(ownerA.userId)).toBe(2);
    expect(await revision(ownerB.userId)).toBe(1);
    await page.reload();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
      "Private to B",
    );
  });

  test("shows another device's Save after a focus check, without refetching unchanged documents", async ({
    browser,
  }) => {
    const userId = randomUUID();
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    await signIn(deviceA, userId);
    await signIn(deviceB, userId);
    const a = await deviceA.newPage();
    const b = await deviceB.newPage();
    await b.clock.install();
    await a.goto("/");
    await b.goto("/");
    await expect(status(b, /^Saved to account · revision 0$/)).toBeVisible();
    const reads = countWorkspaceReads(b);

    // A focus check inside the shared 60-second bound sends nothing.
    await focus(b);
    await b.clock.runFor(1_000);
    expect(reads).toHaveLength(0);

    await b.clock.runFor(61_000);
    await focus(b);
    await expect.poll(() => reads.length).toBe(1);
    expect(reads[0]).toContain("revision=0");
    await expect(status(b, /^Saved to account · revision 0$/)).toBeVisible();

    await editFullName(a, "Saved on device A");
    await saveButton(a).click();
    await expect(status(a, /^Saved to account · revision 1$/)).toBeVisible();

    const savedAt = Date.now();
    await b.clock.runFor(61_000);
    await focus(b);
    await expect(
      status(b, /^Updated from another device or tab · revision 1$/),
    ).toBeVisible();
    console.info(
      "Account sync freshness after focus (ms, wall clock)",
      Date.now() - savedAt,
    );
    await b.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(b.getByRole("textbox", { name: "Full name" })).toHaveValue(
      "Saved on device A",
    );
    await deviceA.close();
    await deviceB.close();
  });

  test("keeps both versions on a same-scope conflict and commits the kept draft once", async ({
    browser,
  }) => {
    const userId = randomUUID();
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    await signIn(deviceA, userId);
    await signIn(deviceB, userId);
    const a = await deviceA.newPage();
    const b = await deviceB.newPage();
    await a.goto("/");
    await b.goto("/");
    await expect(status(b, /^Saved to account · revision 0$/)).toBeVisible();

    await editFullName(b, "Device B draft");
    await editFullName(a, "Device A saved");
    await saveButton(a).click();
    await expect(status(a, /^Saved to account · revision 1$/)).toBeVisible();

    await saveButton(b).click();
    const panel = b.getByRole("region", { name: "Conflicting versions" });
    await expect(panel).toContainText("Device A saved");
    await expect(panel).toContainText("Device B draft");
    expect(await revision(userId)).toBe(1);

    await panel.getByRole("button", { name: "Keep my draft" }).click();
    await expect(panel).toBeHidden();
    await saveButton(b).click();
    await expect(status(b, /^Saved to account · revision 2$/)).toBeVisible();
    expect(await revision(userId)).toBe(2);
    await deviceA.close();
    await deviceB.close();
  });

  test("checks an offline Save's status on reconnect and retries only when asked", async ({
    page,
  }) => {
    const { userId } = await signIn(page.context());
    await page.goto("/");
    await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
    await editFullName(page, "Written offline");
    await page.context().setOffline(true);
    await saveButton(page).click();
    await expect(
      status(page, "Not yet saved to your account · kept on this device"),
    ).toBeVisible();

    const lookups: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/account/workspace/operations/"))
        lookups.push(request.url());
    });
    await page.context().setOffline(false);
    await expect.poll(() => lookups.length).toBe(1);
    expect(await revision(userId)).toBe(0);

    await saveButton(page, "Retry save").click();
    await expect(status(page, /^Saved to account · revision 1$/)).toBeVisible();
    expect(await revision(userId)).toBe(1);
  });

  test("an idle visible tab stops periodic checks until input returns", async ({
    page,
  }) => {
    await signIn(page.context());
    await page.clock.install();
    await page.goto("/");
    await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
    const reads = countWorkspaceReads(page);

    // Periodic checks every 5 minutes while active. Each step lets the check's
    // request run before advancing the fake clock again.
    await page.clock.runFor(5 * 60_000);
    await expect.poll(() => reads.length).toBe(1);
    await page.clock.runFor(5 * 60_000);
    await expect.poll(() => reads.length).toBe(2);
    // The next due check falls after 15 minutes without input: none are sent.
    await page.clock.runFor(6 * 60_000);
    await page.clock.runFor(60 * 60_000);
    await page.waitForTimeout(500);
    expect(reads).toHaveLength(2);
    const active = reads.length;

    await page.keyboard.press("Shift");
    await expect.poll(() => reads.length).toBe(active + 1);
  });

  test("an expired session stops sync checks and keeps the draft", async ({
    page,
  }) => {
    const { sessionId } = await signIn(page.context());
    await page.clock.install();
    await page.goto("/");
    await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
    await editFullName(page, "Draft before expiry");
    const reads = countWorkspaceReads(page);
    await database.query(
      `UPDATE session SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`,
      [sessionId],
    );
    await page.clock.runFor(61_000);
    await focus(page);
    await expect.poll(() => reads.length).toBe(1);
    await expect(page.getByText("Your sign-in expired").first()).toBeVisible();

    await page.clock.runFor(30 * 60_000);
    await focus(page);
    expect(reads).toHaveLength(1);
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
      "Draft before expiry",
    );
  });
});
