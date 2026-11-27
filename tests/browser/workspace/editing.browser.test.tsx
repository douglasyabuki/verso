import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createEntry } from "@/lib/career/model";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage } from "@/stores/career/persistence";
import {
  controllerOwner,
  request,
  setupCareerTests,
  storage,
  storedDraft,
  trackController,
} from "@/tests/support/browser/career";

setupCareerTests();

describe("Save and recovery", () => {
  it("saves incomplete built-in and custom entries while retaining failed malformed drafts", async () => {
    const controller = await controllerOwner();
    const head = controller.getSnapshot().head!;
    const experience = head.document.sections.find(
      (section) => section.kind === "experience",
    )!;
    const incomplete = createEntry("experience");
    expect(
      await controller.command(
        `new-entry/${experience.id}/${incomplete.id}`,
        incomplete,
      ),
    ).toBe(true);
    const saved = controller.getSnapshot().head!;
    controller.open(`entry/${incomplete.id}`);
    const malformed = structuredClone(incomplete);
    malformed.fields.find((field) => field.key === "start")!.fact =
      "2023-02-29";
    controller.change(malformed);
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().head).toEqual(saved);
    expect(controller.getSnapshot().draft?.values).toEqual(malformed);
    await controller.cancel();
    const section = {
      id: "custom-section",
      kind: "custom",
      icon: "file-text",
      name: "Volunteering",
      archived: false,
      heading: {},
    };
    expect(
      await controller.command("new-section/custom-section", section),
    ).toBe(true);
    const entry = createEntry("custom");
    expect(
      await controller.command(`new-entry/custom-section/${entry.id}`, entry),
    ).toBe(true);
    const owner = await storage();
    expect(
      (await owner.load()).document.sections.find((s) => s.id === section.id)
        ?.entries[0].id,
    ).toBe(entry.id);
  });

  it("requires a separate history invocation after draft resolution and clears Redo on a new Save", async () => {
    const controller = await controllerOwner();
    const baseline = controller.getSnapshot().head!.document.summary;
    const first = { ...baseline, wording: { "en-US": "First" } };
    expect(await controller.command("summary", first)).toBe(true);
    controller.open("summary");
    controller.change({ ...baseline, wording: { "en-US": "Discard me" } });
    expect(await controller.history("undo")).toBe(false);
    expect(controller.getSnapshot().head!.revision).toBe(1);
    expect(controller.getSnapshot().draft).not.toBeNull();
    await controller.cancel();
    expect(controller.getSnapshot().head!.document.summary).toEqual(first);
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().redoCount).toBe(1);
    expect(
      await controller.command("summary", {
        ...baseline,
        wording: { "en-US": "New branch" },
      }),
    ).toBe(true);
    expect(controller.getSnapshot().redoCount).toBe(0);
    expect(await controller.history("redo")).toBe(false);
    expect(
      controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("New branch");
  });

  it("refuses Undo over a competing same-scope Save without losing its history step", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const summary = controller.getSnapshot().head!.document.summary;
    await controller.command("summary", {
      ...summary,
      wording: { "en-US": "Local save" },
    });
    const head = await owner.load();
    const other = request(head, "summary", head.document.summary, {
      ...summary,
      wording: { "en-US": "Other tab" },
    });
    await owner.prepare(other);
    await owner.commit(other.id);
    await controller.refresh();
    const current = await owner.load();
    expect(await controller.history("undo")).toBe(false);
    expect(await owner.load()).toEqual(current);
    expect(controller.getSnapshot().undoCount).toBe(1);
    expect(controller.getSnapshot().redoCount).toBe(0);
    expect(controller.getSnapshot().error).toContain("History scope changed");
  });
});

describe("career editing boundaries", () => {
  it("Undo of creation archives and Redo restores the same identities without duplicate creation", async () => {
    const controller = new CareerController();
    trackController(controller);
    await controller.initialize();
    const properties = {
      id: "new-section",
      kind: "custom",
      icon: "file-text",
      name: "Custom",
      heading: {},
      archived: false,
    };
    expect(
      await controller.command("new-section/new-section", properties),
    ).toBe(true);
    expect(await controller.history("undo")).toBe(true);
    expect(
      controller
        .getSnapshot()
        .head!.document.sections.find(
          (section) => section.id === "new-section",
        )!.archived,
    ).toBe(true);
    expect(await controller.history("redo")).toBe(true);
    expect(controller.getSnapshot().head!.document.sections).toHaveLength(6);
    expect(
      controller
        .getSnapshot()
        .head!.document.sections.find(
          (section) => section.id === "new-section",
        ),
    ).toMatchObject({
      id: "new-section",
      archived: false,
    });
  });
  it("keeps typing/recovery separate, creates one Save history step, and Cancel creates none", async () => {
    const controller = new CareerController();
    trackController(controller);
    await controller.initialize();
    controller.open("summary");
    const initial = controller.getSnapshot().head!;
    controller.change({
      ...initial.document.summary,
      wording: { "en-US": "Draft" },
    });
    await controller.flushRecovery();
    expect(controller.getSnapshot().head).toEqual(initial);
    expect(controller.getSnapshot().undoCount).toBe(0);
    const owner = await storage();
    expect((await owner.load()).document.summary.wording).toEqual({});
    expect(await owner.drafts()).toHaveLength(1);
    expect(await controller.save()).toBe(true);
    expect(controller.getSnapshot().undoCount).toBe(1);
    expect(await owner.drafts()).toHaveLength(0);
    controller.open("summary");
    controller.change({
      ...initial.document.summary,
      wording: { "en-US": "Cancel me" },
    });
    await controller.cancel();
    expect(controller.getSnapshot().undoCount).toBe(1);
    await controller.history("undo");
    expect(controller.getSnapshot().head!.document.summary.wording).toEqual({});
  });

  it("renders a real form, offers Cancel/Discard/Save, and saves only after explicit action", async () => {
    const controller = new CareerController();
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Summary", exact: true })
        .click();
      await expect
        .element(
          screen
            .getByRole("region", { name: "Editing form" })
            .getByRole("button", { name: "Save", exact: true }),
        )
        .toBeDisabled();
      await expect
        .element(
          screen
            .getByRole("region", { name: "Editing form" })
            .getByRole("button", { name: "Cancel", exact: true }),
        )
        .toBeDisabled();
      await screen
        .getByRole("textbox", { name: "Summary" })
        .fill("Draft wording");
      expect(controller.getSnapshot().head!.document.summary.wording).toEqual(
        {},
      );
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await expect.element(screen.getByRole("dialog")).toBeVisible();
      await screen
        .getByRole("dialog", { name: "Unsaved form" })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("textbox", {
            name: "Summary",
          }),
        )
        .toHaveTextContent("Draft wording");
      await expect
        .poll(() => document.querySelector("[role=dialog]"))
        .toBeNull();
      await screen
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect
        .poll(
          () =>
            controller.getSnapshot().head!.document.summary.wording["en-US"],
        )
        .toBe("Draft wording");
      expect(controller.getSnapshot().undoCount).toBe(1);
    } finally {
      await screen.unmount();
    }
  });
});

describe("independent entry and order drafts", () => {
  it("saves order without changing the entry draft, then saves the entry as a separate history step", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    const head = controller.getSnapshot().head!;
    const [alpha, beta] = head.document.sections[0].entries;
    const undoCount = controller.getSnapshot().undoCount;
    controller.open(`entry/${alpha.id}`);
    controller.change({ ...alpha, name: "Edited Alpha" });
    controller.open(`entries/${section.id}`, "order");
    controller.change([beta.id, alpha.id], "order");
    const entryDraft = controller.getSnapshot().draft;
    await controller.flushRecovery();
    expect(await owner.drafts()).toHaveLength(2);
    expect(await controller.save(false, "order")).toBe(true);
    expect(controller.getSnapshot().draft).toEqual(entryDraft);
    expect(controller.getSnapshot().orderDraft).toBeNull();
    expect(
      (await owner.load()).document.sections[0].entries.map(
        (entry) => entry.name,
      ),
    ).toEqual(["Beta", "Alpha"]);
    expect(await owner.drafts()).toEqual([storedDraft(entryDraft)]);
    expect(await controller.save()).toBe(true);
    expect(
      (await owner.load()).document.sections[0].entries.map(
        (entry) => entry.name,
      ),
    ).toEqual(["Beta", "Edited Alpha"]);
    expect(controller.getSnapshot().undoCount).toBe(undoCount + 2);
    expect(await controller.history("undo")).toBe(true);
    expect(
      (await owner.load()).document.sections[0].entries.map(
        (entry) => entry.name,
      ),
    ).toEqual(["Beta", "Alpha"]);
    expect(await controller.history("undo")).toBe(true);
    expect(
      (await owner.load()).document.sections[0].entries.map(
        (entry) => entry.id,
      ),
    ).toEqual([alpha.id, beta.id]);
  });

  it("retains both drafts on failed order cleanup and discovers both after reload without auto-restoring", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    const [alpha, beta] =
      controller.getSnapshot().head!.document.sections[0].entries;
    controller.open(`entry/${alpha.id}`);
    controller.change({ ...alpha, name: "Recovered Alpha" });
    controller.open(`entries/${section.id}`, "order");
    controller.change([beta.id, alpha.id], "order");
    await controller.flushRecovery();
    const entryDraft = controller.getSnapshot().draft!;
    const orderDraft = controller.getSnapshot().orderDraft!;
    const fault = vi
      .spyOn(CareerStorage.prototype, "confirmDraftDiscard")
      .mockRejectedValueOnce(new Error("Cleanup unavailable"));
    try {
      await expect(controller.cancel("order")).resolves.toMatchObject({
        kind: "unconfirmed",
        message: expect.stringContaining("Cleanup unavailable"),
      });
    } finally {
      fault.mockRestore();
    }
    expect(controller.getSnapshot().draft).toEqual(entryDraft);
    expect(controller.getSnapshot().orderDraft).toEqual(orderDraft);
    expect(await owner.drafts()).toEqual(
      expect.arrayContaining([
        storedDraft(entryDraft),
        storedDraft(orderDraft),
      ]),
    );
    await controller.dispose();
    const reloaded = await controllerOwner();
    expect(reloaded.getSnapshot().draft).toBeNull();
    expect(reloaded.getSnapshot().orderDraft).toBeNull();
    expect(reloaded.getSnapshot().recovery).toHaveLength(2);
    reloaded.restore(orderDraft);
    reloaded.restore(entryDraft);
    expect(reloaded.getSnapshot().draft).toEqual(entryDraft);
    expect(reloaded.getSnapshot().orderDraft).toEqual(orderDraft);
    await reloaded.cancel("order");
    expect(reloaded.getSnapshot().draft).toEqual(entryDraft);
    expect(await owner.drafts()).toEqual([storedDraft(entryDraft)]);
    await reloaded.cancel();
  });
});

describe("restored schema-2 editing controls", () => {
  it("keeps formatting in the draft, supports inline links and local undo, and saves its marks", async () => {
    const controller = new CareerController();
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Summary", exact: true })
        .click();
      const field = screen.getByRole("textbox", {
        name: "Summary",
        exact: true,
      });
      await field.fill("Formatted career wording");
      await field.click();
      await userEvent.keyboard("{Control>}a{/Control}");
      await screen.getByRole("button", { name: "Italic", exact: true }).click();
      expect(controller.getSnapshot().head!.document.summary.wording).toEqual(
        {},
      );
      await screen
        .getByRole("button", { name: "Add link", exact: true })
        .click();
      await screen
        .getByRole("textbox", { name: "Link address", exact: true })
        .fill("https://example.com/?a=1&b=2");
      await screen.getByRole("button", { name: "Apply", exact: true }).click();
      await expect.element(field).toHaveTextContent("Formatted career wording");
      await controller.flushRecovery();
      const stored = (await (await storage()).drafts())[0];
      expect(stored.values).toMatchObject({
        wording: {
          "en-US": [
            {
              text: "Formatted career wording",
              emphasis: true,
              href: "https://example.com/?a=1&b=2",
            },
          ],
        },
      });
      await field.click();
      await userEvent.keyboard("{Control>}z{/Control}");
      expect(controller.getSnapshot().undoCount).toBe(0);
      await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
      await screen
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect.poll(() => controller.getSnapshot().undoCount).toBe(1);
      expect(
        controller.getSnapshot().head!.document.summary.wording["en-US"],
      ).toEqual([
        {
          text: "Formatted career wording",
          emphasis: true,
          href: "https://example.com/?a=1&b=2",
        },
      ]);
      // Wait for the Save acknowledgment and its maintenance to settle before
      // invoking a separate workspace history operation.
      await expect.poll(() => controller.getSnapshot().saving).toBe(false);
      expect(await controller.history("undo")).toBe(true);
      expect(controller.getSnapshot().head!.document.summary.wording).toEqual(
        {},
      );
    } finally {
      await screen.unmount();
    }
  });

  it("resolves dirty forms and entry order separately when leaving their section", async () => {
    const controller = await controllerOwner();
    await page.viewport(1280, 900);
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    const before = controller.getSnapshot().head!;
    const undoCount = controller.getSnapshot().undoCount;
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      await screen
        .getByRole("button", { name: "Edit Alpha", exact: true })
        .click();
      await screen
        .getByRole("textbox", { name: "Internal name", exact: true })
        .fill("Unsaved Alpha");
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      const formDialog = screen.getByRole("dialog", {
        name: "Unsaved form",
        exact: true,
      });
      await expect.element(formDialog).toBeVisible();
      expect(formDialog.element().textContent).not.toMatch(
        /entry order|separately next/i,
      );
      await formDialog
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      expect(controller.getSnapshot().draft).not.toBeNull();
      await expect
        .poll(() => controller.getSnapshot().orderDraft)
        .not.toBeNull();
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await formDialog
        .getByRole("button", { name: "Discard", exact: true })
        .click();
      const orderDialog = screen.getByRole("dialog", {
        name: "Unsaved entry order",
        exact: true,
      });
      await expect.element(orderDialog).toBeVisible();
      expect(orderDialog.element().textContent).not.toMatch(
        /form changes|separately next/i,
      );
      await orderDialog
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      expect(controller.getSnapshot().draft).toBeNull();
      await expect
        .poll(() => controller.getSnapshot().orderDraft)
        .not.toBeNull();
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await orderDialog
        .getByRole("button", { name: "Discard", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Full name", exact: true }),
        )
        .toBeVisible();
      expect(controller.getSnapshot().head).toEqual(before);
      expect(controller.getSnapshot().undoCount).toBe(undoCount);
    } finally {
      await screen.unmount();
    }
  });

  it("keeps filtered ordering and canceled keyboard drags in the draft until explicit Save", async () => {
    const controller = await controllerOwner();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Hidden", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      const before = controller
        .getSnapshot()
        .head!.document.sections[0].entries.map((entry) => entry.id);
      await expect
        .element(
          screen.getByRole("button", { name: "Save order", exact: true }),
        )
        .toBeDisabled();
      await expect
        .element(
          screen.getByRole("button", { name: "Cancel order", exact: true }),
        )
        .toBeDisabled();
      await screen.getByRole("searchbox", { name: "Search entries" }).fill("a");
      await expect
        .element(
          screen.getByRole("button", { name: "Edit Hidden", exact: true }),
        )
        .not.toBeInTheDocument();
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      await expect
        .poll(() => controller.getSnapshot().orderDraft?.values)
        .toEqual([before[2], before[1], before[0]]);
      expect(
        controller
          .getSnapshot()
          .head!.document.sections[0].entries.map((entry) => entry.id),
      ).toEqual(before);
      await screen
        .getByRole("button", { name: "Reorder Beta", exact: true })
        .click();
      await userEvent.keyboard(" {ArrowDown}{Escape}");
      await expect
        .poll(() => controller.getSnapshot().orderDraft?.values)
        .toEqual([before[2], before[1], before[0]]);
      await screen
        .getByRole("button", { name: "Cancel order", exact: true })
        .click();
      expect(
        controller
          .getSnapshot()
          .head!.document.sections[0].entries.map((entry) => entry.id),
      ).toEqual(before);
      await expect
        .element(screen.getByRole("searchbox", { name: "Search entries" }))
        .toHaveValue("a");
      await expect
        .element(
          screen.getByRole("button", { name: "Save order", exact: true }),
        )
        .toBeDisabled();
      const undoCount = controller.getSnapshot().undoCount;
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      await screen
        .getByRole("button", { name: "Save order", exact: true })
        .click();
      await expect
        .poll(() =>
          controller
            .getSnapshot()
            .head!.document.sections[0].entries.map((entry) => entry.id),
        )
        .toEqual([before[2], before[1], before[0]]);
      // The head updates before receipt maintenance finishes. Wait for the Save
      // to settle before unmount disposes the controller and stops publications.
      await expect.poll(() => controller.getSnapshot().saving).toBe(false);
      expect(controller.getSnapshot().undoCount).toBe(undoCount + 1);
      await expect
        .element(
          screen.getByRole("button", { name: "Cancel order", exact: true }),
        )
        .toBeDisabled();
    } finally {
      await screen.unmount();
    }
  });
});
