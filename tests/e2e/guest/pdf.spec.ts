import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { createCareerDocument, createEntry } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import {
  installHarness,
  installPdfInspector,
} from "@/tests/support/e2e/career-harness";
import type { CareerDocument } from "@/types-and-constants/career";

function fixture() {
  const document = createCareerDocument();
  document.languages.push({ tag: "pt-BR", active: true });
  document.profile.fields[0].wording = {
    "en-US": "Ana Silva",
    "pt-BR": "Ana Silva",
  };
  document.profile.fields[1].fact = "ana@example.com";
  document.summary.wording = {
    "en-US": "Reusable English summary",
    "pt-BR": "Resumo reutilizável",
  };
  const entry = createEntry("experience");
  entry.name = "Product engineering";
  entry.fields[0].wording = { "en-US": "Engineer", "pt-BR": "Engenheira" };
  entry.fields[1].wording = { "en-US": "Acme", "pt-BR": "Acme" };
  entry.achievements = [
    {
      id: "delivered",
      archived: false,
      wording: {
        "en-US": "Delivered accessible software",
        "pt-BR": "Entregou soluções acessíveis",
      },
    },
  ];
  document.sections[0].entries = [entry];
  return { document, entry };
}

async function seed(
  page: Page,
  document: CareerDocument,
  destination = "resumes",
) {
  await page.goto("/app");
  await expect(
    page.getByRole("heading", {
      name: "Career details · Overview",
      exact: true,
    }),
  ).toBeVisible();
  await installHarness(page);
  await page.evaluate(async (document) => {
    const storage = await window.careerHarness.openCareerStorage();
    try {
      await storage.replace(await storage.load(), document);
    } finally {
      storage.close();
    }
  }, document);
  await page.goto(`/app/${destination}`);
}

async function downloadSaved(page: Page) {
  const downloaded = page.waitForEvent("download", { timeout: 150_000 });
  await page
    .getByRole("button", { name: "Download saved PDF", exact: true })
    .click();
  const file = await downloaded;
  const bytes = await readFile((await file.path())!);
  await installPdfInspector(page);
  return page.evaluate(
    (base64) => window.careerPdf.inspectPdf(base64),
    bytes.toString("base64"),
  );
}

test("defers typing, previews an unsaved override and keeps one-click downloads saved", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  resume.overrides[document.profile.fields[0].id] = "Ana Silva";
  document.resumes = [resume];
  await page.addInitScript(() => {
    const original = Worker.prototype.postMessage;
    const messages: { kind: string; keys?: string[] }[] = [];
    Object.assign(window, { previewMessages: messages });
    Worker.prototype.postMessage = function (message, options) {
      if (message?.kind === "run" || message?.kind === "pieces") {
        messages.push({
          kind: message.kind,
          keys: message.pieces?.map(([key]: [string]) => key),
        });
      }
      return original.call(
        this,
        message,
        options as StructuredSerializeOptions,
      );
    };
  });
  const messages = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            previewMessages: { kind: string; keys?: string[] }[];
          }
        ).previewMessages,
    );
  const expectedText = "Ana Draft";
  await seed(page, document, `resume-wording/${resume.id}`);
  const output = page.getByRole("region", { name: "Resume PDF output" });
  const saved = output
    .getByRole("status")
    .filter({ hasText: /^Saved PDF \u00b7 Revision/ });
  await expect(saved).toBeVisible({ timeout: 150_000 });
  const before = (await messages()).length;
  const form = page.getByRole("region", { name: "Editing form" });
  const input = form.getByRole("textbox", {
    name: "Profile \u00b7 Full name",
    exact: true,
  });
  await input.fill("Ana composing");
  await expect(output.getByText(/Draft changes pending/)).toBeVisible();
  // The coalescing window elapses while focus stays inside the editing session.
  await page.waitForTimeout(400);
  expect(await messages()).toHaveLength(before);
  await expect(output.getByText(/Draft changes pending/)).toBeVisible();
  // A synthetic composition leaves focus in the input until the final input
  // transaction. A native click can commit the composition on blur in Firefox.
  await input.evaluate((field) => {
    field.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
  });
  await output
    .getByRole("button", { name: "Update preview" })
    .evaluate((button) => (button as HTMLButtonElement).click());
  expect(await messages()).toHaveLength(before);
  await input.fill(expectedText);
  await input.evaluate((field, value) => {
    field.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: value }),
    );
  }, expectedText);
  await expect(
    output.getByText("Draft PDF \u00b7 Unsaved", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  const updates = (await messages()).slice(before);
  expect(updates.filter(({ kind }) => kind === "run")).toHaveLength(1);
  expect(updates.flatMap(({ keys }) => keys ?? []).sort()).toEqual(
    [`draft/${document.profile.fields[0].id}`, "draftShape"].sort(),
  );
  const viewer = output.getByRole("region", { name: "PDF document pages" });
  await expect(viewer.getByText(expectedText, { exact: true })).toBeVisible();
  const committed = await downloadSaved(page);
  expect(committed.pages[0].text).toContain("Ana Silva");
  expect(committed.pages[0].text).not.toContain(expectedText);
  expect((committed.info as { Subject?: string }).Subject).toMatch(
    /^Verso revision /,
  );
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(saved).toBeVisible();
  await expect(viewer.getByText("Ana Silva", { exact: true })).toBeVisible();
});

test("starts a saved download on one click when no PDF has been generated", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  document.resumes = [resume];
  await seed(page, document, `resume-overview/${resume.id}`);
  const inspection = await downloadSaved(page);
  expect(inspection.pages[0].text).toContain("Ana Silva");
  await expect(
    page.getByRole("link", { name: "Download saved PDF directly" }),
  ).toBeVisible();
});

test("keeps zoom through Layout Save and opens the latest saved PDF on narrow screens", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  resume.name = "Layout preview";
  document.resumes = [resume];
  await seed(page, document, `resume-layout/${resume.id}`);
  const pdf = page.getByRole("region", { name: "Resume PDF output" });
  const form = page.getByRole("region", { name: "Editing form" });
  const zoom = pdf.getByRole("textbox", { name: "PDF zoom" });
  const output = pdf.getByRole("status").filter({ hasText: "Revision" });
  await expect(zoom).toBeEnabled({ timeout: 150_000 });
  await zoom.fill("125");
  await zoom.press("Enter");
  await expect(zoom).toHaveValue("125%");

  const margin = form.getByRole("textbox", {
    name: "Left margin (mm)",
    exact: true,
  });
  await margin.fill("bad");
  await pdf.getByRole("button", { name: "Update preview" }).click();
  await expect(pdf.getByText(/Draft preview blocked/)).toBeVisible();
  await pdf.getByRole("button", { name: "Issues (1)", exact: true }).click();
  await pdf.getByRole("button", { name: "Go to field", exact: true }).click();
  await expect(margin).toBeFocused();
  await expect(margin).toHaveAttribute("aria-invalid", "true");
  await expect(margin).toHaveValue("bad");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(output).toHaveText(/^Saved PDF \u00b7 Revision \d+$/);
  const before = await output.textContent();
  await form
    .getByRole("button", { name: "Paper: US Letter", exact: true })
    .click();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(output).not.toHaveText(before!);
  await expect(output).toHaveText(/^Saved PDF \u00b7 Revision \d+$/, {
    timeout: 30_000,
  });
  await expect(zoom).toHaveValue("125%");

  const previous = await output.textContent();
  await page.setViewportSize({ width: 430, height: 900 });
  await expect(
    page.getByRole("tab", { name: "Editor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await form.getByRole("button", { name: "Paper: A4", exact: true }).click();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  await expect(output).not.toHaveText(previous!);
  await expect(output).toHaveText(/^Saved PDF \u00b7 Revision \d+$/, {
    timeout: 30_000,
  });
  const inspection = await downloadSaved(page);
  const paper = inspection.pages[0];
  expect(paper.width).toBeCloseTo(595, 0);
  expect(paper.height).toBeCloseTo(842, 0);
});

for (const language of ["en-US", "pt-BR"]) {
  test(`renders independent committed ${language} selections and custom wording in the actual PDF`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { document, entry } = fixture();
    const resume = createResume(document, language);
    resume.name = "Selected output";
    resume.profileSelection = [];
    resume.summaryIncluded = false;
    resume.selection = [
      {
        sectionId: document.sections[0].id,
        entryIds: [entry.id],
        fieldIds: [entry.fields[0].id],
        achievementIds: ["delivered"],
        linkIds: [],
      },
    ];
    const customTitle =
      language === "pt-BR" ? "Engenheira sênior" : "Senior Engineer";
    resume.overrides[entry.fields[0].id] = customTitle;
    document.resumes = [resume];
    await seed(page, document, `resume-content/${resume.id}`);
    await expect(
      page.getByRole("button", { name: "Search PDF", exact: true }),
    ).toBeEnabled({ timeout: 150_000 });
    const inspection = await downloadSaved(page);
    const text = inspection.pages.map((page) => page.text).join(" ");
    expect(text).toContain(resume.overrides[entry.fields[0].id]);
    expect(text).toContain(
      language === "pt-BR"
        ? "Entregou soluções acessíveis"
        : "Delivered accessible software",
    );
    expect(text).not.toContain("ana@example.com");
    expect(text).not.toContain("Reusable English summary");
    expect(text).not.toContain("Resumo reutilizável");
    expect(text).not.toContain("Acme");
    const viewer = page.getByRole("region", {
      name: "PDF viewer",
      exact: true,
    });
    await expect(
      viewer
        .getByRole("region", { name: "PDF document pages" })
        .getByText(customTitle, { exact: true }),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: "Search PDF", exact: true })
      .click();
    await viewer
      .getByRole("textbox", { name: "Search PDF text" })
      .fill(customTitle);
    await expect(
      viewer.getByRole("status").filter({ hasText: "1 / 1" }),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: "Close PDF search", exact: true })
      .click();
    await viewer
      .getByRole("button", { name: "PDF navigation", exact: true })
      .click();
    await expect(
      viewer.getByRole("button", { name: "Go to PDF page 1", exact: true }),
    ).toBeVisible();
    await viewer
      .getByRole("tab", { name: "Document outline", exact: true })
      .click();
    await expect(
      viewer
        .getByRole("tabpanel", { name: "Document outline", exact: true })
        .getByRole("button")
        .first(),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: "Close PDF navigation", exact: true })
      .click();
    await viewer.getByRole("button", { name: "Fit page", exact: true }).click();
    await viewer
      .getByRole("button", { name: "PDF actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Document properties", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Document properties", exact: true })
        .getByText("Ana Silva", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(
      inspection.pages.every((page) =>
        page.fonts.every((font) => !font.missingFile && font.embeddedBytes > 0),
      ),
    ).toBe(true);
  });
}
