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
    document.resumes = [resume];
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
    await page.goto("/?scope=resume-layout/application");
    await page
      .getByRole("combobox", { name: "Layout preset", exact: true })
      .click();
    await page.getByRole("option", { name: "Compact", exact: true }).click();
    await page
      .getByRole("button", { name: "Load into layout", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    ).toHaveValue("18");
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    ).toHaveValue("18");
    await page
      .getByRole("button", { name: "Save as preset", exact: true })
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
    await page
      .getByRole("button", { name: "Back to resumes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create resume", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Resume name", exact: true })
      .fill("From starter");
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
  });
