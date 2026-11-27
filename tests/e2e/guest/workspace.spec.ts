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
}) => {
  const { document } = fixture();
  await page.goto("/app");
  await openDataSettings(page);
  await expect(
    page.getByRole("button", { name: "Restore previous workspace" }),
  ).toHaveCount(0);
  await page.getByLabel("Import workspace for review").setInputFiles({
    name: "unsupported.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...envelope(document), schemaVersion: 1 }),
    ),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Action needs attention" }),
  ).toContainText("schemaVersion");
  await page.getByLabel("Import workspace for review").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope(document))),
  });
  const replacement = page.getByRole("dialog", {
    name: "Review workspace replacement",
  });
  await replacement
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update preview" }),
  ).toHaveCount(0);
  await page.getByLabel("Import workspace for review").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope(document))),
  });
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
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download workspace backup", exact: true })
    .click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
