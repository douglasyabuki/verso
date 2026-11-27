import { expect, type Page, test } from "@playwright/test";

import { createCareerDocument, createEntry } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { installHarness } from "@/tests/support/e2e/career-harness";
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
  const pdf = page.getByRole("region", { name: "Resume PDF output" });
  await expect(
    pdf.getByRole("button", { name: "Update preview" }),
  ).toBeEnabled();
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
  await expect(
    card.getByRole("button", { name: "Customize", exact: true }),
  ).toBeFocused();
  await card.getByRole("button", { name: "Customize", exact: true }).click();
  await card
    .getByRole("textbox", { name: "Profile · Full name", exact: true })
    .fill("Ana Silva");
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("tab", { name: "PDF preview", exact: true }).click();
  await expect(pdf.getByText("Ready for PDF", { exact: true })).toBeVisible({
    timeout: 150_000,
  });
  await expect(
    pdf.getByRole("button", { name: "Update preview" }),
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

  const main = page.getByRole("main");
  const compare = main.getByRole("button", {
    name: "Compare resumes",
    exact: true,
  });
  await expect(compare).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Location" })
    .getByRole("button", { name: "Resumes", exact: true })
    .click();
  await expect(compare).toBeInViewport({ ratio: 1 });
  await expect(compare).toBeDisabled();
  await expect(
    main.getByRole("button", { name: "Create resume", exact: true }),
  ).toBeInViewport({ ratio: 1 });
});

test("creates, tailors, duplicates, copies languages, compares and deletes independent resumes", async ({
  page,
}, testInfo) => {
  const { document } = fixture();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, document);
  const main = page.getByRole("main");
  const collection = page.getByRole("region", { name: "Resume collection" });
  await main
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
  const details = page.getByRole("button", {
    name: /^Fields, achievements, and links/,
  });
  await expect(details).toContainText(/(\d+) of \1 included/);
  await details.click();
  await expect(
    page.getByRole("checkbox", { name: "Include Title", exact: true }),
  ).toBeChecked();
  const achievement = page.getByRole("checkbox", {
    name: "Include Achievement 1",
    exact: true,
  });
  await expect(achievement).toBeChecked();
  await achievement.click();
  await expect(achievement).not.toBeChecked();
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
  await main
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
    page.getByText("Comparing saved content.", { exact: true }),
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
  await main.getByRole("combobox", { name: "Section", exact: true }).click();
  await page.getByRole("option", { name: "Experience", exact: true }).click();
  const experience = main.getByRole("button", { name: /^Experience \(\d+\)$/ });
  await expect(experience).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Senior Engineer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Engenheira", { exact: true })).toBeVisible();
  await experience.press("Space");
  await expect(experience).toHaveAttribute("aria-expanded", "false");
  await experience.press("Enter");
  await expect(experience).toHaveAttribute("aria-expanded", "true");
  await main
    .getByRole("combobox", { name: "Change type", exact: true })
    .click();
  await page.getByRole("option", { name: "Order", exact: true }).click();
  await expect(main.getByText("No rows match these filters")).toBeVisible();
  await main
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    main.getByRole("combobox", { name: "Section", exact: true }),
  ).toContainText("All sections");
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

test("compares the selected resume from its menus and restores the comparison on navigation", async ({
  page,
}) => {
  const { document } = fixture();
  const first = { ...createResume(document, "en-US"), name: "Platform" };
  const second = { ...createResume(document, "pt-BR"), name: "Product" };
  const third = { ...createResume(document, "en-US"), name: "Portfolio" };
  document.resumes = [first, second, third];
  await seed(page, document, `resume-content/${second.id}`);

  const main = page.getByRole("main");
  const includeSummary = main.getByRole("checkbox", {
    name: "Include summary",
    exact: true,
  });
  await expect(includeSummary).toBeVisible();
  const savedSummary = await includeSummary.isChecked();
  await includeSummary.click();

  const compareItem = { name: "Compare", exact: true };
  const productCompare = page
    .getByRole("menu", { name: "Actions for Product", exact: true })
    .getByRole("menuitem", compareItem);
  const workspaceActions = main.getByRole("button", {
    name: "Actions for Product",
    exact: true,
  });
  const guard = page.getByRole("dialog", { name: "Unsaved form" });
  await workspaceActions.click();
  await productCompare.click();
  await guard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(includeSummary).toBeChecked({ checked: !savedSummary });
  await workspaceActions.click();
  await productCompare.click();
  await guard.getByRole("button", { name: "Discard", exact: true }).click();

  const left = main.getByRole("combobox", { name: "Left resume", exact: true });
  const right = main.getByRole("combobox", {
    name: "Right resume",
    exact: true,
  });
  const leftValue = left.locator('[data-slot="select-value"]');
  const rightValue = right.locator('[data-slot="select-value"]');
  await expect(page).toHaveURL(`/app/resume-compare/${second.id}`);
  await expect(leftValue).toHaveText("Product (pt-BR)");
  await expect(rightValue).toHaveText("Platform (en-US)");
  await expect(
    main.getByText("No content differences", { exact: true }),
  ).toBeVisible();
  await main
    .getByRole("button", { name: "Show all rows", exact: true })
    .click();
  await expect(
    main.getByRole("group", { name: "Full name", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(includeSummary).toBeChecked({ checked: savedSummary });
  await page.goForward();
  await expect(leftValue).toHaveText("Product (pt-BR)");
  await page.reload();
  await expect(leftValue).toHaveText("Product (pt-BR)");

  await right.click();
  await page
    .getByRole("option", { name: "Portfolio (en-US)", exact: true })
    .click();
  await left.click();
  await page
    .getByRole("option", { name: "Portfolio (en-US)", exact: true })
    .click();
  await expect(leftValue).toHaveText("Portfolio (en-US)");
  await expect(rightValue).toHaveText("Product (pt-BR)");

  await left.click();
  await page
    .getByRole("option", { name: "Platform (en-US)", exact: true })
    .click();
  await expect(leftValue).toHaveText("Platform (en-US)");
  await expect(rightValue).toHaveText("Product (pt-BR)");

  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await navigation
    .getByRole("button", { name: /^Product \(pt-BR\)$/ })
    .click({ button: "right" });
  await page
    .locator('[data-slot="context-menu-content"][data-open]')
    .getByRole("menuitem", compareItem)
    .click();
  await expect(leftValue).toHaveText("Product (pt-BR)");
  await expect(rightValue).toHaveText("Platform (en-US)");
  await navigation
    .getByRole("button", { name: "Actions for Platform", exact: true })
    .click();
  await page
    .getByRole("menu", { name: "Actions for Platform", exact: true })
    .getByRole("menuitem", compareItem)
    .click();
  await expect(leftValue).toHaveText("Platform (en-US)");
  await expect(rightValue).toHaveText("Product (pt-BR)");
});
