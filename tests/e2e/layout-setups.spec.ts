import { expect, test } from "@playwright/test";

import { createCareerDocument } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";

for (const narrow of [false, true])
  test(`layout and reusable setups persist through navigation and recovery (${narrow ? "phone" : "desktop"})`, async ({
    page,
  }) => {
    await page.setViewportSize(
      narrow ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const document = createCareerDocument();
    const resume = createResume(document, "en-US");
    resume.id = "application";
    resume.name = "Application";
    document.resumes = [
      resume,
      ...Array.from({ length: 24 }, (_, index) => ({
        ...createResume(document, "en-US"),
        name: `Other application ${index + 1}`,
      })),
    ];
    document.presets = [
      {
        id: "compact",
        name: "Compact",
        template: resume.template,
        layout: { ...resume.layout, marginLeft: 18 },
      },
    ];
    document.starters = [
      {
        id: "structure",
        name: "Empty structure",
        template: resume.template,
        layout: { ...resume.layout, paper: "letter" },
        summaryIncluded: false,
        sections: [
          {
            id: "work-slot",
            kind: "experience",
            icon: "briefcase-business",
            label: "Experience",
            hidden: false,
            visibleFields: ["title"],
          },
        ],
      },
    ];
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Career details.*Overview/ }),
    ).toBeVisible();
    await page.evaluate(async (document) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("verso-local");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("heads", "readwrite");
          const get = tx.objectStore("heads").get("guest");
          get.onsuccess = () =>
            tx.objectStore("heads").put({ ...get.result, document }, "guest");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      });
    }, document);
    await page.goto("/?scope=library");
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .nth(0)
      .click();
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/scope=presets/);
    await page
      .getByRole("navigation", { name: "Location" })
      .getByRole("button", { name: "Library", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .nth(0)
      .click();
    await expect(page.getByRole("navigation", { name: "Location" })).toHaveText(
      /Library.*Layout presets/,
    );
    const navigation = narrow
      ? page.getByRole("dialog", { name: "Verso workspace", exact: true })
      : page.getByRole("navigation", {
          name: "Workspace navigation",
          exact: true,
        });
    if (!(await navigation.isVisible()))
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
    await expect(
      navigation.getByRole("button", { name: "Layout presets", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("button", { name: "Resume starters", exact: true }),
    ).toBeVisible();
    if (narrow)
      await navigation
        .getByRole("button", { name: "Close navigation", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Apply preset…", exact: true })
      .click();
    const useDialog = page.getByRole("dialog", {
      name: "Apply preset",
      exact: true,
    });
    await expect(
      useDialog.getByRole("button", { name: "Load into layout" }),
    ).toBeDisabled();
    await useDialog
      .getByRole("combobox", { name: "Resume", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Application", exact: true })
      .click();
    await useDialog
      .getByRole("button", { name: "Load into layout", exact: true })
      .click();
    await expect(page.getByRole("navigation", { name: "Location" })).toHaveText(
      /Resumes.*Application.*Layout/,
    );
    await expect(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    ).toHaveValue("18");
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /^Saved locally.*revision 1$/ }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    ).toHaveValue("18");
    await expect(
      page.getByRole("button", {
        name: "Layout presets (optional)",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    await page
      .getByRole("button", { name: "Layout presets (optional)", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Search presets", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Save as preset…", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Preset name", exact: true })
      .fill("Application style");
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Application style", exact: true }),
    ).toBeVisible();
    if (!(await navigation.isVisible()))
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
    await navigation
      .getByRole("button", { name: "Resumes", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Resume collection" })
      .getByRole("button", { name: "Create resume", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Blank resume", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("textbox", { name: "Resume name", exact: true })
      .fill("From starter");
    await page
      .getByRole("button", { name: "From starter", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Starter", exact: true }).click();
    await page
      .getByRole("option", { name: "Empty structure", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create resume", exact: true })
      .click();
    await expect(
      page.getByRole("tab", { name: "Content & order", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Content & order", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Layout", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Paper: US Letter", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(
      page.getByRole("tab", { name: "Content & order", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    // Library creation shares the dialog and preselects the starter, without creating on open.
    await page.goto("/?scope=starters");
    await page
      .getByRole("button", { name: "Create resume…", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "From starter", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Starter", exact: true })
        .locator('[data-slot="select-value"]'),
    ).toHaveText("Empty structure");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Location" })).toHaveText(
      /Library.*Resume starters/,
    );
    // Short screens must keep Library and utilities reachable even with growing collections.
    await page.setViewportSize(
      narrow ? { width: 390, height: 430 } : { width: 1440, height: 430 },
    );
    if (!(await navigation.isVisible()))
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
    const libraryLink = navigation.getByRole("button", {
      name: "Library",
      exact: true,
    });
    await libraryLink.scrollIntoViewIfNeeded();
    await libraryLink.focus();
    await libraryLink.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Library", exact: true }),
    ).toBeVisible();
    if (narrow) {
      // Navigation closes the mobile sheet. Wait for that close to finish
      // before opening it again instead of sampling its exit animation.
      await expect(navigation).toBeHidden();
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
      await expect(navigation).toBeVisible();
    }
    await navigation
      .getByRole("button", { name: "Layout presets", exact: true })
      .scrollIntoViewIfNeeded();
    await navigation
      .getByRole("button", { name: "Layout presets", exact: true })
      .click();
    await expect(page.getByRole("navigation", { name: "Location" })).toHaveText(
      /Library.*Layout presets/,
    );
  });
