import { expect, type Page, test } from "@playwright/test";

/** Read the canonical view scope regardless of URL encoding. */
function scope(page: Page) {
  return new URL(page.url()).searchParams.get("scope");
}

for (const narrow of [false, true]) {
  test.describe(`Settings navigation (${narrow ? "phone" : "desktop"})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(
        narrow ? { width: 390, height: 640 } : { width: 1440, height: 900 },
      );
    });

    test("opens from navigation, traverses panel history, and closes to the original workspace", async ({
      page,
    }) => {
      await page.goto("/?scope=library");
      await expect(
        page.getByRole("heading", { name: "Library", exact: true }),
      ).toBeVisible();
      const navigation = narrow
        ? page.getByRole("dialog", { name: "Verso workspace", exact: true })
        : page.getByRole("navigation", {
            name: "Workspace navigation",
            exact: true,
          });
      if (narrow)
        await page
          .getByRole("button", { name: "Expand sidebar", exact: true })
          .click();
      await expect(navigation).toBeVisible();
      await navigation
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      const settings = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await expect(settings).toBeVisible();
      await settings
        .getByRole("button", { name: "Editing & preview", exact: true })
        .click();
      await expect.poll(() => scope(page)).toBe("settings/editing-preview");
      await settings
        .getByRole("button", { name: "Data & backups", exact: true })
        .click();
      await page.goBack();
      await expect(
        settings.getByRole("heading", {
          name: "Editing & preview",
          exact: true,
        }),
      ).toBeVisible();
      await page.goForward();
      await expect(
        settings.getByRole("heading", { name: "Data & backups", exact: true }),
      ).toBeVisible();
      await settings.getByRole("button", { name: "Close settings" }).click();
      await expect(settings).toBeHidden();
      await expect.poll(() => scope(page)).toBe("library");
      await expect(
        page.getByRole("heading", { name: "Library", exact: true }),
      ).toBeVisible();
    });

    test("persists immediate compiler preferences and validates invalid values without applying them", async ({
      page,
    }) => {
      await page.goto("/?scope=settings/editing-preview");
      let settings = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await settings
        .getByRole("button", { name: "Advanced settings", exact: true })
        .click();
      const timeout = settings.getByLabel("Compilation timeout (seconds)");
      await timeout.fill("45");
      await timeout.press("Enter");
      await expect(settings.getByRole("status")).toHaveText(
        /Browser preferences saved/,
      );
      await timeout.fill("0");
      await timeout.press("Enter");
      await expect(
        settings.getByText("Enter seconds between 0.1 and 600."),
      ).toBeVisible();
      await page.reload();
      settings = page.getByRole("dialog", { name: "Settings", exact: true });
      await settings
        .getByRole("button", { name: "Advanced settings", exact: true })
        .click();
      await expect(
        settings.getByLabel("Compilation timeout (seconds)"),
      ).toHaveValue("45");
      await expect(settings.getByText(/remains manual/)).toBeVisible();
    });

    test("guards defaults on Back, retains canceled edits through a data detour, and saves explicitly", async ({
      page,
    }) => {
      await page.goto("/?scope=settings/appearance");
      const settings = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await settings
        .getByRole("button", { name: "Resume defaults", exact: true })
        .click();
      await settings.getByLabel("Text size (pt)", { exact: true }).fill("12");
      await page.goBack();
      const guard = page.getByRole("dialog", {
        name: "Unsaved form",
        exact: true,
      });
      await expect(guard).toBeVisible();
      await guard.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect.poll(() => scope(page)).toBe("settings/defaults");
      await settings
        .getByRole("button", { name: "Data & backups", exact: true })
        .click();
      await expect(
        settings.getByRole("button", { name: "Export recovery", exact: true }),
      ).toBeVisible();
      await settings
        .getByRole("button", { name: "Back to editing", exact: true })
        .click();
      await expect(
        settings.getByLabel("Text size (pt)", { exact: true }),
      ).toHaveValue("12");
      await settings.getByRole("button", { name: "Save", exact: true }).click();
      await expect(
        settings.getByRole("button", { name: "Save", exact: true }),
      ).toBeDisabled();
      await expect(settings.getByRole("status")).toHaveText(
        "No unsaved changes",
      );
      await page.reload();
      await expect(
        settings.getByLabel("Text size (pt)", { exact: true }),
      ).toHaveValue("12");
      await settings.getByRole("button", { name: "Close settings" }).click();
      await expect(settings).toBeHidden();
    });
  });
}

test("normalizes existing Settings links and offers recovery navigation for missing resources", async ({
  page,
}) => {
  for (const [alias, canonical] of [
    ["backups", "settings/data"],
    ["languages", "settings/languages"],
  ]) {
    await page.goto(`/?scope=${alias}`);
    await expect(
      page.getByRole("dialog", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect.poll(() => scope(page)).toBe(canonical);
  }
  for (const destination of [
    "settings/unknown",
    "entry/missing",
    "list/missing",
    "resume-overview/missing",
    "preset/missing",
    "starter/missing",
    "new-section/missing",
  ]) {
    await page.goto(`/?scope=${encodeURIComponent(destination)}`);
    await expect(
      page.getByRole("heading", { name: "Record unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Career details", exact: true }),
    ).toBeVisible();
  }
});
