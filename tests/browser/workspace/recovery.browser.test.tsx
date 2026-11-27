import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import {
  createCareerDocument,
  createEntry,
  duplicateEntry,
} from "@/lib/career/model";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage } from "@/stores/career/persistence";
import {
  controllerOwner,
  request,
  setupCareerTests,
  storage,
  storedDraft,
  summaryDraft,
  trackController,
} from "@/tests/support/browser/career";
import type { CareerDraft } from "@/types-and-constants/career";

setupCareerTests();

describe("Save and recovery", () => {
  it("protects uncertain completed receipts and discovers their request after restart", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const draft = summaryDraft(head);
    const save = request(head, "summary", draft.baseline, draft.values, {
      draftId: draft.draftId,
      draftVersion: 1,
    });
    await owner.writeDraft(draft);
    await owner.prepare(save);
    await owner.commit(save.id);
    expect(await owner.drafts()).toEqual([]);
    await owner.pruneCompleted(0, 0);
    const controller = await controllerOwner();
    await controller.refresh();
    const recovered = controller
      .getSnapshot()
      .recovery.find((item) => item.operationId === save.id)!;
    expect(recovered.values).toEqual(draft.values);
    controller.restore(recovered);
    expect(await controller.save()).toBe(true);
    expect(controller.getSnapshot().head?.revision).toBe(1);
    expect(await owner.drafts()).toEqual([]);
    await owner.pruneCompleted(0, 0);
    await expect(owner.commit(save.id)).rejects.toThrow(/unknown/);
  });
  it("retries durable exact-version cleanup after reload while preserving newer edits", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const first = summaryDraft(head);
    await owner.writeDraft(first);
    const original = IDBObjectStore.prototype.delete;
    const fault = vi
      .spyOn(IDBObjectStore.prototype, "delete")
      .mockImplementation(function (this: IDBObjectStore, key) {
        if (this.name === "drafts")
          throw new Error("Cleanup transaction failed");
        return original.call(this, key);
      });
    try {
      await expect(
        owner.discardDraft(first.draftId, first.draftVersion),
      ).rejects.toThrow(/Cleanup transaction/);
    } finally {
      fault.mockRestore();
    }
    expect(await owner.drafts()).toEqual([]);
    const newer = {
      ...first,
      draftVersion: 2,
      values: {
        ...head.document.summary,
        wording: { "en-US": "Newer typing" },
      },
    };
    await owner.writeDraft(newer);
    const reloaded = await controllerOwner();
    expect(reloaded.getSnapshot().recovery).toEqual([newer]);
    await owner.discardDraft(newer.draftId, newer.draftVersion);
    expect(await owner.drafts()).toEqual([]);
    const second = { ...first, draftId: "cleanup-on-load" };
    await owner.writeDraft(second);
    const retryFault = vi
      .spyOn(IDBObjectStore.prototype, "delete")
      .mockImplementation(function (this: IDBObjectStore, key) {
        if (this.name === "drafts") throw new Error("Retry later");
        return original.call(this, key);
      });
    try {
      await expect(owner.discardDraft(second.draftId, 1)).rejects.toThrow();
    } finally {
      retryFault.mockRestore();
    }
    const nextLoad = await controllerOwner();
    expect(nextLoad.getSnapshot().recovery).toEqual([]);
  });

  it("retains pending and recovery-referenced receipts when completed receipt capacity is zero", async () => {
    const owner = await storage();
    const initial = await owner.load(createCareerDocument());
    const completed = request(initial, "summary", initial.document.summary, {
      ...initial.document.summary,
      wording: { "en-US": "Acknowledgment uncertain" },
    });
    await owner.prepare(completed);
    const head = await owner.commit(completed.id);
    const draft = {
      ...summaryDraft(initial),
      operationId: completed.id,
      fingerprint: completed.fingerprint,
    };
    await owner.writeDraft(draft);
    const pending = request(head, "profile", head.document.profile, {
      ...head.document.profile,
      fields: head.document.profile.fields.map((field, index) =>
        index === 0
          ? { ...field, wording: { "en-US": "Pending name" } }
          : field,
      ),
    });
    await owner.prepare(pending);
    await owner.pruneCompleted(0, 0);
    expect((await owner.commit(completed.id)).revision).toBe(1);
    expect((await owner.commit(pending.id)).revision).toBe(2);
    expect(await owner.drafts()).toEqual([draft]);
    await owner.discardDraft(draft.draftId, draft.draftVersion);
    await owner.acknowledge(completed.id);
    await owner.acknowledge(pending.id);
    await owner.pruneCompleted(0, 0);
    await expect(owner.commit(completed.id)).rejects.toThrow(/unknown/);
    await expect(owner.commit(pending.id)).rejects.toThrow(/unknown/);
  });

  it("keeps edits made during an in-flight Save as a new recoverable draft", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const initial = controller.getSnapshot().head!;
    controller.open("summary");
    const first = {
      ...initial.document.summary,
      wording: { "en-US": "Captured Save" },
    };
    const newer = {
      ...initial.document.summary,
      wording: { "en-US": "Newer typing" },
    };
    controller.change(first);
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = CareerStorage.prototype.commit;
    const delayed = vi
      .spyOn(CareerStorage.prototype, "commit")
      .mockImplementation(async function (this: CareerStorage, id) {
        entered();
        await gate;
        return original.call(this, id);
      });
    const saving = controller.save();
    try {
      await started;
      controller.change(newer);
      await controller.flushRecovery();
      release();
      expect(await saving).toBe(true);
    } finally {
      release();
      await saving;
      delayed.mockRestore();
    }
    expect((await owner.load()).document.summary).toEqual(first);
    expect(controller.getSnapshot().draft).toMatchObject({
      baseline: first,
      values: newer,
      baselineRevision: 1,
    });
    expect(controller.getSnapshot().draft?.operationId).toBeUndefined();
    expect(await owner.drafts()).toEqual([
      storedDraft(controller.getSnapshot().draft),
    ]);
    expect(controller.getSnapshot().undoCount).toBe(1);
    expect(await controller.save()).toBe(true);
    expect((await owner.load()).document.summary).toEqual(newer);
    expect(controller.getSnapshot().undoCount).toBe(2);
    expect(await owner.drafts()).toEqual([]);
  });

  it("retains the editable and durable draft when explicit Discard cleanup fails", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const head = controller.getSnapshot().head!;
    controller.open("summary");
    controller.change({
      ...head.document.summary,
      wording: { "en-US": "Keep me" },
    });
    await controller.flushRecovery();
    const draft = controller.getSnapshot().draft;
    const fault = vi
      .spyOn(CareerStorage.prototype, "confirmDraftDiscard")
      .mockRejectedValue(new Error("Cleanup unavailable"));
    try {
      await expect(controller.cancel()).resolves.toMatchObject({
        kind: "unconfirmed",
        message: expect.stringContaining("Cleanup unavailable"),
      });
    } finally {
      fault.mockRestore();
    }
    expect(controller.getSnapshot().draft).toEqual(draft);
    expect(await owner.drafts()).toEqual([storedDraft(draft)]);
    expect(await owner.load()).toEqual(head);
    expect(controller.getSnapshot().undoCount).toBe(0);
    await controller.cancel();
    expect(controller.getSnapshot().draft).toBeNull();
    expect(await owner.drafts()).toEqual([]);
  });

  it("confirms Cancel before physical removal and excludes only its resolved version after reload", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const head = controller.getSnapshot().head!;
    controller.open("summary");
    controller.change({
      ...head.document.summary,
      wording: { "en-US": "Discarded" },
    });
    await controller.flushRecovery();
    const draft = controller.getSnapshot().draft!;
    const original = IDBObjectStore.prototype.delete;
    const fault = vi
      .spyOn(IDBObjectStore.prototype, "delete")
      .mockImplementation(function (this: IDBObjectStore, key) {
        if (this.name === "drafts") throw new Error("Removal unavailable");
        return original.call(this, key);
      });
    try {
      expect(await controller.cancel()).toEqual({
        kind: "discarded",
        draftId: draft.draftId,
        draftVersion: draft.draftVersion,
      });
      expect(controller.getSnapshot().draft).toBeNull();
      await expect
        .poll(() => controller.getSnapshot().recoveryCleanupPending)
        .toBe(true);
      const reloaded = await controllerOwner();
      expect(reloaded.getSnapshot().recovery).toEqual([]);
      expect(reloaded.getSnapshot().recoveryCleanupPending).toBe(true);
      const newer = { ...draft, draftVersion: draft.draftVersion + 1 };
      await owner.writeDraft(newer);
      expect(await owner.drafts()).toEqual([newer]);
    } finally {
      fault.mockRestore();
    }
    expect(await controller.retryRecoveryCleanup()).toBe(true);
    expect(controller.getSnapshot().recoveryCleanupPending).toBe(false);
    expect((await owner.drafts()).map((item) => item.draftVersion)).toEqual([
      draft.draftVersion + 1,
    ]);
  });

  it("imports recovery with fresh identities and no replayable operation or committed changes", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const head = controller.getSnapshot().head!;
    const source = {
      ...summaryDraft(head),
      workspaceId: "foreign-workspace",
      operationId: "foreign-operation",
      fingerprint: "foreign-receipt",
    };
    const before = structuredClone(source);
    await controller.importRecovery([source]);
    await controller.importRecovery([source]);
    const imported = await owner.drafts();
    expect(imported).toHaveLength(2);
    expect(new Set(imported.map((draft) => draft.draftId)).size).toBe(2);
    for (const draft of imported) {
      expect(draft.draftId).not.toBe(source.draftId);
      expect(draft.operationId).toBeUndefined();
      expect(draft.fingerprint).toBeUndefined();
      expect(draft.values).toEqual(source.values);
      expect(draft.workspaceId).toBe("foreign-workspace");
    }
    expect(source).toEqual(before);
    expect(await owner.load()).toEqual(head);
    expect(controller.getSnapshot().draft).toBeNull();
    expect(controller.getSnapshot().undoCount).toBe(0);
  });

  it("requires explicit restore-as-new for a missing recovered entry and commits fresh identities only on Save", async () => {
    const controller = await controllerOwner();
    await controller.command("new-section/destination", {
      id: "destination",
      kind: "experience",
      icon: "briefcase-business",
      name: "Work",
      heading: {},
      archived: false,
    });
    const owner = await storage();
    const head = controller.getSnapshot().head!;
    const missing = createEntry("experience");
    missing.fields[0].wording["en-US"] = "Recovered engineer";
    const draft: CareerDraft = {
      ...summaryDraft(head),
      scope: `entry/${missing.id}`,
      baseline: missing,
      values: { ...missing, name: "Recovered" },
    };
    await owner.writeDraft(draft);
    controller.restore(draft);
    expect(controller.reconcile()).toBe(false);
    expect(controller.getSnapshot().error).toContain("Original record missing");
    expect(await owner.load()).toEqual(head);
    expect(await owner.drafts()).toEqual([draft]);
    const fresh = duplicateEntry(draft.values as typeof missing);
    controller.restoreAsNew("destination", fresh);
    expect(controller.getSnapshot().draft?.scope).toBe(
      `new-entry/destination/${fresh.id}`,
    );
    await controller.flushRecovery();
    expect(
      (await owner.load()).document.sections.find(
        (section) => section.id === "destination",
      )!.entries,
    ).toEqual([]);
    expect(await controller.save()).toBe(true);
    const entries = (await owner.load()).document.sections.find(
      (section) => section.id === "destination",
    )!.entries;
    expect(entries).toEqual([fresh]);
    expect(entries[0].id).not.toBe(missing.id);
    expect(entries[0].fields[0].id).not.toBe(missing.fields[0].id);
    expect(await owner.drafts()).toEqual([]);
  });
});

describe("real IndexedDB atomic career saves", () => {
  it("cleans only acknowledged draft versions and never expires unresolved recovery", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const baseline = head.document.summary;
    const values = { ...baseline, wording: { "en-US": "One" } };
    const draft = {
      draftId: "draft",
      draftVersion: 1,
      workspaceId: head.workspaceId,
      scope: "summary",
      baseline,
      baselineRevision: 0,
      generation: 0,
      values,
    };
    await owner.writeDraft(draft);
    const save = request(head, "summary", baseline, values, {
      draftId: "draft",
      draftVersion: 1,
    });
    await owner.prepare(save);
    await owner.writeDraft({
      ...draft,
      draftVersion: 2,
      values: { ...baseline, wording: { "en-US": "Newer" } },
    });
    await owner.commit(save.id);
    expect((await owner.drafts())[0].draftVersion).toBe(2);
    await owner.acknowledge(save.id);
    await owner.discardDraft("draft", 1);
    expect(await owner.drafts()).toHaveLength(1);
    await owner.pruneCompleted(0, 0);
    expect(await owner.drafts()).toHaveLength(1);
    await expect(owner.commit(save.id)).rejects.toThrow(/unknown/);
    await owner.discardDraft("draft", 2);
    expect(await owner.drafts()).toEqual([]);
  });
});

describe("career editing boundaries", () => {
  it("retries an interrupted acknowledgment with the same operation ID and one history step", async () => {
    const controller = new CareerController();
    trackController(controller);
    await controller.initialize();
    const owner = await storage();
    const initial = controller.getSnapshot().head!;
    controller.open("summary");
    controller.change({
      ...initial.document.summary,
      wording: { "en-US": "Committed despite lost response" },
    });
    const original = CareerStorage.prototype.commit;
    let interrupted = false;
    CareerStorage.prototype.commit = async function (id: string) {
      const result = await original.call(this, id);
      if (!interrupted) {
        interrupted = true;
        throw new Error("Interrupted acknowledgment");
      }
      return result;
    };
    try {
      expect(await controller.save()).toBe(false);
      const operationId = controller.getSnapshot().draft!.operationId;
      expect(operationId).toBeTruthy();
      expect((await owner.load()).revision).toBe(1);
      expect(controller.getSnapshot().undoCount).toBe(0);
      expect(await controller.save()).toBe(true);
      expect((await owner.load()).revision).toBe(1);
      expect(controller.getSnapshot().undoCount).toBe(1);
    } finally {
      CareerStorage.prototype.commit = original;
    }
  });

  it("requires reconciliation for an unknown recovered operation, then creates a new explicit Save", async () => {
    const controller = new CareerController();
    trackController(controller);
    await controller.initialize();
    const head = controller.getSnapshot().head!;
    const values = {
      ...head.document.summary,
      wording: { "en-US": "Recovered pending request" },
    };
    const draft = {
      draftId: "unknown-draft",
      draftVersion: 1,
      workspaceId: head.workspaceId,
      scope: "summary",
      baseline: head.document.summary,
      baselineRevision: 0,
      generation: 0,
      values,
      operationId: "missing",
      fingerprint: JSON.stringify([
        head.workspaceId,
        0,
        "summary",
        head.document.summary,
        values,
        "unknown-draft",
        1,
      ]),
    };
    controller.restore(draft);
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().error).toContain("unknown");
    expect(controller.getSnapshot().draft?.operationId).toBe("missing");
    controller.reconcile();
    expect(controller.getSnapshot().draft?.operationId).toBeUndefined();
    expect(await controller.save()).toBe(true);
    expect(controller.getSnapshot().head?.revision).toBe(1);
  });

  it("renders structurally malformed imported recovery safely without committing it", async () => {
    const controller = new CareerController();
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await expect.poll(() => controller.getSnapshot().ready).toBe(true);
      const head = controller.getSnapshot().head!;
      await controller.importRecovery([
        {
          draftId: "imported",
          draftVersion: 1,
          workspaceId: "other-workspace",
          scope: "profile",
          baseline: null,
          baselineRevision: 0,
          generation: 0,
          values: {
            fields: "not an array",
            links: null,
            id: "<script>unsafe</script>",
          },
          operationId: "untrusted-receipt",
        },
      ]);
      await expect
        .element(screen.getByRole("region", { name: "Unsaved drafts" }))
        .not.toBeInTheDocument();
      await screen
        .getByRole("button", { name: "Account menu", exact: true })
        .click();
      await screen
        .getByRole("menuitem", { name: "Settings", exact: true })
        .click();
      await screen
        .getByRole("dialog", { name: "Settings", exact: true })
        .getByRole("button", { name: "Data", exact: true })
        .click();
      await expect
        .element(screen.getByRole("region", { name: "Unsaved drafts" }))
        .toBeVisible();
      await screen
        .getByRole("button", { name: "Restore draft", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Recovered values (JSON)" }),
        )
        .toHaveValue(
          JSON.stringify(
            {
              fields: "not an array",
              links: null,
              id: "<script>unsafe</script>",
            },
            null,
            2,
          ),
        );
      expect(controller.getSnapshot().draft?.operationId).toBeUndefined();
      await screen
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true })
        .click();
      expect(controller.getSnapshot().head).toEqual(head);
      expect(controller.getSnapshot().draft).not.toBeNull();
      expect(document.body.innerHTML).not.toContain("<script>unsafe</script>");
    } finally {
      await screen.unmount();
    }
  });

  it("restores recovery without commit and retains conflicting versions until explicit reconciliation", async () => {
    const controller = new CareerController();
    trackController(controller);
    await controller.initialize();
    const head = controller.getSnapshot().head!;
    const owner = await storage();
    const draft = {
      draftId: "recovered",
      draftVersion: 2,
      workspaceId: head.workspaceId,
      scope: "summary",
      baseline: head.document.summary,
      baselineRevision: 0,
      generation: 0,
      values: { ...head.document.summary, wording: { "en-US": "Recovered" } },
    };
    await owner.writeDraft(draft);
    const competing = request(head, "summary", head.document.summary, {
      ...head.document.summary,
      wording: { "en-US": "Other tab" },
    });
    await owner.prepare(competing);
    await owner.commit(competing.id);
    await controller.refresh();
    controller.restore(draft);
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(await controller.save()).toBe(false);
    expect(await owner.drafts()).toHaveLength(1);
    expect(controller.getSnapshot().draft?.values).toEqual(draft.values);
    expect((await owner.load()).document.summary.wording["en-US"]).toBe(
      "Other tab",
    );
    controller.reconcile();
    expect(await controller.save()).toBe(true);
    expect((await owner.load()).document.summary.wording["en-US"]).toBe(
      "Recovered",
    );
  });

  it("leaves no orphaned recovery after a quick Discard or a reverted edit", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const summary = controller.getSnapshot().head!.document.summary;
    controller.open("summary");
    controller.change({ ...summary, wording: { "en-US": "Stored" } });
    await controller.flushRecovery();
    // Newer typing that has not been flushed yet when Discard runs.
    controller.change({ ...summary, wording: { "en-US": "Unflushed" } });
    await controller.cancel();
    expect(await owner.drafts()).toEqual([]);

    controller.open("summary");
    controller.change({ ...summary, wording: { "en-US": "Stored" } });
    await controller.flushRecovery();
    controller.change(summary);
    expect(controller.isDirty()).toBe(false);
    await controller.cancel();
    expect(await owner.drafts()).toEqual([]);
  });

  it("lists stored drafts with their age and discards one only after confirmation", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const draft = {
      ...summaryDraft(head, "Listed draft"),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    };
    await owner.writeDraft(draft);
    const controller = new CareerController();
    trackController(controller);
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    await expect.poll(() => controller.getSnapshot().ready).toBe(true);
    await screen
      .getByRole("button", { name: "Account menu", exact: true })
      .click();
    await screen
      .getByRole("menuitem", { name: "Settings", exact: true })
      .click();
    const settings = screen.getByRole("dialog", {
      name: "Settings",
      exact: true,
    });
    await settings.getByRole("button", { name: "Data", exact: true }).click();
    const drafts = screen.getByRole("region", { name: "Unsaved drafts" });
    await expect.element(drafts.getByText("Summary")).toBeVisible();
    await expect
      .element(drafts.getByText("Edited 5 minutes ago"))
      .toBeVisible();
    await drafts.getByRole("button", { name: "Preview Summary" }).click();
    await expect
      .element(
        drafts.getByRole("region", { name: "Compare saved content and draft" }),
      )
      .toBeVisible();
    await drafts.getByRole("button", { name: "Discard Summary" }).click();
    const confirm = screen.getByRole("alertdialog", {
      name: "Discard this draft?",
    });
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await owner.drafts()).toHaveLength(1);
    await drafts.getByRole("button", { name: "Discard Summary" }).click();
    await screen
      .getByRole("alertdialog", { name: "Discard this draft?" })
      .getByRole("button", { name: "Discard draft", exact: true })
      .click();
    await expect.element(drafts.getByText(/No unsaved drafts/)).toBeVisible();
    expect(await owner.drafts()).toEqual([]);
    expect(await owner.load()).toEqual(head);
  });

  it("offers a stored draft when its form opens and restores it only on request", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const draft = {
      ...summaryDraft(head, "From last session"),
      updatedAt: new Date().toISOString(),
    };
    await owner.writeDraft(draft);
    window.history.replaceState({ versoIndex: 0 }, "", "?scope=summary");
    const controller = new CareerController();
    trackController(controller);
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    const notice = screen.getByRole("status", { name: "Stored draft" });
    await expect.element(notice).toBeVisible();
    expect(controller.getSnapshot().draft?.draftId).not.toBe(draft.draftId);
    await notice
      .getByRole("button", { name: "Restore stored draft", exact: true })
      .click();
    await expect
      .poll(() => controller.getSnapshot().draft?.draftId)
      .toBe(draft.draftId);
    await expect
      .element(screen.getByRole("status", { name: "Restored draft" }))
      .toBeVisible();
    expect(await owner.load()).toEqual(head);
  });
});
