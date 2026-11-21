import { expect, test } from "@playwright/test";

const welcomeHeading = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", {
    level: 1,
    name: "One career record. Every tailored resume.",
  });

test("the welcome page stays visible with guest data, and Continue as guest opens the workspace", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();

  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Continue as guest" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();
});

test("workspace deep links survive reload and legacy links redirect to paths", async ({
  page,
}) => {
  await page.goto("/app/settings/data");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  await page.reload();
  await expect(settings).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings\/data$/);

  await page.goto("/?scope=settings%2Faccount");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(settings).toBeVisible();
});

test("a session cookie routes / to the workspace without rendering the welcome page", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([
      { name: "better-auth.session_token", value: "stale", url: baseURL! },
    ]);
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/app$/);
});

test("auth pages explain a guest-only deployment and keep the guest path", async ({
  page,
}) => {
  await page.goto("/sign-in?next=%2Fapp%2Fresumes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByText("Accounts are not enabled on this deployment."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=%2Fapp%2Fresumes$/);
  await page.getByRole("link", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL(/\/app\/resumes$/);
});
