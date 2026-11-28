import { writeFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { createCareerDocument, createEntry } from "@/lib/career/model";

/** Open Settings › Data from the workspace sidebar (desktop or drawer). */
async function openDataSettings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
}

/** Close the durable Settings dialog before interacting with its underlying workspace. */
async function closeSettings(page: Page) {
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await expect(settings).toBeHidden();
}

function fixture(language = "en-US") {
  const document = createCareerDocument(language);
  document.sections = [];
  document.profile.fields[0].wording[language] = "Ana São & Silva";
  const entry = createEntry("experience");
  entry.name = "Fictional role";
  entry.fields[0].wording[language] =
    language === "pt-BR" ? "Engenheira de sistemas" : "Systems engineer";
  entry.fields[1].wording[language] = "Example & Company";
  entry.fields[3].fact = "2024-02";
  entry.achievements.push({
    id: "achievement",
    archived: false,
    wording: { [language]: "Ação segura · 100% delivery" },
  });
  entry.links.push({
    id: "link",
    archived: false,
    url: "https://example.com/?a=1&b=2",
    label: { [language]: "Project details" },
  });
  document.sections.push({
    id: "section",
    name: "Fictional work",
    kind: "experience",
    icon: "briefcase-business",
    heading: {},
    archived: false,
    entries: [entry],
  });
  document.resumes.push({
    id: "resume",
    name: "Application",
    language,
    template: "yabuki-reference@1.0.3",
    selection: [
      {
        sectionId: "section",
        entryIds: [entry.id],
        fieldIds: entry.fields.map((field) => field.id),
        achievementIds: ["achievement"],
        linkIds: ["link"],
      },
    ],
    overrides: {},
    layout: { ...document.defaults },
  });
  return { document, entry };
}

const envelope = (document: ReturnType<typeof fixture>["document"]) => ({
  format: "verso.workspace",
  schemaVersion: 2,
  workspaceId: "external-workspace",
  exportedAt: "2026-11-02T12:00:00.000Z",
  document,
});

async function openFilePicker(page: Page, activate: () => Promise<void>) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    activate(),
  ]);
  return chooser;
}

async function downloadWorkspaceBackup(page: Page) {
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download workspace backup", exact: true })
    .click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as ReturnType<
    typeof envelope
  >;
}

test("workspace loads, saves one-language career wording, and survives reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  expect((await page.goto("/app"))?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Ana Silva");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /^Saved locally · revision 1$/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "Ana Silva",
  );
  expect(errors).toEqual([]);
});

test("Back and Forward guard dirty forms with Cancel/Discard and preserve native draft undo", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  const field = page.getByRole("textbox", {
    name: "Summary",
  });
  await field.fill("Local draft");
  await page.goBack();
  await expect(
    page.getByRole("dialog", { name: "Unsaved form" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Unsaved form" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(field).toHaveText("Local draft");
  await field.press("Control+z");
  await field.press("Control+z");
  await field.press("Control+z");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await field.fill("Another draft");
  await page.goBack();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Career details.*Overview/ }),
  ).toBeVisible();
  await page.goForward();
  await expect(field).toHaveText("");
});

test("reviews replacement, downloads a backup, and restores either workspace", async ({
  page,
}, testInfo) => {
  const { document } = fixture();
  await page.goto("/app");
  await openDataSettings(page);
  await expect(
    page.getByRole("button", { name: "Restore previous workspace" }),
  ).toHaveCount(0);
  const importBackup = page.getByRole("button", {
    name: "Import workspace backup",
  });
  const unsupported = await openFilePicker(page, () => importBackup.click());
  await unsupported.setFiles({
    name: "unsupported.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...envelope(document), schemaVersion: 1 }),
    ),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Action needs attention" }),
  ).toContainText("schemaVersion");
  const backupPath = testInfo.outputPath("workspace.json");
  await writeFile(backupPath, JSON.stringify(envelope(document)));
  const firstPick = await openFilePicker(page, () => importBackup.click());
  await firstPick.setFiles(backupPath);
  const replacement = page.getByRole("dialog", {
    name: "Review workspace replacement",
  });
  await expect(
    replacement.getByText("workspace.json", { exact: true }),
  ).toBeVisible();
  await replacement
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update preview" }),
  ).toHaveCount(0);
  const secondPick = await openFilePicker(page, () => importBackup.click());
  await secondPick.setFiles(backupPath);
  await expect(
    replacement.getByText("Application", { exact: true }),
  ).toBeVisible();
  await expect(
    replacement.getByRole("button", { name: "Continue without downloading" }),
  ).toHaveCount(0);
  await replacement
    .getByRole("button", { name: "Replace workspace", exact: true })
    .click();
  await expect(replacement).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Workspace replaced" }),
  ).toBeVisible();
  const backup = await downloadWorkspaceBackup(page);
  expect(backup.document).toEqual(document);
  expect(backup.schemaVersion).toBe(2);

  await page
    .getByRole("button", { name: "Undo workspace replacement" })
    .click();
  const restore = page.getByRole("dialog", {
    name: "Review workspace restore",
  });
  await expect(restore.getByText("Application", { exact: true })).toBeVisible();
  await expect(
    restore.getByRole("button", { name: "Download previous workspace" }),
  ).toHaveCount(0);
  await expect(
    restore.getByRole("button", { name: "Continue without downloading" }),
  ).toHaveCount(0);
  await restore
    .getByRole("button", { name: "Restore workspace", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Workspace restored" }),
  ).toContainText("workspace you just left");
  await page.reload();
  await page
    .getByRole("button", { name: "Restore previous workspace" })
    .click();
  await expect(restore.getByText("Application", { exact: true })).toBeVisible();
  await restore
    .getByRole("button", { name: "Restore workspace", exact: true })
    .click();
  await expect(restore).toBeHidden();
  await page.getByRole("button", { name: "Load sample workspace" }).click();
  await expect(
    replacement.getByText("Alex Morgan · English", { exact: true }),
  ).toBeVisible();
  await expect(
    replacement.getByRole("button", { name: "Replace workspace", exact: true }),
  ).toBeDisabled();
  await replacement
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.reload();
  await closeSettings(page);
  await page
    .getByRole("button", { name: "Application (en-US)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update preview" }),
  ).toBeVisible();
});

test("opens Restore pickers with the keyboard and retries recovery without saving it", async ({
  page,
  browserName,
}, testInfo) => {
  await page.goto("/app/settings/data");
  const restore = page.getByRole("region", { name: "Restore", exact: true });
  const importBackup = restore.getByRole("button", {
    name: "Import workspace backup",
  });
  const importDrafts = restore.getByRole("button", {
    name: "Import unsaved drafts",
  });
  const drafts = page.getByRole("region", {
    name: "Unsaved drafts",
    exact: true,
  });
  const downloadBackup = page.getByRole("button", {
    name: "Download workspace backup",
  });
  const inputs = restore.locator('input[type="file"]');

  await expect(importBackup).toBeVisible();
  await expect(importDrafts).toBeVisible();
  await expect(inputs).toHaveCount(2);
  for (const input of await inputs.all()) await expect(input).toBeHidden();
  expect((await importDrafts.boundingBox())!.y).toBe(
    (await importBackup.boundingBox())!.y,
  );

  const original = await downloadWorkspaceBackup(page);
  await page.setViewportSize({ width: 375, height: 812 });
  const backupBounds = (await importBackup.boundingBox())!;
  const draftBounds = (await importDrafts.boundingBox())!;
  expect(draftBounds.x).toBe(backupBounds.x);
  expect(draftBounds.y).toBeGreaterThanOrEqual(
    backupBounds.y + backupBounds.height,
  );
  expect(
    Math.max(
      backupBounds.x + backupBounds.width,
      draftBounds.x + draftBounds.width,
    ),
  ).toBeLessThan(375);

  await downloadBackup.focus();
  await page.keyboard.press("Tab");
  await expect(importBackup).toBeFocused();
  const restoreBeforeCancel = await restore.innerText();
  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    const backupInput = restore.locator("#workspace-import-file");
    await backupInput.evaluate((input) => {
      input.addEventListener(
        "cancel",
        (event) => {
          if (event.isTrusted)
            input.setAttribute("data-picker-cancelled", "true");
        },
        { once: true },
      );
    });
    try {
      await session.send("Page.setInterceptFileChooserDialog", {
        enabled: true,
        cancel: true,
      });
      await page.keyboard.press("Enter");
      await expect(backupInput).toHaveAttribute(
        "data-picker-cancelled",
        "true",
      );
    } finally {
      await session.send("Page.setInterceptFileChooserDialog", {
        enabled: false,
      });
      await session.detach();
    }
  } else {
    const chooser = await openFilePicker(page, () =>
      page.keyboard.press("Enter"),
    );
    await chooser.element().dispatchEvent("cancel", { bubbles: true });
  }
  await expect(importBackup).toBeFocused();
  await expect(restore).toHaveText(restoreBeforeCancel, { useInnerText: true });
  await expect(
    page.getByRole("dialog", { name: "Review workspace replacement" }),
  ).toBeHidden();
  await expect(drafts.getByText(/^No unsaved drafts\./)).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(importDrafts).toBeFocused();
  const recoveryPath = testInfo.outputPath("summary-draft.json");
  await writeFile(recoveryPath, "{}");
  const firstPick = await openFilePicker(page, () =>
    page.keyboard.press("Space"),
  );
  await firstPick.setFiles(recoveryPath);
  const error = page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("alert")
    .filter({ hasText: "Action needs attention" });
  await expect(error).toContainText("Could not import “summary-draft.json”");
  await expect(restore.locator("#recovery-import-file")).toHaveValue("");
  await expect(drafts.getByText(/^No unsaved drafts\./)).toBeVisible();

  const {
    workspaceId,
    document: { summary },
  } = original;
  await writeFile(
    recoveryPath,
    JSON.stringify({
      format: "verso.recovery",
      schemaVersion: 1,
      sourceWorkspaceId: workspaceId,
      exportedAt: "2026-11-23T10:00:00.000Z",
      drafts: [
        {
          draftId: "imported-summary",
          draftVersion: 1,
          workspaceId,
          scope: "summary",
          generation: 0,
          baselineRevision: 0,
          baseline: summary,
          values: {
            ...summary,
            wording: { "en-US": "Imported draft wording" },
          },
        },
      ],
    }),
  );
  const retry = await openFilePicker(page, () => importDrafts.click());
  await retry.setFiles(recoveryPath);
  await expect(restore.getByRole("status")).toContainText("summary-draft.json");
  await expect(error).toBeHidden();
  await expect(
    drafts.getByRole("button", { name: "Restore draft" }),
  ).toBeVisible();
  await page.reload();
  await drafts.getByRole("button", { name: "Preview Summary" }).click();
  await expect(
    drafts.getByRole("cell", { name: /Imported draft wording/ }),
  ).toBeVisible();
  const saved = await downloadWorkspaceBackup(page);
  expect(saved.document).toEqual(original.document);
});

test("two tabs preserve unrelated saves and retain same-scope drafts on conflict", async ({
  page,
  context,
}) => {
  await page.goto("/app");
  const other = await context.newPage();
  await other.goto("/app");
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await other.getByRole("button", { name: "Profile", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Summary" })
    .fill("Summary from tab one");
  await other
    .getByRole("textbox", { name: "Full name" })
    .fill("Name from tab two");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    other.getByText("Updated from another tab · revision 1", { exact: true }),
  ).toBeVisible();
  await other
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await other.getByRole("button", { name: "Summary", exact: true }).click();
  await page.getByRole("textbox", { name: "Summary" }).fill("Winner");
  await other
    .getByRole("textbox", { name: "Summary" })
    .fill("Retained contender");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await other
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    other.getByRole("alert").filter({ hasText: "Action needs attention" }),
  ).toContainText(/scope|changed/);
  await expect(other.getByRole("textbox", { name: "Summary" })).toHaveText(
    "Retained contender",
  );
  await other.close();
});
