import { randomBytes, randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { createCareerDocument } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { accountsTestEnv } from "@/playwright.accounts.config";
import {
  database,
  editFullName,
  saveButton,
  setupAccountTests,
  signIn,
  status,
} from "@/tests/support/e2e/accounts";
setupAccountTests();

/** Seed a committed workspace with one resume and a public link whose latest
 * release is version 1 and whose version 2 is pinned only. */
async function seedPublishedWorkspace(userId: string) {
  const document = createCareerDocument();
  const resume = createResume(document, "en-US");
  resume.name = "Published application";
  document.resumes = [resume];
  const workspaceId = randomUUID();
  await database.query(
    `INSERT INTO account_workspace ("userId", "workspaceId", revision, generation, document, "updatedAt")
     VALUES ($1, $2, 1, 0, $3, now())`,
    [userId, workspaceId, JSON.stringify(document)],
  );
  const linkId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const releases = [randomUUID(), randomUUID()];
  await database.query(
    `INSERT INTO public_link (id, "userId", token, "resumeId", "resumeName", "latestReleaseId", "nextNumber", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 3, now())`,
    [linkId, userId, token, resume.id, resume.name, releases[0]],
  );
  for (const [index, id] of releases.entries())
    await database.query(
      `INSERT INTO public_release (id, "linkId", "userId", number, "operationId", "requestHash", "resumeId",
         "workspaceId", revision, generation, fingerprint, "sourceSha256", locale, "templateId", "runtimeId",
         "settingsSha256", "pdfSha256", bytes, "fileName", pdf)
       VALUES ($1, $2, $3, $4, $5, 'hash', $6, $7, 1, 0, 'fingerprint', 'source', 'en-US',
         'yabuki-reference@1.0.3', 'runtime', 'settings', 'pdf', 9, 'release.pdf', $8)`,
      [
        id,
        linkId,
        userId,
        index + 1,
        randomUUID(),
        resume.id,
        workspaceId,
        Buffer.from("%PDF-1.4\n"),
      ],
    );
  return { workspaceId, token };
}

async function workspaceRow(userId: string) {
  const result = await database.query<{
    workspaceId: string;
    revision: number;
  }>(
    `SELECT "workspaceId", revision FROM account_workspace WHERE "userId" = $1`,
    [userId],
  );
  return result.rows[0];
}

async function count(table: string, userId: string) {
  const result = await database.query<{ count: string }>(
    `SELECT count(*) FROM ${table} WHERE "userId" = $1`,
    [userId],
  );
  return Number(result.rows[0].count);
}

/** Count this browser's stored account recovery for the owner. */
function storedDrafts(page: Page, userId: string) {
  return page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const total = await new Promise<number>((resolve, reject) => {
      const request = database
        .transaction("drafts", "readonly")
        .objectStore("drafts")
        .count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return total;
  }, `verso-account-${userId}`);
}

async function openDeletion(page: Page) {
  await page.goto("/app/settings/data");
  await page
    .getByRole("region", { name: "Delete workspace data" })
    .getByRole("button", { name: "Delete workspace data", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete workspace data permanently?",
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function confirmDeletion(page: Page) {
  const dialog = page.getByRole("alertdialog", {
    name: "Delete workspace data permanently?",
  });
  await dialog
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete workspace data", exact: true })
    .click();
}

test("deletes the account workspace and public PDFs, keeps the session, and clears another device", async ({
  page,
  browser,
}) => {
  const { userId } = await signIn(page.context());
  const { workspaceId, token } = await seedPublishedWorkspace(userId);
  expect((await page.request.get(`/pdf/${token}`)).status()).toBe(200);
  expect((await page.request.get(`/pdf/${token}/2`)).status()).toBe(200);

  // Another device of the same user has unsaved, stored recovery.
  const remote = await browser.newContext();
  await signIn(remote, userId);
  const device = await remote.newPage();
  await device.goto("/app");
  await editFullName(device, "Typed on another device");
  await expect.poll(() => storedDrafts(device, userId)).toBe(1);

  const dialog = await openDeletion(page);
  await expect(dialog).toContainText("You'll stay signed in");
  await expect(dialog).toContainText("including pinned versions");
  await expect(dialog).toContainText(
    "1 public PDF link and 2 published versions",
  );
  await confirmDeletion(page);
  await expect(page.getByText("Workspace data deleted")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeHidden();

  for (const path of [`/pdf/${token}`, `/pdf/${token}/1`, `/pdf/${token}/2`])
    expect((await page.request.get(path)).status()).toBe(404);
  const fresh = await workspaceRow(userId);
  expect(fresh.workspaceId).not.toBe(workspaceId);
  expect(await count("public_link", userId)).toBe(0);
  expect(await count("public_release", userId)).toBe(0);
  expect(await count("account_previous_workspace", userId)).toBe(0);
  expect(await count("session", userId)).toBe(2);
  await page.reload();
  await expect(status(page, /^Saved to account · revision 2$/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Published application (en-US)" }),
  ).toHaveCount(0);

  // The other device's stale Save is rejected; it adopts the fresh workspace
  // and clears its stale recovery when it reconciles.
  await saveButton(device).click();
  await expect(
    device.getByText("Workspace data was deleted in another tab or device"),
  ).toBeVisible();
  await expect(device.getByRole("textbox", { name: "Full name" })).toBeHidden();
  expect(await storedDrafts(device, userId)).toBe(0);
  expect(await workspaceRow(userId)).toEqual(fresh);
  await remote.close();
});

test("resolves a lost deletion response from the receipt without touching new work", async ({
  page,
}) => {
  const { userId } = await signIn(page.context());
  await page.goto("/app");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  const original = await workspaceRow(userId);
  let lost = false;
  await page.route("**/api/account/workspace/reset", async (route) => {
    if (lost || route.request().method() !== "POST") return route.continue();
    lost = true;
    await route.fetch(); // the server deletes...
    await route.abort("connectionreset"); // ...but the response is lost
  });
  await openDeletion(page);
  await confirmDeletion(page);
  await expect(page.getByText("Workspace data deleted")).toBeVisible();
  const fresh = await workspaceRow(userId);
  expect(fresh.workspaceId).not.toBe(original.workspaceId);

  await editFullName(page, "New work after deletion");
  await saveButton(page).click();
  await expect(
    status(
      page,
      new RegExp(`^Saved to account · revision ${fresh.revision + 1}$`),
    ),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "New work after deletion",
  );
  expect(await workspaceRow(userId)).toEqual({
    workspaceId: fresh.workspaceId,
    revision: fresh.revision + 1,
  });
});

test("keeps an undelivered deletion pending until Keep workspace cancels it on the server", async ({
  page,
}) => {
  const { userId, sessionId } = await signIn(page.context());
  await page.goto("/app");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  const original = await workspaceRow(userId);
  let blocked = false;
  await page.route("**/api/account/workspace/reset", async (route) => {
    if (blocked || route.request().method() !== "POST") return route.continue();
    blocked = true;
    await route.abort("connectionreset"); // never reaches the server
  });
  await openDeletion(page);
  await confirmDeletion(page);
  const pending = page.getByRole("alertdialog", {
    name: "Deletion not confirmed yet",
  });
  await expect(pending).toContainText("could still complete");
  await expect(
    pending.getByRole("button", { name: "Retry deletion" }),
  ).toBeVisible();
  await pending.getByRole("button", { name: "Keep workspace" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Deletion cancelled" }),
  ).toBeVisible();
  expect(await workspaceRow(userId)).toEqual(original);

  // A delayed copy of the original request can no longer delete.
  const tombstone = await database.query<{ operationId: string }>(
    `SELECT "operationId" FROM account_operation WHERE "userId" = $1 AND kind = 'reset-cancelled'`,
    [userId],
  );
  const replay = await page.request.post("/api/account/workspace/reset", {
    headers: {
      origin: accountsTestEnv.BETTER_AUTH_URL,
      "X-Verso-Session": sessionId,
    },
    data: {
      operationId: tombstone.rows[0].operationId,
      reviewed: { ...original, generation: 0 },
      confirmation: "DELETE",
    },
  });
  expect(replay.status()).toBe(409);
  expect((await replay.json()).code).toBe("deletion_cancelled");
  expect(await workspaceRow(userId)).toEqual(original);
});
