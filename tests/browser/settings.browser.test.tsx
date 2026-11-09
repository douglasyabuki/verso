import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createCareerDocument } from "@/lib/career/model";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage, openCareerStorage } from "@/stores/career/persistence";

const controllers: CareerController[] = [];
const connections: CareerStorage[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

/** Create an isolated tracked owner; cleanup releases connections before deleting its database. */
async function owner() {
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

afterEach(async () => {
  await cleanup();
  for (const controller of controllers) {
    await controller.flushRecovery();
    controller.dispose();
  }
  controllers.length = 0;
  connections.forEach((connection) => connection.close());
  connections.length = 0;
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("verso-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Settings test database still owned."));
  });
  window.history.replaceState(initialState, "", initialUrl);
});

describe("Settings drafts and device preference persistence", () => {
  it.each(["defaults", "languages"] as const)(
    "guards Back from dirty %s while preserving an explicit data detour",
    async (scope) => {
      const controller = await owner();
      window.history.replaceState(
        { versoIndex: 0 },
        "",
        "?scope=settings/appearance",
      );
      await render(<CareerWorkspace controller={controller} />);
      const settings = page.getByRole("dialog", {
        name: "Settings",
        exact: true,
      });
      await settings
        .getByRole("button", {
          name: scope === "defaults" ? "Resume defaults" : "Content languages",
          exact: true,
        })
        .click();
      if (scope === "defaults")
        await settings
          .getByRole("textbox", { name: "Text size (pt)", exact: true })
          .fill("12");
      else
        await settings
          .getByRole("button", { name: "Deactivate en-US", exact: true })
          .click();
      const draft = controller.getSnapshot().draft;
      window.history.back();
      const guard = page.getByRole("dialog", {
        name: "Unsaved form",
        exact: true,
      });
      await expect.element(guard).toBeVisible();
      await guard.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect
        .poll(() => new URLSearchParams(window.location.search).get("scope"))
        .toBe(`settings/${scope}`);
      expect(controller.getSnapshot().draft).toEqual(draft);
      await settings
        .getByRole("button", { name: "Data & backups", exact: true })
        .click();
      await expect
        .element(
          settings.getByRole("heading", {
            name: "Data & backups",
            exact: true,
          }),
        )
        .toBeVisible();
      expect(controller.getSnapshot().draft).toEqual(draft);
      await settings
        .getByRole("button", { name: "Back to editing", exact: true })
        .click();
      expect(controller.getSnapshot().draft).toEqual(draft);
      expect(controller.getSnapshot().head!.revision).toBe(0);
    },
  );

  it("does not prune receipts using unknown preferences when their storage read fails", async () => {
    vi.spyOn(
      CareerStorage.prototype,
      "readDevicePreferences",
    ).mockRejectedValueOnce(new Error("Read failed"));
    const prune = vi.spyOn(CareerStorage.prototype, "pruneCompleted");
    const controller = await owner();
    expect(controller.getSnapshot().preferenceStatus).toContain(
      "could not be loaded",
    );
    expect(prune).not.toHaveBeenCalled();
    await controller.changePreferences({ completedOperationCount: 17 });
    controller.open("defaults");
    controller.change({
      ...controller.getSnapshot().head!.document.defaults,
      fontSize: 12,
    });
    expect(await controller.save()).toBe(true);
    expect(prune).toHaveBeenCalledWith(30, 17);
  });

  it("opens recovery tools without resolving either editor draft and closes back to editing", async () => {
    const controller = await owner();
    controller.open("summary");
    const summary = controller.getSnapshot().head!.document.summary;
    controller.change({ ...summary, wording: { "en-US": "Uncommitted" } });
    const section = controller.getSnapshot().head!.document.sections[0];
    controller.open(`entries/${section.id}`, "order");
    const formId = controller.getSnapshot().draft!.draftId;
    const orderId = controller.getSnapshot().orderDraft!.draftId;
    window.history.replaceState(
      { versoIndex: 0, versoBackground: "summary" },
      "",
      "?scope=settings/data",
    );
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(page.getByRole("dialog", { name: "Settings", exact: true }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole("button", { name: "Export recovery", exact: true }),
      )
      .toBeVisible();
    expect(controller.getSnapshot().draft?.draftId).toBe(formId);
    expect(controller.getSnapshot().orderDraft?.draftId).toBe(orderId);
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect
      .element(page.getByRole("dialog", { name: "Settings", exact: true }))
      .not.toBeInTheDocument();
    expect(controller.getSnapshot().draft?.draftId).toBe(formId);
    expect(controller.getSnapshot().orderDraft?.draftId).toBe(orderId);
    expect(controller.getSnapshot().head!.revision).toBe(0);
  });

  it("retains a dirty default-layout form on canceled closure, then Saves one workspace step", async () => {
    const controller = await owner();
    window.history.replaceState(
      { versoIndex: 0 },
      "",
      "?scope=settings/defaults",
    );
    await render(<CareerWorkspace controller={controller} />);
    const size = page.getByRole("textbox", {
      name: "Text size (pt)",
      exact: true,
    });
    await size.fill("12");
    expect(controller.getSnapshot().head!.document.defaults.fontSize).toBe(10);
    await page.getByRole("button", { name: "Close settings" }).click();
    const guard = page.getByRole("dialog", {
      name: "Unsaved form",
      exact: true,
    });
    await expect.element(guard).toBeVisible();
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.element(size).toHaveValue("12");
    await page
      .getByRole("dialog", { name: "Settings", exact: true })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect
      .poll(() => controller.getSnapshot().head!.document.defaults.fontSize)
      .toBe(12);
    expect(controller.getSnapshot().head!.revision).toBe(1);
    expect(controller.getSnapshot().undoCount).toBe(1);
  });

  it("guards entering workspace Settings forms but permits device and data panels", async () => {
    const controller = await owner();
    controller.open("summary");
    controller.change({
      ...controller.getSnapshot().head!.document.summary,
      wording: { "en-US": "Keep this" },
    });
    window.history.replaceState(
      { versoIndex: 0, versoBackground: "summary" },
      "",
      "?scope=settings/appearance",
    );
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("button", { name: "Editing & preview", exact: true })
      .click();
    expect(controller.getSnapshot().draft?.scope).toBe("summary");
    await page
      .getByRole("button", { name: "Resume defaults", exact: true })
      .click();
    const guard = page.getByRole("dialog", {
      name: "Unsaved form",
      exact: true,
    });
    await expect.element(guard).toBeVisible();
    await guard.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(window.location.search).toContain("editing-preview");
    expect(controller.getSnapshot().draft?.scope).toBe("summary");
  });

  it("retains immediate preferences after write failure and retries without workspace history", async () => {
    const controller = await owner();
    const write = vi
      .spyOn(CareerStorage.prototype, "writeDevicePreferences")
      .mockRejectedValueOnce(new Error("quota"));
    await controller.changePreferences({ compilationTimeoutMs: 45000 });
    expect(controller.getSnapshot().preferences.compilationTimeoutMs).toBe(
      45000,
    );
    expect(controller.getSnapshot().preferenceStatus).toContain("tab only");
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().head!.revision).toBe(0);
    await controller.changePreferences();
    expect(write).toHaveBeenCalledTimes(2);
    const reloaded = await owner();
    expect(reloaded.getSnapshot().preferences.compilationTimeoutMs).toBe(45000);
  });

  it("serializes rapid preference writes and persists the latest choice", async () => {
    const controller = await owner();
    const original = CareerStorage.prototype.writeDevicePreferences;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi
      .spyOn(CareerStorage.prototype, "writeDevicePreferences")
      .mockImplementationOnce(async function (this: CareerStorage, value) {
        await gate;
        await original.call(this, value);
      });
    const first = controller.changePreferences({ compilationTimeoutMs: 40000 });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    const second = controller.changePreferences({
      compilationTimeoutMs: 50000,
    });
    expect(controller.getSnapshot().preferences.compilationTimeoutMs).toBe(
      50000,
    );
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    const reloaded = await owner();
    expect(reloaded.getSnapshot().preferences.compilationTimeoutMs).toBe(50000);
  });

  it("keeps device preferences across replacement and rotating rollback", async () => {
    const controller = await owner();
    await controller.changePreferences({
      completedOperationCount: 17,
      initializationTimeoutMs: 60000,
    });
    const incoming = createCareerDocument("pt-BR");
    expect(
      await controller.replace(controller.getSnapshot().head!, incoming),
    ).toBe(true);
    expect(await controller.replace(controller.getSnapshot().head!)).toBe(true);
    const prune = vi.spyOn(CareerStorage.prototype, "pruneCompleted");
    const reloaded = await owner();
    expect(prune).toHaveBeenCalledWith(30, 17);
    expect(reloaded.getSnapshot().preferences.completedOperationCount).toBe(17);
    expect(reloaded.getSnapshot().preferences.initializationTimeoutMs).toBe(
      60000,
    );
  });

  it("rechecks defaults conflicts atomically and retains the losing draft", async () => {
    const first = await owner();
    const second = await owner();
    first.open("defaults");
    second.open("defaults");
    first.change({
      ...first.getSnapshot().head!.document.defaults,
      fontSize: 12,
    });
    second.change({
      ...second.getSnapshot().head!.document.defaults,
      fontSize: 11,
    });
    expect(await first.save()).toBe(true);
    expect(await second.save()).toBe(false);
    expect(second.getSnapshot().draft?.values).toMatchObject({ fontSize: 11 });
    const storage = await openCareerStorage();
    connections.push(storage);
    expect((await storage.load()).document.defaults.fontSize).toBe(12);
  });

  it("keeps defaults undo/redo independent of browser preferences", async () => {
    const controller = await owner();
    controller.open("defaults");
    controller.change({
      ...controller.getSnapshot().head!.document.defaults,
      fontSize: 12,
    });
    expect(await controller.save()).toBe(true);
    await controller.changePreferences({ compilationTimeoutMs: 45000 });
    await controller.history("undo");
    expect(controller.getSnapshot().head!.document.defaults.fontSize).toBe(10);
    await controller.history("redo");
    expect(controller.getSnapshot().head!.document.defaults.fontSize).toBe(12);
    expect(controller.getSnapshot().preferences.compilationTimeoutMs).toBe(
      45000,
    );
  });
});
