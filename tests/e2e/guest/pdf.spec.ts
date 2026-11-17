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
  await page.goto("/");
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
  await page.goto(`/?scope=${destination}`);
}

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
    await page
      .getByRole("button", { name: "Refresh preview", exact: true })
      .click();
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
    const href = await link.getAttribute("href");
    await installPdfInspector(page);
    const inspection = await page.evaluate(async (href) => {
      const bytes = new Uint8Array(await (await fetch(href!)).arrayBuffer());
      return window.careerPdf.inspectPdf(
        btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")),
      );
    }, href);
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
    await page.keyboard.press("Escape");
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
