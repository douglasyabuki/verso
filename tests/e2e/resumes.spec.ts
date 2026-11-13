import { expect, type Page, test } from "@playwright/test";

import { createCareerDocument, createEntry } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import type { CareerDocument } from "@/types-and-constants/career";

import { installHarness, installPdfInspector } from "./career-harness";

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

test("follows a readiness issue from narrow PDF view, saves its repair and restores durable navigation", async ({
  page,
}) => {
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  resume.name = "Readiness application";
  document.resumes = [resume];
  document.profile.fields[0].wording = {};
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, document, `resume-overview/${resume.id}`);
  await expect(
    page
      .getByRole("main")
      .getByRole("button", { name: "Issues (1)", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  const pdf = page.getByRole("region", { name: "Committed resume output" });
  await expect(
    pdf.getByRole("button", { name: "Refresh preview" }),
  ).toBeDisabled();
  await expect(pdf.getByText("1 blocking", { exact: true })).toBeVisible();
  await expect(
    pdf.getByRole("button", { name: "Issues (1)", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await pdf.getByRole("button", { name: "Issues (1)", exact: true }).click();
  await pdf.getByRole("button", { name: "Edit wording", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Editor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const card = page.getByRole("group", {
    name: "Profile · Full name",
    exact: true,
  });
  await expect(card).toBeFocused();
  await card.getByRole("button", { name: "Customize", exact: true }).click();
  await card
    .getByRole("textbox", { name: "Profile · Full name", exact: true })
    .fill("Ana Silva");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  await expect(pdf.getByText("Ready for PDF", { exact: true })).toBeVisible();
  await expect(
    pdf.getByRole("button", { name: "Refresh preview" }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("main").getByRole("tab", { name: "Wording", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(
    page.getByRole("main").getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(
    page.getByRole("main").getByRole("tab", { name: "Wording", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("creates, tailors, duplicates, copies languages, compares and deletes independent resumes", async ({
  page,
}, testInfo) => {
  const { document } = fixture();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, document);
  const collection = page.getByRole("region", { name: "Resume collection" });
  await collection
    .getByRole("button", { name: "Create resume", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create resume",
    exact: true,
  });
  await create
    .getByRole("textbox", { name: "Resume name" })
    .fill("Primary application");
  await create
    .getByRole("button", { name: "Create resume", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Primary application", level: 1 }),
  ).toBeVisible();
  const contentUrl = page.url();
  await page
    .getByRole("checkbox", { name: "Include Profile · email", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Include summary", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Include Experience", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Experience entries", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Include Product engineering", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Fields, achievements, and links",
      exact: true,
    })
    .click();
  await page
    .getByRole("checkbox", { name: "Include title", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Include Achievement 1", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .getByText("No unsaved changes", { exact: true }),
  ).toBeVisible();
  // Save is also disabled while writing; wait until the form can navigate.
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .locator("fieldset[disabled]"),
  ).toHaveCount(0);
  await page
    .getByRole("main")
    .getByRole("tab", { name: "Wording", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: /^Product engineering/ })
    .click();
  const titleCard = page.getByRole("group", {
    name: "Experience · Product engineering · Title",
    exact: true,
  });
  await titleCard
    .getByRole("button", { name: "Customize", exact: true })
    .click();
  await titleCard
    .getByRole("textbox", {
      name: "Experience · Product engineering · Title",
      exact: true,
    })
    .fill("Senior Engineer");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .getByText("No unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Editing form" })
      .locator("fieldset[disabled]"),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Resumes", exact: true })
    .click();
  await collection
    .getByRole("button", {
      name: "Actions for Primary application",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Primary application copy",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Resumes", exact: true })
    .click();
  await collection
    .getByRole("button", {
      name: "Actions for Primary application",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", {
      name: "Create copy in another language",
      exact: true,
    })
    .click();
  const copy = page.getByRole("dialog", {
    name: "Create copy in another language",
    exact: true,
  });
  await expect(copy).toContainText("Missing wording remains missing");
  await copy
    .getByRole("button", { name: "Create resume", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Primary application (pt-BR)",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "Include Profile · email",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("main")
    .getByRole("tab", { name: "Wording", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: /^Product engineering/ })
    .click();
  await expect(page.getByText("Engenheira", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Experience · Product engineering · Title",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Resumes", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("resume-collection-desktop.png"),
    animations: "disabled",
    fullPage: true,
  });
  await collection
    .getByRole("button", { name: "Compare resumes", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("button", { name: "Resumes", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("combobox", { name: "Left resume", exact: true })
      .locator("svg[data-resume-color]"),
  ).toHaveCount(1);
  await expect(
    page.getByText(
      "Effective committed content only. Unsaved forms are excluded.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Right resume", { exact: true }).click();
  await expect(
    page
      .getByRole("option", {
        name: "Primary application (pt-BR) (pt-BR)",
        exact: true,
      })
      .locator("svg[data-resume-color]"),
  ).toHaveCount(1);
  await page
    .getByRole("option", {
      name: "Primary application (pt-BR) (pt-BR)",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Senior Engineer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Engenheira", { exact: true })).toBeVisible();
  await page.goto(contentUrl);
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Resumes", exact: true })
    .click();
  await collection
    .getByRole("button", {
      name: "Actions for Primary application copy",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete resume", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete resume?", exact: true })
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await expect(
    collection.getByRole("heading", {
      name: "Primary application copy",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    collection.getByRole("heading", {
      name: "Primary application copy",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    collection.getByRole("heading", {
      name: "Primary application copy",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("guards resume Back/Forward and preserves a draft across narrow Editor/PDF switching", async ({
  page,
}, testInfo) => {
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  resume.name = "Narrow application";
  document.resumes = [resume];
  await seed(page, document, `resume-content/${resume.id}`);
  await page
    .getByRole("main")
    .getByRole("tab", { name: "Wording", exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("checkbox", { name: "Include summary", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Resume wording", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("tab", { name: "Content & order", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Include summary", exact: true })
    .click();
  await page.goBack();
  await page
    .getByRole("dialog", { name: "Unsaved form" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Include summary", exact: true }),
  ).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh preview", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Include summary", exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath("resume-content-narrow.png"),
    animations: "disabled",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => window.document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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

test("opens resume overview and details from an ellipsized sidebar tree with durable navigation", async ({
  page,
}, testInfo) => {
  const { document } = fixture();
  const resume = createResume(document, "en-US");
  resume.name =
    "A long application name that must use ellipsis in the sidebar instead of wrapping";
  document.resumes = [resume];
  await seed(page, document, `resume-overview/${resume.id}`);
  const main = page.getByRole("main");
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect(
    main.getByRole("heading", { name: "Resume overview", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("button", { name: "Content & order", exact: true }),
  ).toBeVisible();
  expect(
    await navigation
      .getByRole("button", { name: `${resume.name} (en-US)`, exact: true })
      .locator("span.truncate")
      .evaluate((node) => getComputedStyle(node).whiteSpace),
  ).toBe("nowrap");
  await expect
    .poll(() =>
      navigation
        .locator("[data-collection-viewport]")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.scrollHeight <= node.clientHeight + 1),
        ),
    )
    .toBe(true);
  await navigation
    .getByRole("button", { name: `Actions for ${resume.name}`, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit name & color", exact: true })
    .click();
  await main
    .getByRole("textbox", { name: "Resume name", exact: true })
    .fill("Reviewed application");
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    main.getByRole("heading", { name: "Resume overview", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    main.getByRole("heading", {
      name: "Reviewed application",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await navigation
    .getByRole("button", { name: "Wording", exact: true })
    .click();
  await page.goBack();
  await expect(
    main.getByRole("heading", { name: "Resume overview", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    main.getByRole("heading", { name: "Resume wording", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("resume-tree-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
});
