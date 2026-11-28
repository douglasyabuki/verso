import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createEntry } from "@/lib/career/model";
import type { CareerController } from "@/stores/career/controller";
import {
  controllerOwner,
  setupCareerTests,
} from "@/tests/support/browser/career";
import type { CareerEntry, CareerSection } from "@/types-and-constants/career";

setupCareerTests();

/** Commit one entry in the first section of a kind, creating a Languages section when needed. */
async function seedEntry(
  controller: CareerController,
  kind: CareerSection["kind"],
  change: (entry: CareerEntry) => void = () => {},
) {
  let section = controller
    .getSnapshot()
    .head!.document.sections.find((item) => item.kind === kind);
  if (!section) {
    const properties = {
      id: crypto.randomUUID(),
      kind,
      icon: kind,
      name: "Languages",
      heading: {},
      archived: false,
    };
    expect(
      await controller.command(`new-section/${properties.id}`, properties),
    ).toBe(true);
    section = controller
      .getSnapshot()
      .head!.document.sections.find((item) => item.id === properties.id)!;
  }
  const entry = createEntry(kind);
  change(entry);
  expect(
    await controller.command(`new-entry/${section.id}/${entry.id}`, entry),
  ).toBe(true);
  return { section, entry };
}

const form = () => page.getByRole("region", { name: "Editing form" });
const saveForm = () =>
  form().getByRole("button", { name: "Save", exact: true }).click();

describe("section-specific Career details actions", () => {
  it.each([
    ["experience", "Add role"],
    ["projects", "Add project"],
    ["education", "Add education entry"],
    ["skills", "Add skill"],
    ["certifications", "Add certification"],
  ] as const)("names %s entry creation %s", async (kind, label) => {
    const controller = await controllerOwner();
    const section = controller
      .getSnapshot()
      .head!.document.sections.find((item) => item.kind === kind)!;
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(page.getByRole("button", { name: label, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Create entry" }))
      .not.toBeInTheDocument();
  });

  it("shows project details and links directly", async () => {
    const controller = await controllerOwner();
    const { entry: project } = await seedEntry(controller, "projects");
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=entry/${project.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(form().getByRole("button", { name: "Add project detail" }))
      .toBeVisible();
    await expect
      .element(form().getByRole("button", { name: "Add link", exact: true }))
      .toBeVisible();
    await expect.element(form().getByText("Project links")).toBeVisible();
  });

  it("keeps empty secondary groups behind Add more", async () => {
    const controller = await controllerOwner();
    const { entry: education } = await seedEntry(controller, "education");
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=entry/${education.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(form().getByRole("button", { name: "Add education detail" }))
      .not.toBeInTheDocument();
    await form()
      .getByRole("button", { name: "Add more to this education entry" })
      .click();
    await page.getByRole("menuitem", { name: "Add education detail" }).click();
    await expect
      .element(form().getByRole("button", { name: "Add education detail" }))
      .toBeVisible();
    await expect
      .element(
        form().getByRole("textbox", {
          name: "Education detail 1",
          exact: true,
        }),
      )
      .toBeVisible();
  });

  it("labels certification links for verification and offers Score or result on older entries", async () => {
    const controller = await controllerOwner();
    // Certifications saved before Score or result existed have no such field.
    const { entry } = await seedEntry(controller, "certifications", (value) => {
      value.fields = value.fields.filter((field) => field.key !== "score");
    });
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=entry/${entry.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(form().getByText("Credential verification"))
      .toBeVisible();
    await form().getByRole("button", { name: "Add verification link" }).click();
    await expect
      .element(form().getByRole("button", { name: "Archive Link 1" }))
      .toBeVisible();
    const score = form().getByRole("textbox", {
      name: "Score or result",
      exact: true,
    });
    await score.click();
    await userEvent.keyboard("110");
    await expect.element(score).toHaveValue("110");
    await expect.element(score).toHaveFocus();
    const fields = (controller.getSnapshot().draft!.values as CareerEntry)
      .fields;
    expect(fields.filter((field) => field.key === "score")).toEqual([
      expect.objectContaining({ type: "credential", fact: "110" }),
    ]);
  });
});

describe("internal names and link icons", () => {
  it("renames an achievement and a link without changing printed wording", async () => {
    const controller = await controllerOwner();
    const { entry } = await seedEntry(controller, "experience", (value) => {
      value.achievements.push({
        id: "shipped",
        archived: false,
        wording: { "en-US": "Shipped the editor" },
      });
      value.links.push({
        id: "portfolio",
        archived: false,
        url: "https://ana.dev",
        label: { "en-US": "Portfolio" },
      });
    });
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=entry/${entry.id}`);
    await render(<CareerWorkspace controller={controller} />);
    // Unnamed rows show their wording; links show their display label.
    await expect
      .element(
        form().getByRole("button", { name: "Archive Shipped the editor" }),
      )
      .toBeVisible();
    await expect
      .element(form().getByRole("button", { name: "Archive Portfolio" }))
      .toBeVisible();

    await form()
      .getByRole("textbox", { name: "Achievement 1 internal name" })
      .fill("Launch");
    await form().getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      controller.getSnapshot().head!.document.sections[0].entries[0]
        .achievements[0].name,
    ).toBeUndefined();

    await page
      .getByRole("button", { name: "Edit Untitled entry", exact: true })
      .click();
    await form()
      .getByRole("textbox", { name: "Achievement 1 internal name" })
      .fill("Launch");
    await form()
      .getByRole("textbox", { name: "Link 1 internal name" })
      .fill("Portfolio link for design roles");
    await expect
      .element(form().getByRole("button", { name: "Archive Launch" }))
      .toBeVisible();
    await expect
      .element(
        form().getByRole("button", {
          name: "Archive Portfolio link for design roles",
        }),
      )
      .toBeVisible();
    await saveForm();
    await expect
      .poll(
        () => controller.getSnapshot().head!.document.sections[0].entries[0],
      )
      .toMatchObject({
        achievements: [
          {
            id: "shipped",
            name: "Launch",
            wording: { "en-US": "Shipped the editor" },
          },
        ],
        links: [
          {
            id: "portfolio",
            name: "Portfolio link for design roles",
            label: { "en-US": "Portfolio" },
          },
        ],
      });
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
  });

  it("detects a platform automatically and stores only explicit overrides", async () => {
    const controller = await controllerOwner();
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", "?scope=profile");
    await render(<CareerWorkspace controller={controller} />);
    await expect.element(form().getByText("Profile links")).toBeVisible();
    await form().getByRole("button", { name: "Add link", exact: true }).click();
    await form()
      .getByRole("textbox", { name: "Link 1 address" })
      .fill("https://www.linkedin.com/in/ana");
    const icon = form().getByRole("combobox", { name: "Link 1 icon" });
    await expect.element(icon).toHaveTextContent("Automatic (LinkedIn)");
    const draftLink = () =>
      (
        controller.getSnapshot().draft!.values as {
          links: { icon?: string }[];
        }
      ).links[0];
    expect(draftLink()).not.toHaveProperty("icon");
    await icon.click();
    await page.getByRole("option", { name: "GitHub" }).click();
    expect(draftLink().icon).toBe("github");
    await icon.click();
    await page.getByRole("option", { name: /^Automatic/ }).click();
    expect(draftLink()).not.toHaveProperty("icon");
  });
});

describe("spoken languages", () => {
  it("attaches an existing certification and creates another in one Save", async () => {
    const controller = await controllerOwner();
    const { entry: toefl } = await seedEntry(
      controller,
      "certifications",
      (value) => {
        value.name = "TOEFL iBT";
        value.fields.find((field) => field.key === "title")!.wording = {
          "en-US": "TOEFL iBT",
        };
      },
    );
    const { entry: english } = await seedEntry(
      controller,
      "languages",
      (value) => {
        value.fields[0].wording = { "en-US": "English" };
      },
    );
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=entry/${english.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(form().getByRole("textbox", { name: "Language", exact: true }))
      .toHaveValue("English");
    await expect
      .element(form().getByText("No test or certificate attached."))
      .toBeVisible();

    await form()
      .getByRole("button", { name: "Add test or certificate" })
      .click();
    await page.getByRole("menuitem", { name: "Attach TOEFL iBT" }).click();
    await saveForm();
    const language = () =>
      controller
        .getSnapshot()
        .head!.document.sections.flatMap((section) => section.entries)
        .find((item) => item.id === english.id)!;
    await expect
      .poll(() => language().evidence?.map((item) => item.entryId))
      .toEqual([toefl.id]);
    await expect.poll(() => controller.getSnapshot().saving).toBe(false);

    await page.getByRole("button", { name: /^Edit English/ }).click();
    await form()
      .getByRole("button", { name: "Add test or certificate" })
      .click();
    await page
      .getByRole("menuitem", { name: "Create test or certificate" })
      .click();
    await expect
      .element(form().getByText(/Saved once under Certifications/))
      .toBeVisible();
    await form()
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("IELTS Academic");
    await form()
      .getByRole("textbox", { name: "Score or result", exact: true })
      .fill("Band 8");
    const undoBefore = controller.getSnapshot().undoCount;
    await saveForm();
    await expect.poll(() => language().evidence).toHaveLength(2);
    expect(controller.getSnapshot().undoCount).toBe(undoBefore + 1);
    // Returns to the language entry.
    await expect
      .poll(() => controller.getSnapshot().draft?.scope)
      .toBe(`entry/${english.id}`);
    const created = controller
      .getSnapshot()
      .head!.document.sections.flatMap((section) => section.entries)
      .find((item) => item.id === language().evidence![1].entryId)!;
    expect(created.fields.find((field) => field.key === "score")?.fact).toBe(
      "Band 8",
    );
    await expect.element(form().getByText("IELTS Academic")).toBeVisible();

    await expect.poll(() => controller.getSnapshot().saving).toBe(false);
    await controller.cancel();
    expect(await controller.history("undo")).toBe(true);
    expect(language().evidence![1].archived).toBe(true);
    expect(
      controller
        .getSnapshot()
        .head!.document.sections.flatMap((section) => section.entries)
        .find((item) => item.id === created.id)!.archived,
    ).toBe(true);
  });

  it("does not open the certification form for a language that was never saved", async () => {
    const controller = await controllerOwner();
    const { section } = await seedEntry(controller, "languages");
    await page.viewport(1280, 900);
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("button", { name: "Add language", exact: true })
      .click();
    await form()
      .getByRole("button", { name: "Add test or certificate" })
      .click();
    await page
      .getByRole("menuitem", { name: "Create test or certificate" })
      .click();
    await page
      .getByRole("dialog", { name: "Unsaved form" })
      .getByRole("button", { name: "Discard", exact: true })
      .click();
    await expect
      .element(page.getByText(/Save the language before adding/))
      .toBeVisible();
    expect(controller.getSnapshot().draft?.scope ?? "").not.toMatch(
      /^language-evidence\//,
    );
  });
});
