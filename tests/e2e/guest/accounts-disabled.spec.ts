import { expect, test } from "@playwright/test";

test("a deployment without account configuration stays guest-only", async ({
  page,
  request,
}) => {
  expect(await (await request.get("/api/auth-options")).json()).toEqual({
    github: false,
    google: false,
  });
  const workspace = await request.get("/api/account/workspace");
  expect(workspace.status()).toBe(503);
  expect(await workspace.json()).toMatchObject({ code: "unavailable" });

  await page.goto("/app/settings/account");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(
    settings.getByText("Accounts are not enabled on this deployment."),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /^Saved locally · revision 0$/ }),
  ).toBeVisible();
});
