import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { LayoutFields } from "@/components/career/layout-editor";
import { PresetPicker } from "@/components/career/setup-library";
import { createCareerDocument, readScope } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { prepareStarterResume } from "@/lib/career/starters";
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
    .getByRole("button", { name: "Contacts per row: Custom rows", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Custom row sizes", exact: true })
    .fill("3, 2");
  await expect
    .element(
      page.getByRole("textbox", { name: "Custom row sizes", exact: true }),
    )
    .toHaveValue("3, 2");
});
it("loads a preset into a draft without changing committed layout or selections", async () => {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "compact",
      name: "Compact",
      template: resume.template,
      layout: { ...resume.layout, paper: "letter" },
    },
  ];
  function Form() {
    const [values, setValues] = useState<unknown>(resume.layout);
    return (
      <>
        <PresetPicker
          document={document}
          values={values}
          onChange={setValues}
          navigate={() => {}}
          capture={() => {}}
        />
        <output>{JSON.stringify(values)}</output>
      </>
    );
  }
  await render(<Form />);
  await page
    .getByRole("combobox", { name: "Layout preset", exact: true })
    .click();
  await page.getByRole("option", { name: "Compact", exact: true }).click();
  await page
    .getByRole("button", { name: "Load into layout", exact: true })
    .click();
  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent('"paper":"letter"');
  expect(resume.layout.paper).toBe("a4");
  expect(resume.selection).toEqual([]);
});
it("uses the Layout route guard for Cancel, Discard, and Save without compiling", async () => {
  const { document, resume } = fixture();
  const controller = await owner(document);
  window.history.replaceState({}, "", `?scope=resume-layout/${resume.id}`);
  await render(<CareerWorkspace controller={controller} />);
  await page
    .getByRole("textbox", { name: "Left margin (mm)", exact: true })
    .fill("18");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect
    .element(
      page.getByRole("textbox", { name: "Left margin (mm)", exact: true }),
    )
    .toHaveValue("18");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      () =>
        controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
    )
    .toBe(18);
  await page.getByRole("tab", { name: "Layout", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Left margin (mm)", exact: true })
    .fill("19");
  await page.getByRole("tab", { name: "Wording", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  expect(
    controller.getSnapshot().head?.document.resumes[0].layout.marginLeft,
  ).toBe(18);
});
it("rechecks reviewed mappings inside real IndexedDB without partially creating sections", async () => {
  const { document, resume } = fixture();
  const first = await owner(document);
  const other = await owner();
  const starter = {
    id: "starter",
    name: "Structure",
    template: resume.template,
    layout: resume.layout,
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
    layout: resume.layout,
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
    layout: resume.layout,
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

it("round-trips saved setups and separate layout recovery through replacement and rollback", async () => {
  const { document, resume } = fixture();
  document.presets = [
    {
      id: "preset",
      name: "Saved appearance",
      template: resume.template,
      layout: { ...resume.layout, contactRows: "3" },
    },
  ];
  const controller = await owner(document);
  controller.open(`resume-layout/${resume.id}`);
  controller.change({ ...resume.layout, marginLeft: "unfinished" });
  await controller.flushRecovery();
  const storage = await openCareerStorage();
  connections.push(storage);
  const before = await storage.load();
  const drafts = await storage.drafts();
  const replacement = await storage.replace(before, createCareerDocument());
  expect(replacement.document.presets).toEqual([]);
  const rolledBack = await storage.replace(replacement);
  expect(rolledBack.document.presets).toEqual(document.presets);
  expect(
    (await storage.drafts()).find((item) => item.draftId === drafts[0].draftId)
      ?.values,
  ).toMatchObject({ marginLeft: "unfinished" });
  await expect(storage.replace(before, document)).rejects.toThrow(
    /changed since review/,
  );
  expect((await storage.load()).document.presets).toEqual(document.presets);
});
