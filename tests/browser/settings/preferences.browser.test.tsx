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
  it("defers receipt pruning after a preference read fails until a write succeeds", async () => {
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
    await controller.changePreferences({ automaticRefresh: true });
    controller.open("defaults");
    controller.change({
      ...controller.getSnapshot().head!.document.defaults,
      fontSize: 12,
    });
    expect(await controller.save()).toBe(true);
    expect(prune).toHaveBeenCalledWith();
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
    await page.getByRole("button", { name: "Draft recovery" }).click();
    await expect
      .element(
        page.getByRole("button", {
          name: "Export unsaved drafts",
          exact: true,
        }),
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
    expect(window.location.pathname).toContain("editing-preview");
    expect(controller.getSnapshot().draft?.scope).toBe("summary");
  });

  it("applies the visible refresh toggle immediately and offers retry after a write failure", async () => {
    const controller = await owner();
    const write = vi
      .spyOn(CareerStorage.prototype, "writeDevicePreferences")
      .mockRejectedValueOnce(new Error("quota"));
    window.history.replaceState({}, "", "?scope=settings/editing-preview");
    await render(<CareerWorkspace controller={controller} />);
    const toggle = page.getByRole("checkbox", {
      name: "Refresh preview automatically after Save",
    });
    await expect.element(toggle).not.toBeChecked();
    await expect
      .element(page.getByRole("button", { name: "Advanced settings" }))
      .not.toBeInTheDocument();
    await toggle.click();
    await expect.element(toggle).toBeChecked();
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().head!.revision).toBe(0);
    await page
      .getByRole("button", { name: "Retry saving preferences" })
      .click();
    await expect
      .element(page.getByText("Browser preferences saved."))
      .toBeVisible();
    expect(write).toHaveBeenCalledTimes(2);
    const reloaded = await owner();
    expect(reloaded.getSnapshot().preferences.automaticRefresh).toBe(true);
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
    const first = controller.changePreferences({ automaticRefresh: true });
    await expect.poll(() => write.mock.calls.length).toBe(1);
    const second = controller.changePreferences({ automaticRefresh: false });
    expect(controller.getSnapshot().preferences.automaticRefresh).toBe(false);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    const reloaded = await owner();
    expect(reloaded.getSnapshot().preferences.automaticRefresh).toBe(false);
  });

  it("loads legacy preferences without rewriting them and keeps refresh across replacement and rollback", async () => {
    const storage = await openCareerStorage();
    connections.push(storage);
    const legacy = {
      version: 1,
      values: {
        automaticRefresh: true,
        completedOperationDays: 0,
        completedOperationCount: 17,
        initializationTimeoutMs: 60_000,
        compilationTimeoutMs: 45_000,
      },
    };
    await storage.writeDevicePreferences(legacy);
    const controller = await owner();
    expect(controller.getSnapshot().preferences).toEqual({
      automaticRefresh: true,
    });
    const incoming = createCareerDocument("pt-BR");
    expect(
      await controller.replace(controller.getSnapshot().head!, incoming),
    ).toEqual({ ok: true });
    expect(await controller.replace(controller.getSnapshot().head!)).toEqual({
      ok: true,
    });
    const prune = vi.spyOn(CareerStorage.prototype, "pruneCompleted");
    const reloaded = await owner();
    expect(prune).toHaveBeenCalledWith();
    expect(reloaded.getSnapshot().preferences.automaticRefresh).toBe(true);
    expect(await storage.readDevicePreferences()).toEqual(legacy);
  });
});
