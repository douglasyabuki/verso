import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  database,
  setupAccountTests,
  signIn,
  status,
} from "@/tests/support/e2e/accounts";
setupAccountTests();

async function connectGithub(userId: string) {
  await database.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", "updatedAt")
     VALUES ($1, $2, 'github', $3, now())`,
    [randomUUID(), randomUUID(), userId],
  );
}

test("signed-in visitors skip the welcome and auth pages, returning to their destination", async ({
  page,
}) => {
  await signIn(page.context());
  await page.goto("/");
  await expect(page).toHaveURL(/\/app$/);
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await page.goto("/sign-in?next=%2Fapp%2Fsettings%2Faccount");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
});

test("connected accounts show linked methods and keep the last one", async ({
  page,
}) => {
  const { userId } = await signIn(page.context());
  await connectGithub(userId);
  await page.goto("/app/settings/account");
  const section = page.getByRole("region", { name: "Connected accounts" });
  await expect(section.getByText("Connected", { exact: true })).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Disconnect GitHub" }),
  ).toBeDisabled();
  await expect(
    section.getByText("Keep at least one sign-in method connected."),
  ).toBeVisible();
});

test("deleting the account removes it and its sessions, then shows the welcome page", async ({
  page,
}) => {
  const { userId } = await signIn(page.context());
  await connectGithub(userId);
  await page.goto("/app");
  await expect(status(page, /^Saved to account · revision 0$/)).toBeVisible();
  await page.goto("/app/settings/account");
  await page
    .getByRole("region", { name: "Delete account" })
    .getByRole("button", { name: "Delete account" })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete your account permanently?",
  });
  const confirm = dialog.getByRole("button", {
    name: "Permanently delete account",
  });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await confirm.click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "One career record. Every tailored resume.",
    }),
  ).toBeVisible();
  const users = await database.query(`SELECT id FROM "user" WHERE id = $1`, [
    userId,
  ]);
  expect(users.rowCount).toBe(0);
  const sessions = await database.query(
    `SELECT id FROM session WHERE "userId" = $1`,
    [userId],
  );
  expect(sessions.rowCount).toBe(0);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("session_token"))).toBe(
    false,
  );
});
