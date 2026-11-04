import { expect, test } from "@playwright/test";

import { createCareerDocument, createEntry } from "@/lib/career/model";

import { installPdfInspector } from "./career-harness";

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
    heading: {},
    archived: false,
    entries: [entry],
  });
  document.resumes.push({
    id: "resume",
    name: "Application",
    language,
    template: "yabuki-reference@1.0.2",
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
  expect((await page.goto("/"))?.status()).toBe(200);
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
  await page.goto("/");
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

test("valid replacement round-trips; invalid import and canceled adoption do not change saved content", async ({
  page,
}) => {
  const { document } = fixture();
  await page.goto("/");
  await page.getByRole("button", { name: "Data & backups" }).click();
  await page.getByLabel("Import schema-2 workspace for review").setInputFiles({
    name: "unsupported.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...envelope(document), schemaVersion: 1 }),
    ),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Action needs attention" }),
  ).toContainText("schemaVersion");
  await page.getByLabel("Import schema-2 workspace for review").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope(document))),
  });
  await page.getByRole("button", { name: "Cancel replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Refresh preview" }),
  ).toHaveCount(0);
  await page.getByLabel("Import schema-2 workspace for review").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope(document))),
  });
  await page
    .getByRole("button", { name: "Continue without exporting snapshot" })
    .click();
  await page.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export workspace · saved workspace only" })
    .click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(backup.document).toEqual(document);
  expect(backup.schemaVersion).toBe(2);
  await page.reload();
  await page
    .getByRole("button", { name: "Application (en-US)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Refresh preview" }),
  ).toBeVisible();
});

test("sample button handles failure, cancellation, adoption and reload without a file import", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Data & backups" }).click();
  await page.route("**/examples/alex-morgan.schema-2.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  const load = page.getByRole("button", {
    name: "Load sample workspace",
    exact: true,
  });
  await load.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Action needs attention" }),
  ).toContainText("Sample workspace could not be loaded");
  await expect(load).toBeEnabled();
  await page.unroute("**/examples/alex-morgan.schema-2.json");
  await load.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Incoming sections: 6. Incoming resumes: 2.",
  );
  await page.getByRole("button", { name: "Cancel replacement" }).click();
  await expect(
    page.getByRole("button", { name: "Refresh preview" }),
  ).toHaveCount(0);
  await load.click();
  await page
    .getByRole("button", { name: "Continue without exporting snapshot" })
    .click();
  await page.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Alex Morgan · English (en-US)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Refresh preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(
    "Alex Morgan",
  );
});

test("two tabs preserve unrelated saves and retain same-scope drafts on conflict", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
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

for (const language of ["en-US", "pt-BR"])
  test(`inactive ${language} selected archived content still produces a PDF`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { document } = fixture(language);
    document.languages[0].active = false;
    document.sections[0].archived = true;
    document.sections[0].entries[0].archived = true;
    document.summary.wording[language] = [
      {
        text: "Résumé & ação segura\nSecond line: 100% $ # _ { }",
        emphasis: true,
        href: "https://example.com/inline?a=1&b=2#details",
      },
    ];
    await page.goto("/");
    await page.getByRole("button", { name: "Data & backups" }).click();
    await page
      .getByLabel("Import schema-2 workspace for review")
      .setInputFiles({
        name: "workspace.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(envelope(document))),
      });
    await page
      .getByRole("button", { name: "Continue without exporting snapshot" })
      .click();
    await page.getByRole("button", { name: "Confirm adoption" }).click();
    await page
      .getByRole("button", { name: `Application (${language})`, exact: true })
      .click();
    await page.getByRole("button", { name: "Refresh preview" }).click();
    await expect(
      page.getByRole("button", { name: "Search PDF", exact: true }),
    ).toBeEnabled({ timeout: 150_000 });
    await page
      .getByRole("button", { name: "PDF actions", exact: true })
      .click();
    const link = page.getByRole("menuitem", {
      name: "Download PDF",
      exact: true,
    });
    await expect(link).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await link.click();
    const download = await downloadEvent;
    await download.saveAs(`.cache/career-${language}.pdf`);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    await installPdfInspector(page);
    const inspection = await page.evaluate(
      (source) => window.careerPdf.inspectPdf(source),
      bytes.toString("base64"),
    );
    expect(inspection.pageCount).toBeGreaterThan(0);
    const text = inspection.pages.map((item) => item.text).join(" ");
    expect(text).toContain("Ana São & Silva");
    expect(text).toContain("Résumé & ação segura");
    expect(text).toContain("Second line: 100% $ # _ { }");
    expect(text).toContain(
      language === "pt-BR" ? "Engenheira de sistemas" : "Systems engineer",
    );
    expect(inspection.info).toMatchObject({
      Author: "Ana São & Silva",
      Language: language,
    });
    expect(inspection.pages.flatMap((item) => item.urls)).toEqual(
      expect.arrayContaining([
        "https://example.com/?a=1&b=2",
        "https://example.com/inline?a=1&b=2#details",
      ]),
    );
    const fonts = inspection.pages.flatMap((item) => item.fonts);
    expect(fonts.some((font) => /Inter/.test(font.name))).toBe(true);
    expect(
      fonts.every((font) => !font.missingFile && font.embeddedBytes > 0),
    ).toBe(true);
    await test.info().attach(`pdf-${language}-inspection`, {
      body: JSON.stringify(inspection),
      contentType: "application/json",
    });
  });

for (const width of [1440, 390]) {
  test(`restored shell at ${width}px guards navigation and retains explicit Save/Cancel`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const mobile = width < 768;
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    const openNavigation = async () => {
      if (mobile)
        await page
          .getByRole("button", { name: "Expand sidebar", exact: true })
          .click();
    };
    await expect(
      page.locator('header[aria-label="Workspace controls"]'),
    ).toBeVisible();
    if (mobile) {
      await expect(
        page.getByRole("navigation", { name: "Workspace utilities" }),
      ).toBeHidden();
    } else {
      await expect(
        page.getByRole("navigation", { name: "Workspace utilities" }),
      ).toBeVisible();
      await expect(navigation).toBeVisible();
      await page
        .getByRole("button", { name: "Collapse sidebar", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Expand sidebar", exact: true })
        .click();
    }
    await openNavigation();
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    const field = page.getByRole("textbox", {
      name: "Summary",
    });
    await field.fill("Retain my draft");
    if (mobile)
      await expect(
        page.getByRole("dialog", { name: "Verso workspace" }),
      ).toBeHidden();
    await openNavigation();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    const guard = page.getByRole("dialog", { name: "Unsaved form" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(field).toHaveText("Retain my draft");
    await openNavigation();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await guard.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Cancel", exact: true }),
    ).toBeDisabled();
    await expect(
      page
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
    await openNavigation();
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    await expect(field).toHaveText("Retain my draft");
    await field.fill("Discard this edit");
    await page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await openNavigation();
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    await expect(field).toHaveText("Retain my draft");
    await field.fill("Discard through navigation");
    await openNavigation();
    await page
      .getByRole("button", { name: "Data & backups", exact: true })
      .click();
    await expect(
      page.getByLabel("Import schema-2 workspace for review"),
    ).toBeVisible();
    await expect(guard).toBeHidden();
    await page
      .getByRole("button", { name: "Back to editing", exact: true })
      .click();
    await expect(field).toHaveText("Discard through navigation");
    await openNavigation();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await guard.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Full name" }),
    ).toBeVisible();
    await openNavigation();
    await page
      .getByRole("button", { name: "Data & backups", exact: true })
      .click();
    await expect(
      page.getByLabel("Import schema-2 workspace for review"),
    ).toBeVisible();
    await openNavigation();
    await expect(
      page.getByRole("button", { name: "Appearance", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("imported schema-2 resume uses restored desktop split and narrow panel access", async ({
  page,
}) => {
  const { document } = fixture();
  await page.goto("/");
  await page.getByRole("button", { name: "Data & backups" }).click();
  await page.getByLabel("Import schema-2 workspace for review").setInputFiles({
    name: "workspace.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope(document))),
  });
  await page
    .getByRole("button", { name: "Continue without exporting snapshot" })
    .click();
  await page.getByRole("button", { name: "Confirm adoption" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Application (en-US)", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Committed resume output" }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="resizable-handle"]')).toBeVisible();
  await page.getByRole("button", { name: "Hide PDF preview" }).click();
  await expect(
    page.getByRole("region", { name: "Committed resume output" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Show PDF preview" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "PDF preview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Resume overview", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Refresh preview" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resume overview", exact: true }),
  ).toBeVisible();
});
