import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createCareerDocument } from "@/lib/career/model";
import { CareerController } from "@/stores/career/controller";
import {
  type CareerHead,
  CareerStorage,
  openCareerStorage,
} from "@/stores/career/persistence";

const owners: CareerStorage[] = [];
const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialState = window.history.state;

/** Initialize a tracked controller released after each case. */
async function controllerOwner() {
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

/** Open an independent connection standing in for another tab. */
async function storage() {
  const value = await openCareerStorage();
  owners.push(value);
  return value;
}

/** Edit and Save the summary through the ordinary form scope. */
async function saveSummary(
  controller: CareerController,
  wording: string,
  memory = false,
) {
  const head = controller.getSnapshot().head!;
  controller.open("summary");
  controller.change({
    ...head.document.summary,
    wording: { "en-US": wording },
  });
  return controller.save(memory);
}

/** Commit a summary change from another connection, as another tab would. */
async function commitElsewhere(owner: CareerStorage, wording: string) {
  const head = await owner.load();
  const values = { ...head.document.summary, wording: { "en-US": wording } };
  const id = crypto.randomUUID();
  const request = {
    id,
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "summary",
    baseline: head.document.summary,
    values,
    draftId: id,
    draftVersion: 1,
    baselineRevision: head.revision,
    fingerprint: JSON.stringify([
      head.workspaceId,
      head.generation,
      "summary",
      head.document.summary,
      values,
      id,
      1,
    ]),
  };
  await owner.prepare(request);
  return owner.commit(id);
}

async function reset() {
  const deletion = indexedDB.deleteDatabase("verso-local");
  await new Promise<void>((resolve, reject) => {
    deletion.onsuccess = () => resolve();
    deletion.onerror = () => reject(deletion.error);
    deletion.onblocked = () => reject(new Error("Test database still owned."));
  });
}

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
  for (const owner of controllers) {
    await expect.poll(() => owner.getSnapshot().saving).toBe(false);
    await owner.flushRecovery();
    owner.dispose();
  }
  controllers.length = 0;
  owners.forEach((owner) => owner.close());
  owners.length = 0;
  await reset();
  window.history.replaceState(initialState, "", initialUrl);
});

describe("typed Save status", () => {
  it("distinguishes saved, conflict, storage, and replaced failures without parsing text", async () => {
    const controller = await controllerOwner();
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "durable",
      saveStatus: { kind: "saved", revision: 0 },
    });
    expect(await saveSummary(controller, "First")).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      saveStatus: { kind: "saved", revision: 1 },
      status: "Saved locally · revision 1",
    });

    const other = await storage();
    controller.open("summary");
    controller.change({
      ...controller.getSnapshot().head!.document.summary,
      wording: { "en-US": "Stale local edit" },
    });
    await commitElsewhere(other, "Other tab");
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "failed",
      reason: "conflict",
    });
    expect(controller.getSnapshot().draft).not.toBeNull();
    await controller.cancel();

    await controller.refresh();
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "heads")
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.apply(this, args);
    });
    expect(await saveSummary(controller, "Quota")).toBe(false);
    vi.restoreAllMocks();
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "failed",
      reason: "storage",
    });
    expect(controller.getSnapshot().status).toMatch(/browser storage failed/);
    await controller.cancel();

    controller.open("summary");
    controller.change({
      ...controller.getSnapshot().head!.document.summary,
      wording: { "en-US": "Late after replacement" },
    });
    const reviewed = await other.load();
    await other.replace(reviewed, createCareerDocument("pt-BR"));
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "failed",
      reason: "replaced",
    });
    expect((await other.load()).document.languages[0].tag).toBe("pt-BR");
  });

  it("reports another tab's commit as a remote update and defers notifications received during Save", async () => {
    const controller = await controllerOwner();
    const other = await storage();
    await commitElsewhere(other, "From another tab");
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({
      saveStatus: { kind: "remote-update", revision: 1 },
      status: "Updated from another tab · revision 1",
    });
    expect(
      controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("From another tab");

    const load = vi.spyOn(CareerStorage.prototype, "load");
    const saving = saveSummary(controller, "Local");
    expect(controller.getSnapshot().saving).toBe(true);
    await controller.refresh();
    const during = load.mock.calls.length;
    expect(await saving).toBe(true);
    await expect.poll(() => load.mock.calls.length).toBeGreaterThan(during);
    // Let the deferred refresh settle before teardown closes storage.
    await Promise.all(load.mock.results.map((result) => result.value));
    await controller.refresh();
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "saved",
      revision: 2,
    });
  });
});

describe("session-only saving", () => {
  it("keeps the tab-only disclosure visible after a Save when IndexedDB could not open", async () => {
    vi.spyOn(IDBFactory.prototype, "open").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    const controller = await controllerOwner();
    expect(await saveSummary(controller, "Only in memory", true)).toBe(true);
    await render(<CareerWorkspace controller={controller} />);
    await expect
      .element(page.getByText("Saving in this tab only", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText(/1 Save exists only in this tab/))
      .toBeVisible();
    await expect
      .element(
        page.getByText(
          /Export this tab's saved workspace from Data & backups before closing/,
        ),
      )
      .toBeVisible();
    await expect
      .element(
        page.getByRole("button", {
          name: "Return to durable saving",
          exact: true,
        }),
      )
      .not.toBeInTheDocument();
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "unavailable",
      sessionCommits: 1,
    });
  });

  it("requires snapshot export or explicit continuation before adopting session Saves, retaining review on export failure", async () => {
    await page.viewport(1440, 900);
    const controller = await controllerOwner();
    const other = await storage();
    const original = await other.load();
    await other.replace(original, createCareerDocument());
    await controller.refresh();
    expect(await saveSummary(controller, "Session content", true)).toBe(true);
    await render(<CareerWorkspace controller={controller} />);
    const open = page.getByRole("button", {
      name: "Return to durable saving",
      exact: true,
    });
    await open.click();
    const review = page.getByRole("dialog", {
      name: "Return to durable saving",
      exact: true,
    });
    const adopt = review.getByRole("button", {
      name: "Keep this tab's workspace",
      exact: true,
    });
    await expect
      .element(review)
      .toHaveTextContent(/retained snapshot at revision 0 \(generation 0\)/);
    await expect.element(adopt).toBeDisabled();
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("Export unavailable");
    });
    await review
      .getByRole("button", {
        name: "Export snapshot being replaced (download initiated)",
        exact: true,
      })
      .click();
    await expect
      .element(
        page.getByText(
          /Export failed\. Retry or explicitly continue without export/,
        ),
      )
      .toBeInTheDocument();
    await expect.element(adopt).toBeDisabled();
    expect(await other.previous()).toEqual(original);
    await review.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.element(review).not.toBeInTheDocument();
    expect((await other.load()).generation).toBe(1);
    await open.click();
    await expect.element(adopt).toBeDisabled();
    await review
      .getByRole("button", {
        name: "Continue without exporting snapshot",
        exact: true,
      })
      .click();
    await adopt.click();
    await expect.element(review).not.toBeInTheDocument();
    expect((await other.load()).document.summary.wording["en-US"]).toBe(
      "Session content",
    );
    expect((await other.previous())!.generation).toBe(1);
  });

  it("returns to durable saving by discarding tab-only commits after review", async () => {
    const controller = await controllerOwner();
    expect(await saveSummary(controller, "Memory only", true)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "session",
      sessionCommits: 1,
      saveStatus: { kind: "session", revision: 1 },
    });
    expect(await saveSummary(controller, "Durable attempt")).toBe(false);
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "failed",
      reason: "storage",
    });
    await controller.cancel();
    const reviewed = (await controller.durableHead())!;
    expect(reviewed.revision).toBe(0);
    expect(await controller.leaveSessionMode("keep-durable", reviewed)).toBe(
      true,
    );
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "durable",
      sessionCommits: 0,
      saveStatus: { kind: "saved", revision: 0 },
    });
    expect(controller.getSnapshot().head!.document.summary.wording).toEqual(
      reviewed.document.summary.wording,
    );
    expect(await saveSummary(controller, "Durable again")).toBe(true);
    expect((await (await storage()).load()).revision).toBe(1);
  });

  it("exports the exact previous workspace before permitting session adoption without changing durable content on export", async () => {
    await page.viewport(1440, 900);
    const controller = await controllerOwner();
    const other = await storage();
    const original = await other.load();
    const durable = await other.replace(original, createCareerDocument());
    await controller.refresh();
    expect(await saveSummary(controller, "Export first", true)).toBe(true);
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:snapshot-export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await render(<CareerWorkspace controller={controller} />);
    await page
      .getByRole("button", { name: "Return to durable saving", exact: true })
      .click();
    const review = page.getByRole("dialog", {
      name: "Return to durable saving",
      exact: true,
    });
    const adopt = review.getByRole("button", {
      name: "Keep this tab's workspace",
      exact: true,
    });
    await expect.element(adopt).toBeDisabled();
    await page.viewport(390, 844);
    await expect
      .poll(() => review.element().scrollWidth <= review.element().clientWidth)
      .toBe(true);
    await review
      .getByRole("button", {
        name: "Export snapshot being replaced (download initiated)",
        exact: true,
      })
      .click();
    await expect.element(adopt).toBeEnabled();
    const file = create.mock.calls[0][0] as Blob;
    expect(JSON.parse(await file.text())).toMatchObject({
      format: "verso.workspace",
      schemaVersion: 2,
      workspaceId: original.workspaceId,
      document: original.document,
    });
    expect(await other.load()).toEqual(durable);
    expect(await other.previous()).toEqual(original);
    await adopt.click();
    await expect.element(review).not.toBeInTheDocument();
    expect((await other.previous())!.generation).toBe(durable.generation);
  });

  it("adopts this tab's workspace only against the reviewed durable revision and keeps one previous workspace", async () => {
    const controller = await controllerOwner();
    expect(await saveSummary(controller, "Keep this tab", true)).toBe(true);
    const stale: CareerHead = (await controller.durableHead())!;
    const other = await storage();
    await commitElsewhere(other, "Newer durable edit");
    expect(await controller.leaveSessionMode("replace-durable", stale)).toBe(
      false,
    );
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "session",
      sessionCommits: 1,
    });
    expect(controller.getSnapshot().error).toMatch(/changed since review/);
    const reviewed = (await controller.durableHead())!;
    expect(await controller.leaveSessionMode("replace-durable", reviewed)).toBe(
      true,
    );
    const durable = await other.load();
    expect(durable.generation).toBe(reviewed.generation + 1);
    expect(durable.document.summary.wording["en-US"]).toBe("Keep this tab");
    expect((await other.previous())!.document.summary.wording["en-US"]).toBe(
      "Newer durable edit",
    );
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "durable",
      sessionCommits: 0,
    });
  });
});
