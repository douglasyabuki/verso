import { expect, test } from "@playwright/test";

import {
  database,
  editFullName,
  revision,
  saveButton,
  setupAccountTests,
  signIn,
  status,
} from "@/tests/support/e2e/accounts";
setupAccountTests();

test("saves to the account, survives reload, and isolates another user", async ({
  page,
  browser,
}) => {
  const { userId } = await signIn(page.context());
  await page.goto("/app");
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
  await otherPage.goto("/app");
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
  await page.goto("/app");
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
  await page.goto("/app");
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
  await page.goto("/app");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await page.route("**/api/account/workspace/operations", (route) =>
    route.abort("internetdisconnected"),
  );
  await editFullName(page, "Pending on device");
  await saveButton(page).click();
  await expect(
    status(page, "Not yet saved to your account · kept on this device"),
  ).toBeVisible();

  await page.goto("/app/settings/account");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("button", { name: "Sign out", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("not been confirmed by your account");
  await confirm.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    settings.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(await revision(userId)).toBe(0);

  await page.unroute("**/api/account/workspace/operations");
  await signIn(page.context(), userId);
  await page.goto("/app/settings/data");
  await expect(
    page.getByRole("region", { name: "Unsaved drafts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore draft" }).first(),
  ).toBeVisible();
});

test("imports the guest workspace only after review and leaves it unchanged", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(status(page, /^Saved locally · revision 0$/)).toBeVisible();
  await editFullName(page, "Guest Author");
  await saveButton(page).click();
  await expect(status(page, /^Saved locally · revision 1$/)).toBeVisible();

  const { userId } = await signIn(page.context());
  await page.goto("/app/settings/account");
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

  await page.goto("/app");
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

test.describe("account sync", () => {
  test("switching accounts during a freshness response never adopts the previous owner's content", async ({
    page,
    browser,
  }) => {
    const ownerA = await signIn(page.context());
    await page.clock.install();
    await page.goto("/app");
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
      await other.goto("/app");
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
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
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
});
