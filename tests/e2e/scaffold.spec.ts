import { expect, test } from "@playwright/test";

test("the production scaffold loads and survives a reload", async ({
  page,
}) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Next.js logo", exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
