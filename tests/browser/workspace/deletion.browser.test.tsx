import { afterEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import { createCareerDocument } from "@/lib/career/model";
import { createResume } from "@/lib/career/resumes";
import { CareerController } from "@/stores/career/controller";
import {
  type CareerHead,
  CareerStorage,
  openCareerStorage,
} from "@/stores/career/persistence";
import {
  controllerOwner,
  request,
  setupCareerTests,
  storage,
  summaryDraft,
  trackController,
} from "@/tests/support/browser/career";

setupCareerTests();
afterEach(() => vi.restoreAllMocks());

const ACCOUNT_DB = "verso-account-deletion-test-owner";

/** Count raw records per store, independent of the storage class under test. */
async function rawStores(name: string) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const read = (store: string) =>
    new Promise<IDBValidKey[]>((resolve, reject) => {
      const keys = database
        .transaction(store, "readonly")
        .objectStore(store)
        .getAllKeys();
      keys.onsuccess = () => resolve(keys.result);
      keys.onerror = () => reject(keys.error);
    });
  const result = {
    heads: (await read("heads")).length,
    previous: (await read("previous")).length,
    drafts: (await read("drafts")).length,
    operations: (await read("operations")).length,
    preferences: (await read("preferences")).map(String).sort(),
  };
  database.close();
  return result;
}

function withResume(name: string) {
  const document = createCareerDocument();
  document.resumes.push({ ...createResume(document, "en-US"), name });
  return document;
}

/** Guest workspace with a resume, a previous workspace, recovery, a prepared request,
 * and device preferences. */
async function seedGuest() {
  const writer = await storage();
  const first = await writer.load(withResume("Older resume"));
  const head = await writer.replace(first, withResume("Current resume"));
  await writer.writeDraft(summaryDraft(head, "Unsaved summary"));
  const save = request(
    head,
    "sections",
    head.document.sections.map((s) => s.id),
    head.document.sections.map((s) => s.id).reverse(),
  );
  await writer.prepare(save);
  await writer.writeDevicePreferences({
    version: 1,
    values: { automaticRefresh: true },
  });
  return { writer, head };
}

async function seedOtherOwner() {
  const other = await openCareerStorage(ACCOUNT_DB);
  await other.cacheAccountHead({
    workspaceId: "account-workspace",
    revision: 0,
    generation: 0,
    document: createCareerDocument(),
  });
  await other.writeDraft(
    summaryDraft(
      {
        workspaceId: "account-workspace",
        revision: 0,
        generation: 0,
        document: createCareerDocument(),
      },
      "Account draft",
    ),
  );
  other.close();
}

async function deleteOtherOwner() {
  await new Promise<void>((resolve) => {
    const deletion = indexedDB.deleteDatabase(ACCOUNT_DB);
    deletion.onsuccess = deletion.onerror = () => resolve();
  });
}

async function openData(controller: CareerController) {
  window.history.replaceState(
    { versoIndex: 0, versoBackground: "overview" },
    "",
    "?scope=settings/data",
  );
  await render(<CareerWorkspace controller={controller} />);
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  const section = settings.getByRole("region", {
    name: "Delete workspace data",
  });
  await expect.element(section).toBeVisible();
  return { settings, section };
}

it("cancels without changes, then deletes only the guest workspace and opens a fresh Overview", async () => {
  const { writer, head } = await seedGuest();
  await seedOtherOwner();
  const controller = await controllerOwner();
  controller.open("profile");
  controller.change({
    ...head.document.profile,
    links: [],
  });
  const { settings, section } = await openData(controller);
  await controller.flushRecovery();
  const before = await rawStores("verso-local");

  await section.getByRole("button", { name: "Delete workspace data" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete workspace data permanently?",
  });
  await expect.element(dialog).toHaveTextContent(/in this browser/);
  await expect.element(dialog).toHaveTextContent(/1 resume/);
  await expect.element(dialog).toHaveTextContent(/The previous workspace/);
  await expect
    .element(dialog)
    .toHaveTextContent(/Saved content only; unsaved drafts aren.t included/);
  const confirm = dialog.getByRole("button", {
    name: "Delete workspace data",
  });
  await expect.element(confirm).toBeDisabled();
  await dialog.getByLabelText("Type DELETE to confirm").fill("delete");
  await expect.element(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(await rawStores("verso-local")).toEqual(before);

  await section.getByRole("button", { name: "Delete workspace data" }).click();
  await dialog.getByLabelText("Type DELETE to confirm").fill("DELETE");
  await confirm.click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(settings).not.toBeInTheDocument();

  const fresh = controller.getSnapshot();
  expect(fresh.head!.workspaceId).not.toBe(head.workspaceId);
  expect(fresh.head!.generation).toBe(head.generation + 1);
  expect(fresh.head!.document.resumes).toEqual([]);
  expect(fresh.draft).toBeNull();
  expect(fresh.recovery).toEqual([]);
  expect(fresh.undoCount + fresh.redoCount).toBe(0);
  expect(await rawStores("verso-local")).toEqual({
    heads: 1,
    previous: 0,
    drafts: 0,
    operations: 0,
    preferences: ["device-settings-v1"],
  });
  expect(await writer.readDevicePreferences()).toEqual({
    version: 1,
    values: { automaticRefresh: true },
  });
  expect(await rawStores(ACCOUNT_DB)).toMatchObject({ heads: 1, drafts: 1 });
  await deleteOtherOwner();

  // The empty state persists across a reload.
  const reloaded = await controllerOwner();
  expect(reloaded.getSnapshot().head).toEqual(fresh.head);
  expect(reloaded.getSnapshot().recovery).toEqual([]);
});

it("requires fresh confirmation when a Save changes the workspace after review", async () => {
  const writer = await storage();
  const head = await writer.load(withResume("Reviewed resume"));
  const controller = await controllerOwner();
  const { section } = await openData(controller);
  await section.getByRole("button", { name: "Delete workspace data" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete workspace data permanently?",
  });
  await dialog.getByLabelText("Type DELETE to confirm").fill("DELETE");

  // Another tab saves after the dialog opened.
  const other = new CareerController();
  trackController(other);
  await other.initialize();
  const order = head.document.sections.map((item) => item.id);
  other.open("sections");
  other.change([...order].reverse());
  expect(await other.save()).toBe(true);
  // That tab closes; its Save notice already reached this tab.
  await other.dispose();

  await expect
    .element(dialog.getByRole("status"))
    .toHaveTextContent(/changed since you opened this/);
  await expect
    .element(dialog.getByRole("button", { name: "Delete workspace data" }))
    .toBeDisabled();
  await dialog
    .getByRole("button", { name: "Review updated workspace" })
    .click();
  await expect
    .element(dialog.getByLabelText("Type DELETE to confirm"))
    .toHaveValue("");

  // A transaction-time recheck also rejects a stale reviewed identity.
  await expect(controller.deleteWorkspaceData(head)).resolves.toMatchObject({
    ok: false,
    reason: "conflict",
  });
  expect((await writer.load()).workspaceId).toBe(head.workspaceId);

  await dialog.getByLabelText("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete workspace data" }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect((await writer.load()).workspaceId).not.toBe(head.workspaceId);
});

it("fences a stale tab's queued recovery write and pending Save, then moves it to the fresh workspace", async () => {
  const writer = await storage();
  const head = await writer.load(withResume("Shared resume"));
  const deleting = await controllerOwner();
  const stale = await controllerOwner();
  stale.open("summary");
  stale.change({
    ...head.document.summary,
    wording: { "en-US": "Typed in the stale tab" },
  });

  const result = await deleting.deleteWorkspaceData(head);
  expect(result).toMatchObject({ ok: true, cleanup: "complete" });
  const fresh = deleting.getSnapshot().head!;

  // A delayed write carrying the deleted workspace is rejected by storage itself.
  await expect(
    writer.writeDraft(summaryDraft(head, "Late"), head.workspaceId),
  ).rejects.toMatchObject({ code: "replaced" });
  // The stale tab's own Save and recovery cannot repopulate the fresh workspace.
  await stale.flushRecovery();
  await stale.save();
  await expect
    .poll(() => stale.getSnapshot().head?.workspaceId)
    .toBe(fresh.workspaceId);
  expect(stale.getSnapshot().draft).toBeNull();
  expect(stale.getSnapshot().workspaceReset?.source).toBe("elsewhere");
  expect(await writer.drafts()).toEqual([]);
  expect(await rawStores("verso-local")).toMatchObject({
    drafts: 0,
    operations: 0,
  });
  expect(await writer.load()).toEqual(fresh);

  // Explicit recovery import still works in the fresh workspace.
  await stale.importRecovery([summaryDraft(head, "Imported from file")]);
  expect(await writer.drafts()).toHaveLength(1);
});

it.each([
  ["a conflict", "conflict"],
  ["a storage failure", "storage"],
] as const)(
  "keeps open drafts and resumes recovery after %s",
  async (_label, failure) => {
    const writer = await storage();
    const head = await writer.load(createCareerDocument());
    const controller = await controllerOwner();
    controller.open("summary");
    controller.change({
      ...head.document.summary,
      wording: { "en-US": "Before deletion" },
    });
    let reviewed: CareerHead = head;
    if (failure === "conflict") {
      const order = head.document.sections.map((item) => item.id);
      const save = request(head, "sections", order, [...order].reverse());
      await writer.prepare(save);
      await writer.commit(save.id);
    } else {
      vi.spyOn(CareerStorage.prototype, "resetWorkspace").mockRejectedValueOnce(
        new DOMException("Disk full", "QuotaExceededError"),
      );
      reviewed = controller.getSnapshot().head!;
    }
    const result = await controller.deleteWorkspaceData(reviewed);
    expect(result).toMatchObject({ ok: false, reason: failure });
    expect(controller.getSnapshot().draft?.values).toMatchObject({
      wording: { "en-US": "Before deletion" },
    });
    controller.change({
      ...head.document.summary,
      wording: { "en-US": "After the failed deletion" },
    });
    await controller.dispose();

    const reloaded = new CareerController();
    trackController(reloaded);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().head!.workspaceId).toBe(head.workspaceId);
    expect(reloaded.getSnapshot().recovery).toEqual([
      expect.objectContaining({
        scope: "summary",
        values: expect.objectContaining({
          wording: { "en-US": "After the failed deletion" },
        }),
      }),
    ]);
  },
);
