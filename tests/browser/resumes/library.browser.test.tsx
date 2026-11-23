import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { LayoutFields } from "@/components/career/layout-editor";
import { layoutAppearance } from "@/lib/career/layout";
import { createCareerDocument, readScope } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { captureStarter, prepareStarterResume } from "@/lib/career/starters";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage, openCareerStorage } from "@/stores/career/persistence";
import type { CareerDocument } from "@/types-and-constants/career";

const controllers: CareerController[] = [];
const connections: CareerStorage[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

function fixture() {
  const document = createCareerDocument();
  const resume = createResume(document, "en-US");
  resume.name = "Application";
  document.resumes = [resume];
  return { document, resume };
}
async function owner(document?: CareerDocument) {
  if (document) {
    const storage = await openCareerStorage();
    await storage.load(document);
    storage.close();
  }
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}
afterEach(async () => {
  await cleanup();
  for (const controller of controllers.splice(0)) {
    await controller.flushRecovery();
    controller.dispose();
  }
  connections.splice(0).forEach((storage) => storage.close());
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("verso-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test connections still open"));
  });
  window.history.replaceState(initialState, "", initialUrl);
});

it("keeps invalid layout values visible and reveals their group", async () => {
  const { document } = fixture();
  function Form() {
    const [values, setValues] = useState<unknown>(document.defaults);
    return <LayoutFields values={values} onChange={setValues} />;
  }
  await render(<Form />);
  const margin = page.getByRole("textbox", {
    name: "Left margin (mm)",
    exact: true,
  });
  await margin.fill("bad");
  await expect.element(margin).toHaveValue("bad");
  await expect.element(margin).toHaveAttribute("aria-invalid", "true");
  await margin.fill("18");
  await expect.element(margin).toHaveAttribute("aria-invalid", "false");
  await page
    .getByRole("button", { name: "Header & contacts", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Contacts per row", exact: true })
    .click();
  await page.getByRole("option", { name: "Custom rows", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Custom row sizes", exact: true })
    .fill("3, 2");
  await expect
    .element(
      page.getByRole("textbox", { name: "Custom row sizes", exact: true }),
    )
    .toHaveValue("3, 2");
});

/** Supply saved reusable configurations without coupling UI expectations to their implementation. */
function libraryFixture() {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "compact",
      name: "Compact",
      template: resume.template,
      layout: { ...layoutAppearance(resume.layout), marginLeft: 18 },
    },
  ];
  const starter = captureStarter(document, resume);
  starter.name = "Project focused";
  starter.layout.paper = "letter";
  document.starters = [starter];
  return { document, resume, starter };
}

/** Open a durable destination with a desktop sidebar and an isolated real controller. */
async function libraryWorkspace(document: CareerDocument, scope: string) {
  await page.viewport(1440, 900);
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=${scope}`);
  await render(<CareerWorkspace controller={controller} />);
  return controller;
}

it.each([
  [
    "presets",
    "Layout presets",
    "Apply preset…",
    "Preset name",
    "Delete preset?",
  ],
  [
    "starters",
    "Resume starters",
    "Create resume…",
    "Starter name",
    "Delete starter?",
  ],
] as const)(
  "keeps a primary action and a keyboard-accessible menu in %s",
  async (collection, collectionLabel, primaryLabel, nameLabel, deleteLabel) => {
    const { document } = libraryFixture();
    const item = document[collection][0];
    const name = item.name.repeat(20).replaceAll(" ", "");
    item.name = name;
    const controller = await libraryWorkspace(document, collection);
    await page.viewport(360, 800);

    const primary = page.getByRole("button", {
      name: primaryLabel,
      exact: true,
    });
    const trigger = page.getByRole("button", { name: `Actions for ${name}` });
    await expect.element(primary).toBeVisible();
    await expect.element(trigger).toBeVisible();
    const card = primary.element().closest('[data-slot="card"]')!;
    expect([...card.querySelectorAll("button")]).toEqual([
      primary.element(),
      trigger.element(),
    ]);
    const cardBounds = card.getBoundingClientRect();
    const primaryBounds = primary.element().getBoundingClientRect();
    const triggerBounds = trigger.element().getBoundingClientRect();
    expect(primaryBounds.left).toBeGreaterThanOrEqual(cardBounds.left);
    expect(triggerBounds.right).toBeLessThanOrEqual(cardBounds.right);
    expect(triggerBounds.top).toBeLessThan(primaryBounds.bottom);
    expect(cardBounds.right).toBeLessThanOrEqual(360);

    (primary.element() as HTMLElement).focus();
    await userEvent.keyboard("{Tab}");
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const menu = page.getByRole("menu");
    await expect.element(menu).toBeVisible();
    await expect.element(menu.getByRole("separator")).toBeVisible();
    expect(
      [...menu.element().querySelectorAll('[role="menuitem"]')].map(
        (entry) => entry.textContent,
      ),
    ).toEqual(["Edit", "Duplicate", "Delete"]);
    await userEvent.keyboard("{Escape}");
    await expect.element(trigger).toHaveFocus();

    const editor = page.getByRole("region", { name: "Editing form" });
    const nameField = editor.getByRole("textbox", { name: nameLabel });
    await trigger.click();
    await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect.element(nameField).toHaveValue(name);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await page
      .getByRole("dialog", { name: "Verso workspace" })
      .getByRole("button", { name: collectionLabel, exact: true })
      .click();

    await trigger.click();
    await menu
      .getByRole("menuitem", { name: "Duplicate", exact: true })
      .click();
    await expect.element(nameField).toHaveValue(`${name} copy`);
    expect(controller.getSnapshot().head?.document[collection]).toEqual([item]);
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: deleteLabel });
    await expect.element(confirmation).toBeVisible();
    expect(controller.getSnapshot().head?.document[collection]).toEqual([item]);
    await confirmation
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect
      .poll(() => controller.getSnapshot().head?.document[collection])
      .toEqual([]);
    await expect.element(trigger).not.toBeInTheDocument();
  },
);

it("loads a library preset only into a chosen resume draft and preserves committed content until Save", async () => {
  const { document, resume } = libraryFixture();
  const controller = await libraryWorkspace(document, "presets");
  await page
    .getByRole("button", { name: "Apply preset…", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect
    .element(dialog.getByRole("button", { name: "Load into layout" }))
    .toBeDisabled();
  await dialog.getByRole("combobox", { name: "Resume", exact: true }).click();
  await page.getByRole("option", { name: "Application", exact: true }).click();
  await dialog.getByRole("button", { name: "Load into layout" }).click();
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("18");
  await expect
    .element(
      page.getByRole("button", {
        name: "Layout presets (optional)",
        exact: true,
      }),
    )
    .toHaveAttribute("aria-expanded", "false");
  await expect
    .element(
      page.getByText(
        "Preset loaded into unsaved layout. Save to keep these changes.",
        { exact: true },
      ),
    )
    .toBeVisible();
  expect(controller.getSnapshot().head?.document).toEqual(document);
  expect(controller.getSnapshot().undoCount).toBe(0);
  await expect
    .element(page.getByRole("navigation", { name: "Location" }))
    .toHaveTextContent(/Resumes.*Application.*Layout/);
  await page
    .getByRole("region", { name: "Editing form" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      () =>
        controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
    )
    .toBe(18);
  expect(controller.getSnapshot().head?.document.resumes[0].selection).toEqual(
    resume.selection,
  );
  expect(controller.getSnapshot().undoCount).toBe(1);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect.element(undo).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Library", exact: true })
    .click();
  await expect
    .element(page.getByRole("heading", { name: "Library", exact: true }))
    .toBeVisible();
  await undo.click();
  await expect
    .poll(() => controller.getSnapshot().head?.document.resumes[0].layout)
    .toEqual(resume.layout);
  expect(controller.getSnapshot().undoCount).toBe(0);
});

it("blocks starter creation when the chosen starter is deleted while reviewing", async () => {
  const { document, starter } = libraryFixture();
  const controller = await libraryWorkspace(document, "starters");
  await page
    .getByRole("button", { name: "Create resume…", exact: true })
    .click();
  expect(await controller.command(`starter/${starter.id}`, null, starter)).toBe(
    true,
  );
  await expect
    .element(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Create resume", exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(
      page.getByRole("alert").filter({ hasText: "starter is unavailable" }),
    )
    .toBeVisible();
  expect(controller.getSnapshot().head?.document.resumes).toHaveLength(1);
});
it("rechecks reviewed mappings inside real IndexedDB without partially creating sections", async () => {
  const { document, resume } = fixture();
  const first = await owner(document);
  const other = await owner();
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "work-slot",
        label: "Work",
        kind: "experience" as const,
        icon: "briefcase-business" as const,
        hidden: false,
        visibleFields: ["title"],
      },
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: ["title"],
      },
    ],
  };
  const prepared = prepareStarterResume(
    document,
    starter,
    [document.sections[0].id, "new"],
    "en-US",
  );
  const section = document.sections[0];
  expect(
    await other.command(`section/${section.id}`, {
      ...(readScope(document, `section/${section.id}`) as object),
      name: "Changed in another tab",
    }),
  ).toBe(true);
  first.open(`starter-create/${prepared.resume.id}`);
  first.change(prepared);
  expect(await first.save()).toBe(false);
  const storage = await openCareerStorage();
  connections.push(storage);
  const head = await storage.load();
  expect(head.document.resumes).toHaveLength(1);
  expect(head.document.sections).toHaveLength(document.sections.length);
  expect(first.getSnapshot().draft?.values).toEqual(prepared);
});
it("retries an interrupted composite acknowledgment once and survives restart after undo and redo", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: ["title"],
      },
    ],
  };
  const prepared = prepareStarterResume(document, starter, ["new"], "en-US");
  controller.open(`starter-create/${prepared.resume.id}`);
  controller.change(prepared);
  const original = CareerStorage.prototype.commit;
  const fault = vi
    .spyOn(CareerStorage.prototype, "commit")
    .mockImplementationOnce(async function (this: CareerStorage, id) {
      await original.call(this, id);
      throw new Error("Acknowledgment lost");
    });
  expect(await controller.save()).toBe(false);
  const operation = controller.getSnapshot().draft?.operationId;
  fault.mockRestore();
  expect(await controller.save()).toBe(true);
  expect(controller.getSnapshot().head?.revision).toBe(1);
  expect(controller.getSnapshot().undoCount).toBe(1);
  expect(operation).toBeTruthy();
  await controller.cancel();
  expect(await controller.history("undo")).toBe(true);
  expect(
    controller.getSnapshot().head?.document.sections.at(-1)?.archived,
  ).toBe(true);
  expect(await controller.history("redo")).toBe(true);
  const restarted = await owner();
  expect(restarted.getSnapshot().head?.document.resumes.at(-1)?.id).toBe(
    prepared.resume.id,
  );
  expect(
    restarted.getSnapshot().head?.document.sections.at(-1)?.entries,
  ).toEqual([]);
});
it("rejects a real transaction write failure with neither resume nor section committed", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: layoutAppearance(resume.layout),
    summaryIncluded: false,
    sections: [
      {
        id: "extra-slot",
        label: "Extra",
        kind: "custom" as const,
        icon: "file-text" as const,
        hidden: false,
        visibleFields: [],
      },
    ],
  };
  const prepared = prepareStarterResume(document, starter, ["new"], "en-US");
  const original = IDBObjectStore.prototype.put;
  const fault = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "heads") {
        this.transaction.abort();
        throw new DOMException("Injected quota failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    });
  controller.open(`starter-create/${prepared.resume.id}`);
  controller.change(prepared);
  expect(await controller.save()).toBe(false);
  fault.mockRestore();
  const storage = await openCareerStorage();
  connections.push(storage);
  expect((await storage.load()).document).toEqual(document);
  expect(controller.getSnapshot().draft?.values).toEqual(prepared);
});
