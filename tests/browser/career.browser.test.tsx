import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";

import { CareerWorkspace } from "@/components/career/career-workspace";
import {
  createCareerDocument,
  createEntry,
  duplicateEntry,
  readScope,
} from "@/lib/career/model";
import { CareerController } from "@/stores/career/controller";
import {
  type CareerHead,
  CareerStorage,
  openCareerStorage,
  type SaveRequest,
} from "@/stores/career/persistence";
import type { CareerDraft } from "@/types-and-constants/career";

const owners: CareerStorage[] = [];
const controllers: CareerController[] = [];
const initialUrl = window.location.href;
const initialHistoryState = window.history.state;

/** Initialize a tracked controller whose timers and connection are released after each case. */
async function controllerOwner() {
  const controller = new CareerController();
  controllers.push(controller);
  await controller.initialize();
  return controller;
}

/** Build an uncommitted summary recovery record against the supplied durable head. */
function summaryDraft(head: CareerHead, wording = "Recovered"): CareerDraft {
  return {
    draftId: crypto.randomUUID(),
    draftVersion: 1,
    workspaceId: head.workspaceId,
    generation: head.generation,
    baselineRevision: head.revision,
    scope: "summary",
    baseline: head.document.summary,
    values: { ...head.document.summary, wording: { "en-US": wording } },
  };
}

async function storage() {
  const value = await openCareerStorage();
  owners.push(value);
  return value;
}

function request(
  head: CareerHead,
  scope: string,
  baseline: unknown,
  values: unknown,
  extra: Partial<SaveRequest> = {},
): SaveRequest {
  const result = {
    id: crypto.randomUUID(),
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope,
    baseline,
    values,
    fingerprint: "",
    ...extra,
  };
  result.fingerprint = JSON.stringify([
    result.workspaceId,
    result.generation,
    scope,
    baseline,
    values,
    result.draftId,
    result.draftVersion,
  ]);
  return result;
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
  for (const owner of controllers) {
    await expect.poll(() => owner.getSnapshot().saving).toBe(false);
    await owner.flushRecovery();
    owner.dispose();
  }
  controllers.length = 0;
  owners.forEach((owner) => owner.close());
  owners.length = 0;
  await reset();
  window.history.replaceState(initialHistoryState, "", initialUrl);
});

describe("Phase 1 recovery and concurrency contracts", () => {
  it("explicitly discards an interrupted completed request without rediscovering it or undoing its commit", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const draft = summaryDraft(head);
    const save = request(head, "summary", draft.baseline, draft.values, {
      draftId: draft.draftId,
      draftVersion: 1,
    });
    await owner.prepare(save);
    await owner.commit(save.id);
    const controller = await controllerOwner();
    controller.restore(controller.getSnapshot().recovery[0]);
    await controller.cancel();
    const reloaded = await controllerOwner();
    expect(reloaded.getSnapshot().recovery).toEqual([]);
    expect(reloaded.getSnapshot().head?.revision).toBe(1);
    expect(reloaded.getSnapshot().head?.document.summary).toEqual(draft.values);
    await owner.pruneCompleted(0, 0);
    await expect(owner.commit(save.id)).rejects.toThrow(/unknown/);
  });
  it("navigates pristine forms without a recovery cleanup write or saving transition", async () => {
    const controller = await controllerOwner();
    const discard = vi.spyOn(CareerStorage.prototype, "discardDraft");
    const states: boolean[] = [];
    const unsubscribe = controller.subscribe(() =>
      states.push(controller.getSnapshot().saving),
    );
    try {
      controller.open("profile");
      await controller.cancel();
      controller.open("summary");
      await controller.cancel();
      expect(discard).not.toHaveBeenCalled();
      expect(states.every((saving) => !saving)).toBe(true);
    } finally {
      unsubscribe();
      discard.mockRestore();
    }
  });
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
  it("retries an interrupted Undo receipt once without a duplicate revision or history movement", async () => {
    const controller = await controllerOwner();
    const summary = controller.getSnapshot().head!.document.summary;
    await controller.command("summary", {
      ...summary,
      wording: { "en-US": "Saved" },
    });
    const original = CareerStorage.prototype.commit;
    const fault = vi
      .spyOn(CareerStorage.prototype, "commit")
      .mockImplementationOnce(async function (this: CareerStorage, id) {
        await original.call(this, id);
        throw new Error("Undo acknowledgment lost");
      });
    try {
      expect(await controller.history("undo")).toBe(false);
    } finally {
      fault.mockRestore();
    }
    expect(controller.getSnapshot().undoCount).toBe(1);
    await controller.refresh();
    expect(await controller.history("undo")).toBe(true);
    expect(controller.getSnapshot().head?.revision).toBe(2);
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().redoCount).toBe(1);
  });
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

  it("adds a third language without counterpart wording and preserves content across deactivation/reactivation", async () => {
    const controller = await controllerOwner();
    const head = controller.getSnapshot().head!;
    expect(
      await controller.command("languages", [
        ...head.document.languages,
        { tag: "pt-BR", active: true },
        { tag: "fr-FR", active: true },
      ]),
    ).toBe(true);
    const languages = controller.getSnapshot().head!.document.languages;
    expect(
      await controller.command("summary", {
        ...head.document.summary,
        wording: { "en-US": "English", "pt-BR": "Português" },
      }),
    ).toBe(true);
    expect(
      await controller.command(
        "languages",
        languages.map((l) => ({ ...l, active: false })),
      ),
    ).toBe(true);
    expect(controller.getSnapshot().head?.document.summary.wording).toEqual({
      "en-US": "English",
      "pt-BR": "Português",
    });
    expect(await controller.command("languages", languages)).toBe(true);
    expect(
      controller.getSnapshot().head?.document.summary.wording["fr-FR"],
    ).toBeUndefined();
    const owner = await storage();
    expect((await owner.load()).document.languages).toEqual(languages);
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
    expect(await owner.drafts()).toEqual([first]);
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

  it("prunes configured completed receipts during use and keeps coordination after maintenance failure", async () => {
    const controller = new CareerController({ completedOperationCount: 0 });
    controllers.push(controller);
    const failure = vi
      .spyOn(CareerStorage.prototype, "pruneCompleted")
      .mockRejectedValueOnce(new Error("Maintenance unavailable"));
    await controller.initialize();
    failure.mockRestore();
    expect(controller.getSnapshot().ready).toBe(true);
    expect(controller.getSnapshot().error).toMatch(/maintenance/i);
    controller.open("summary");
    controller.change({
      ...controller.getSnapshot().head!.document.summary,
      wording: { "en-US": "Saved" },
    });
    expect(await controller.save()).toBe(true);
    const owner = await storage();
    const head = await owner.load();
    const next = request(head, "profile", head.document.profile, {
      ...head.document.profile,
      fields: head.document.profile.fields.map((field, i) =>
        i ? field : { ...field, wording: { "en-US": "Another tab" } },
      ),
    });
    await owner.prepare(next);
    await owner.commit(next.id);
    await expect.poll(() => controller.getSnapshot().head?.revision).toBe(1);
    // Focus fallback remains usable even when startup maintenance failed.
    await controller.refresh();
    expect(controller.getSnapshot().head?.revision).toBe(2);
    await owner.acknowledge(next.id);
    await owner.pruneCompleted(30, 0);
    await expect(owner.commit(next.id)).rejects.toThrow(/unknown/);
  });

  it("shows recovery navigation for a reloaded unsaved creation link without opening JSON or committing", async () => {
    const controller = await controllerOwner();
    const head = controller.getSnapshot().head!;
    window.history.replaceState(
      {},
      "",
      `?scope=new-entry/${head.document.sections[0].id}/missing`,
    );
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await expect
        .element(screen.getByText("Record unavailable", { exact: true }))
        .toBeVisible();
      expect(controller.getSnapshot().draft).toBeNull();
      expect(controller.getSnapshot().head).toEqual(head);
      await expect
        .element(
          screen.getByRole("textbox", { name: "Recovered values (JSON)" }),
        )
        .not.toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("disables rich content and formatting while a Save is pending", async () => {
    const controller = await controllerOwner();
    window.history.replaceState({}, "", "?scope=summary");
    const screen = await render(<CareerWorkspace controller={controller} />);
    const original = CareerStorage.prototype.commit;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fault = vi
      .spyOn(CareerStorage.prototype, "commit")
      .mockImplementation(async function (this: CareerStorage, id) {
        await gate;
        return original.call(this, id);
      });
    try {
      await screen
        .getByRole("textbox", { name: "Summary", exact: true })
        .fill("Committed prose");
      await screen.getByRole("button", { name: "Save", exact: true }).click();
      await expect
        .element(screen.getByRole("textbox", { name: "Summary", exact: true }))
        .toHaveAttribute("contenteditable", "false");
      await expect
        .element(screen.getByRole("button", { name: /Italic/ }))
        .toBeDisabled();
      await screen
        .getByRole("textbox", { name: "Summary", exact: true })
        .element()
        .focus();
      await userEvent.keyboard("{Control>}z{/Control}");
      expect(
        (
          controller.getSnapshot().draft?.values as {
            wording: Record<string, string>;
          }
        ).wording["en-US"],
      ).toBe("Committed prose");
      release();
      await expect.poll(() => controller.getSnapshot().saving).toBe(false);
    } finally {
      release();
      fault.mockRestore();
      await screen.unmount();
    }
  });
  it("Discard in the navigation dialog removes only the draft and adds no history step", async () => {
    const controller = new CareerController();
    await page.viewport(1280, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Summary", exact: true })
        .click();
      await screen
        .getByRole("textbox", { name: "Summary" })
        .fill("Discard this draft");
      await controller.flushRecovery();
      const owner = await storage();
      expect(await owner.drafts()).toHaveLength(1);
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await expect
        .element(screen.getByRole("dialog", { name: "Unsaved form" }))
        .toBeVisible();
      await screen
        .getByRole("button", { name: "Discard", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("textbox", {
            name: "Full name",
          }),
        )
        .toBeVisible();
      expect((await owner.load()).document.summary.wording).toEqual({});
      expect(await owner.drafts()).toEqual([]);
      expect(controller.getSnapshot().undoCount).toBe(0);
      expect(controller.isDirty()).toBe(false);
    } finally {
      await screen.unmount();
    }
  });

  it("allows exactly one concurrent same-scope Save and retains the losing draft", async () => {
    const first = await storage();
    const second = await storage();
    const head = await first.load(createCareerDocument());
    const drafts = [summaryDraft(head, "First"), summaryDraft(head, "Second")];
    const requests = drafts.map((draft) =>
      request(head, draft.scope, draft.baseline, draft.values, {
        draftId: draft.draftId,
        draftVersion: draft.draftVersion,
      }),
    );
    await first.writeDraft(drafts[0]);
    await second.writeDraft(drafts[1]);
    await first.prepare(requests[0]);
    await second.prepare(requests[1]);

    const results = await Promise.allSettled([
      first.commit(requests[0].id),
      second.commit(requests[1].id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const loser = results.findIndex((result) => result.status === "rejected");
    const rejected = results[loser];
    expect(rejected.status === "rejected" && String(rejected.reason)).toContain(
      "scope changed",
    );
    const committed = await first.load();
    expect(committed.revision).toBe(1);
    expect(committed.document.summary).toEqual(drafts[1 - loser].values);
    expect(await first.drafts()).toEqual([drafts[loser]]);
  });

  it("rejects changed bytes under a prepared operation identity without altering its original Save", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const original = request(head, "summary", head.document.summary, {
      ...head.document.summary,
      wording: { "en-US": "Original" },
    });
    await owner.prepare(original);
    const changed = request(
      head,
      "summary",
      head.document.summary,
      {
        ...head.document.summary,
        wording: { "en-US": "Changed" },
      },
      { id: original.id },
    );
    await expect(owner.prepare(changed)).rejects.toThrow(
      /identity.*changed content/,
    );
    await expect(
      owner.prepare({ ...original, fingerprint: "forged" }),
    ).rejects.toThrow(/fingerprint/);
    expect(await owner.load()).toEqual(head);
    expect(
      (await owner.commit(original.id)).document.summary.wording["en-US"],
    ).toBe("Original");
    expect((await owner.commit(original.id)).revision).toBe(1);
  });

  it("rolls back the queued head write when receipt storage fails and permits the same request to retry", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const draft = summaryDraft(head);
    await owner.writeDraft(draft);
    const save = request(head, draft.scope, draft.baseline, draft.values, {
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
    });
    await owner.prepare(save);
    const original = IDBObjectStore.prototype.put;
    const fault = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore["put"]>
      ) {
        if (this.name === "operations")
          throw new DOMException("Receipt write failed", "QuotaExceededError");
        return original.apply(this, args);
      });
    try {
      await expect(owner.commit(save.id)).rejects.toThrow(
        /Receipt write failed/,
      );
    } finally {
      fault.mockRestore();
    }
    expect(await owner.load()).toEqual(head);
    expect(await owner.drafts()).toEqual([draft]);
    expect((await owner.commit(save.id)).revision).toBe(1);
    expect(await owner.drafts()).toEqual([]);
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

  it("rejects a replacement reviewed before an ordinary Save and preserves recovery across adoption and rollback", async () => {
    const owner = await storage();
    const reviewed = await owner.load(createCareerDocument());
    const draft = summaryDraft(reviewed);
    await owner.writeDraft(draft);
    const save = request(reviewed, "summary", reviewed.document.summary, {
      ...reviewed.document.summary,
      wording: { "en-US": "Saved since review" },
    });
    await owner.prepare(save);
    const current = await owner.commit(save.id);
    await expect(
      owner.replace(reviewed, createCareerDocument("pt-BR")),
    ).rejects.toThrow(/changed since review/);
    expect(await owner.load()).toEqual(current);
    expect(await owner.previous()).toBeUndefined();
    const adopted = await owner.replace(current, createCareerDocument("pt-BR"));
    expect(await owner.drafts()).toEqual([draft]);
    const restored = await owner.replace(adopted);
    expect(restored.document).toEqual(current.document);
    expect(restored.generation).toBe(2);
    expect(await owner.drafts()).toEqual([draft]);
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
    expect(await owner.drafts()).toEqual([controller.getSnapshot().draft]);
    expect(controller.getSnapshot().undoCount).toBe(1);
    expect(await controller.save()).toBe(true);
    expect((await owner.load()).document.summary).toEqual(newer);
    expect(controller.getSnapshot().undoCount).toBe(2);
    expect(await owner.drafts()).toEqual([]);
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
      .spyOn(CareerStorage.prototype, "discardDraft")
      .mockRejectedValue(new Error("Cleanup unavailable"));
    try {
      await expect(controller.cancel()).rejects.toThrow(/Cleanup unavailable/);
    } finally {
      fault.mockRestore();
    }
    expect(controller.getSnapshot().draft).toEqual(draft);
    expect(await owner.drafts()).toEqual([draft]);
    expect(await owner.load()).toEqual(head);
    expect(controller.getSnapshot().undoCount).toBe(0);
    await controller.cancel();
    expect(controller.getSnapshot().draft).toBeNull();
    expect(await owner.drafts()).toEqual([]);
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
  it("preserves unrelated saves, rejects same-scope conflicts, and reuses receipts", async () => {
    const first = await storage();
    const second = await storage();
    const head = await first.load(createCareerDocument());
    const summary = { ...head.document.summary, wording: { "en-US": "First" } };
    const saveSummary = request(
      head,
      "summary",
      head.document.summary,
      summary,
    );
    const profile = structuredClone(head.document.profile);
    profile.fields[0].wording["en-US"] = "Person";
    const saveProfile = request(
      head,
      "profile",
      head.document.profile,
      profile,
    );
    await first.prepare(saveSummary);
    await second.prepare(saveProfile);
    await first.commit(saveSummary.id);
    const result = await second.commit(saveProfile.id);
    expect(result.revision).toBe(2);
    expect(result.document.summary.wording["en-US"]).toBe("First");
    expect(result.document.profile.fields[0].wording["en-US"]).toBe("Person");
    await first.commit(saveSummary.id);
    expect((await first.load()).revision).toBe(2);
    const conflict = request(head, "summary", head.document.summary, {
      ...summary,
      wording: { "en-US": "Stale" },
    });
    await first.prepare(conflict);
    await expect(first.commit(conflict.id)).rejects.toThrow(/scope changed/);
    expect((await first.load()).document.summary.wording["en-US"]).toBe(
      "First",
    );
    await expect(
      first.prepare({ ...saveSummary, fingerprint: "different" }),
    ).rejects.toThrow(/fingerprint/);
    await expect(first.commit("missing-operation")).rejects.toThrow(/unknown/);
  });

  it("atomically preserves one previous workspace, swaps rollback, and rejects stale generations", async () => {
    const owner = await storage();
    const initial = await owner.load(createCareerDocument());
    const next = createCareerDocument("pt-BR");
    next.summary.wording["pt-BR"] = "Novo";
    const stale = request(initial, "summary", initial.document.summary, {
      ...initial.document.summary,
      wording: { "en-US": "Late" },
    });
    await owner.prepare(stale);
    const replacement = await owner.replace(initial, next);
    expect(replacement.generation).toBe(1);
    expect((await owner.previous())?.document).toEqual(initial.document);
    await expect(owner.commit(stale.id)).rejects.toThrow(/replaced/);
    await expect(owner.replace(initial, initial.document)).rejects.toThrow(
      /changed since review/,
    );
    const rollback = await owner.replace(replacement);
    expect(rollback.document).toEqual(initial.document);
    expect((await owner.previous())?.document).toEqual(next);
    const returnAgain = await owner.replace(rollback);
    expect(returnAgain.document).toEqual(next);
    owner.close();
    const reopened = await storage();
    expect((await reopened.previous())?.document).toEqual(initial.document);
  });

  it("aborts both workspace/snapshot writes if preservation fails", async () => {
    const owner = await storage();
    const initial = await owner.load(createCareerDocument());
    const first = await owner.replace(initial, createCareerDocument("pt-BR"));
    const previous = await owner.previous();
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "previous")
        throw new DOMException(
          "Test preservation failure",
          "QuotaExceededError",
        );
      return originalPut.apply(this, args);
    };
    try {
      await expect(owner.replace(first, initial.document)).rejects.toThrow(
        /preservation failure/,
      );
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    expect(await owner.load()).toEqual(first);
    expect(await owner.previous()).toEqual(previous);
  });

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

  it("aborts a rejected Save without a receipt, committed change, or recovery removal", async () => {
    const owner = await storage();
    const head = await owner.load(createCareerDocument());
    const values = structuredClone(head.document.profile);
    values.fields[1].fact = "invalid email";
    const draft = {
      draftId: "draft",
      draftVersion: 1,
      workspaceId: head.workspaceId,
      scope: "profile",
      baseline: head.document.profile,
      baselineRevision: 0,
      generation: 0,
      values,
    };
    await owner.writeDraft(draft);
    const save = request(head, "profile", head.document.profile, values, {
      draftId: "draft",
      draftVersion: 1,
    });
    await owner.prepare(save);
    await expect(owner.commit(save.id)).rejects.toThrow();
    expect(await owner.load()).toEqual(head);
    expect(await owner.drafts()).toHaveLength(1);
  });
});

describe("career editing boundaries", () => {
  it("retries an interrupted acknowledgment with the same operation ID and one history step", async () => {
    const controller = new CareerController();
    controllers.push(controller);
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
    controllers.push(controller);
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

  it("Undo of creation archives and Redo restores the same identities without duplicate creation", async () => {
    const controller = new CareerController();
    controllers.push(controller);
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

  it("explicit session-only Save leaves the durable workspace untouched", async () => {
    const controller = new CareerController();
    controllers.push(controller);
    await controller.initialize();
    const head = controller.getSnapshot().head!;
    controller.open("summary");
    controller.change({
      ...head.document.summary,
      wording: { "en-US": "Memory only" },
    });
    expect(await controller.save(true)).toBe(true);
    const owner = await storage();
    expect((await owner.load()).revision).toBe(0);
    expect(controller.getSnapshot().status).toContain("tab only");
    expect(
      controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("Memory only");
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
        .element(screen.getByRole("region", { name: "Unresolved recovery" }))
        .not.toBeInTheDocument();
      await screen
        .getByRole("button", { name: "Data & backups", exact: true })
        .click();
      await expect
        .element(screen.getByRole("region", { name: "Unresolved recovery" }))
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
  it("keeps typing/recovery separate, creates one Save history step, and Cancel creates none", async () => {
    const controller = new CareerController();
    controllers.push(controller);
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

  it("restores recovery without commit and retains conflicting versions until explicit reconciliation", async () => {
    const controller = new CareerController();
    controllers.push(controller);
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

  it("retains the original career cards and grouped forms at desktop and narrow widths", async () => {
    const controller = new CareerController();
    await page.viewport(1440, 900);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await expect
        .element(
          screen.getByRole("heading", {
            name: "Career details · Overview",
            level: 1,
          }),
        )
        .toBeVisible();
      await expect
        .element(screen.getByRole("heading", { name: "Profile", level: 2 }))
        .toBeVisible();
      await expect
        .element(screen.getByRole("heading", { name: "Summary", level: 2 }))
        .toBeVisible();
      await screen
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("button", { name: "Add section", exact: true })
        .click();
      const dialog = screen.getByRole("dialog", {
        name: "Add section",
        exact: true,
      });
      await dialog
        .getByRole("button", { name: "Create section", exact: true })
        .click();
      expect(controller.getSnapshot().head!.document.sections).toHaveLength(5);
      await screen
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect
        .poll(() => controller.getSnapshot().head!.document.sections.length)
        .toBe(6);
      await screen
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("heading", { name: "Your profile", level: 2 }),
        )
        .toBeVisible();
      const name = screen.getByRole("textbox", {
        name: "Full name",
      });
      await name.fill("Example Name");
      expect(
        controller.getSnapshot().head!.document.profile.fields[0].wording,
      ).toEqual({});
      await page.viewport(390, 844);
      await expect.element(name).toBeVisible();
      const input = name.element();
      if (!(input instanceof HTMLInputElement))
        throw new Error("Expected a profile text input.");
      const label = input.labels?.[0];
      expect(label!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        name.element().getBoundingClientRect().top,
      );
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        window.innerWidth,
      );
      await screen
        .getByRole("region", { name: "Editing form" })
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      expect(
        controller.getSnapshot().head!.document.profile.fields[0].wording,
      ).toEqual({});
    } finally {
      await screen.unmount();
    }
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
    expect(await owner.drafts()).toEqual([entryDraft]);
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

  it("keeps a conflicting order recoverable while an independent entry Save succeeds", async () => {
    const controller = await controllerOwner();
    const owner = await storage();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta", "Gamma"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    const head = controller.getSnapshot().head!;
    const [alpha, beta, gamma] = head.document.sections[0].entries;
    controller.open(`entry/${alpha.id}`);
    controller.change({ ...alpha, name: "Edited Alpha" });
    controller.open(`entries/${section.id}`, "order");
    controller.change([beta.id, alpha.id, gamma.id], "order");
    const baseline = [alpha.id, beta.id, gamma.id];
    const competing = request(head, `entries/${section.id}`, baseline, [
      alpha.id,
      gamma.id,
      beta.id,
    ]);
    await owner.prepare(competing);
    await owner.commit(competing.id);
    await controller.refresh();
    expect(controller.getSnapshot().error).toBe("");
    expect(controller.getSnapshot().orderError).not.toBe("");
    expect(await controller.save(false, "order")).toBe(false);
    const retained = controller.getSnapshot().orderDraft;
    expect(await controller.save()).toBe(true);
    expect(controller.getSnapshot().orderDraft).toEqual(retained);
    expect(
      (await owner.load()).document.sections[0].entries.map(
        (entry) => entry.id,
      ),
    ).toEqual([alpha.id, gamma.id, beta.id]);
    expect((await owner.load()).document.sections[0].entries[0].name).toBe(
      "Edited Alpha",
    );
    expect(await owner.drafts()).toEqual([retained]);
    expect(controller.navigationTargets("backups")).toEqual([]);
    await controller.cancel("order");
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
      .spyOn(CareerStorage.prototype, "discardDraft")
      .mockRejectedValueOnce(new Error("Cleanup unavailable"));
    try {
      await expect(controller.cancel("order")).rejects.toThrow(
        /Cleanup unavailable/,
      );
    } finally {
      fault.mockRestore();
    }
    expect(controller.getSnapshot().draft).toEqual(entryDraft);
    expect(controller.getSnapshot().orderDraft).toEqual(orderDraft);
    expect(await owner.drafts()).toEqual(
      expect.arrayContaining([entryDraft, orderDraft]),
    );
    controller.dispose();
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
    expect(await owner.drafts()).toEqual([entryDraft]);
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

  it("keeps entry and order drafts independently editable, recoverable, saved, and canceled", async () => {
    const controller = await controllerOwner();
    await page.viewport(1280, 900);
    const owner = await storage();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    const before = controller
      .getSnapshot()
      .head!.document.sections[0].entries.map((entry) => entry.id);
    const undoCount = controller.getSnapshot().undoCount;
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Edit Alpha", exact: true })
        .click();
      await screen
        .getByRole("textbox", { name: "Internal name", exact: true })
        .fill("Saved Alpha");
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      await expect
        .element(screen.getByRole("dialog", { name: "Unsaved form" }))
        .not.toBeInTheDocument();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Internal name", exact: true }),
        )
        .toHaveValue("Saved Alpha");
      expect(controller.getSnapshot().draft!.scope).toBe(`entry/${before[0]}`);
      await expect
        .poll(() => controller.getSnapshot().orderDraft?.values)
        .toEqual([before[1], before[0]]);
      await expect
        .element(
          screen.getByRole("button", { name: "Compare order", exact: true }),
        )
        .not.toBeInTheDocument();
      await expect
        .element(screen.getByRole("region", { name: "Unresolved recovery" }))
        .not.toBeInTheDocument();

      await expect
        .element(
          screen
            .getByRole("region", { name: "Career entries" })
            .getByRole("button", { name: "Alpha", exact: true }),
        )
        .toHaveAttribute("aria-current", "true");
      await controller.flushRecovery();
      expect(await owner.drafts()).toHaveLength(2);
      const editingDraft = controller.getSnapshot().draft;
      const editingOrder = controller.getSnapshot().orderDraft;
      await screen
        .getByRole("button", { name: "Data & backups", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("heading", { name: "Data & backups", exact: true }),
        )
        .toBeVisible();
      expect(controller.getSnapshot().draft).toEqual(editingDraft);
      expect(controller.getSnapshot().orderDraft).toEqual(editingOrder);
      await screen
        .getByRole("button", { name: "Back to editing", exact: true })
        .click();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Internal name", exact: true }),
        )
        .toHaveValue("Saved Alpha");

      await screen
        .getByRole("button", { name: "Cancel order", exact: true })
        .click();
      await expect.poll(() => controller.getSnapshot().orderDraft).toBeNull();
      expect(controller.getSnapshot().draft!.values).toMatchObject({
        name: "Saved Alpha",
      });
      expect(await owner.drafts()).toHaveLength(1);
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      const order = controller.getSnapshot().orderDraft;
      await screen
        .getByRole("button", { name: "Save entry", exact: true })
        .click();
      await expect
        .poll(
          () =>
            controller.getSnapshot().head!.document.sections[0].entries[0].name,
        )
        .toBe("Saved Alpha");
      expect(controller.getSnapshot().orderDraft).toEqual(order);
      expect(
        controller
          .getSnapshot()
          .head!.document.sections[0].entries.map((entry) => entry.id),
      ).toEqual(before);
      expect(controller.getSnapshot().undoCount).toBe(undoCount + 1);
      await screen
        .getByRole("button", { name: "Edit Beta", exact: true })
        .click();
      await expect
        .element(screen.getByRole("dialog", { name: "Unsaved entry order" }))
        .not.toBeInTheDocument();
      await screen
        .getByRole("textbox", { name: "Internal name", exact: true })
        .fill("Canceled Beta");
      await screen
        .getByRole("button", { name: "Cancel entry", exact: true })
        .click();
      await expect.poll(() => controller.getSnapshot().draft).toBeNull();
      expect(controller.getSnapshot().orderDraft).toEqual(order);
      await screen
        .getByRole("button", { name: "Save order", exact: true })
        .click();
      await expect.poll(() => controller.getSnapshot().orderDraft).toBeNull();
      expect(
        controller
          .getSnapshot()
          .head!.document.sections[0].entries.map((entry) => entry.id),
      ).toEqual([before[1], before[0]]);
      expect(
        controller.getSnapshot().head!.document.sections[0].entries[0].name,
      ).toBe("Beta");
      expect(controller.getSnapshot().undoCount).toBe(undoCount + 2);
      await expect.poll(() => controller.getSnapshot().saving).toBe(false);
      expect(await owner.drafts()).toEqual([]);
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

  it("preserves pending order through Back and Forward and guards only a dirty entry", async () => {
    const controller = await controllerOwner();
    const section = controller.getSnapshot().head!.document.sections[0];
    for (const name of ["Alpha", "Beta"]) {
      const entry = { ...createEntry("experience"), name };
      await controller.command(`new-entry/${section.id}/${entry.id}`, entry);
    }
    window.history.replaceState({}, "", `?scope=list/${section.id}`);
    const screen = await render(<CareerWorkspace controller={controller} />);
    try {
      await screen
        .getByRole("button", { name: "Move Beta up", exact: true })
        .click();
      const order = controller.getSnapshot().orderDraft;
      await screen
        .getByRole("button", { name: "Edit Alpha", exact: true })
        .click();
      window.history.back();
      await expect.poll(() => controller.getSnapshot().draft).toBeNull();
      expect(controller.getSnapshot().orderDraft).toEqual(order);
      window.history.forward();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Internal name", exact: true }),
        )
        .toHaveValue("Alpha");
      expect(controller.getSnapshot().orderDraft).toEqual(order);
      await screen
        .getByRole("textbox", { name: "Internal name", exact: true })
        .fill("Unsaved Alpha");
      window.history.back();
      const dialog = screen.getByRole("dialog", {
        name: "Unsaved form",
        exact: true,
      });
      await expect.element(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect
        .element(
          screen.getByRole("textbox", { name: "Internal name", exact: true }),
        )
        .toHaveValue("Unsaved Alpha");
      window.history.back();
      await dialog
        .getByRole("button", { name: "Discard", exact: true })
        .click();
      await expect.poll(() => controller.getSnapshot().draft).toBeNull();
      expect(controller.getSnapshot().orderDraft).toEqual(order);
      await expect
        .element(
          screen.getByRole("dialog", {
            name: "Unsaved entry order",
            exact: true,
          }),
        )
        .not.toBeInTheDocument();
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

describe("custom-section icon properties", () => {
  it("keeps picker changes in the properties draft until Save and restores committed icons on Cancel", async () => {
    const owner = await storage();
    const document = createCareerDocument();
    document.sections.push({
      id: "custom-icon",
      kind: "custom",
      icon: "file-text",
      name: "Research",
      heading: {},
      archived: false,
      entries: [],
    });
    await owner.load(document);
    const controller = await controllerOwner();
    window.history.replaceState({}, "", "?scope=section/custom-icon");
    const screen = await render(<CareerWorkspace controller={controller} />);
    await screen
      .getByRole("button", { name: "Choose section icon", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Section icon", exact: true })
      .getByRole("button", { name: "Research", exact: true, pressed: false })
      .click();
    expect(controller.getSnapshot().draft?.values).toMatchObject({
      icon: "flask-conical",
    });
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "file-text",
    );
    await userEvent.keyboard("{Escape}");
    await expect
      .element(
        screen.getByRole("button", {
          name: "Choose section icon",
          exact: true,
        }),
      )
      .toHaveFocus();
    await screen.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(controller.getSnapshot().head!.document.sections.at(-1)?.icon).toBe(
      "file-text",
    );
    // Cancel finishes by navigating back to the list. Reopen properties through
    // that settled destination so its pending cleanup cannot cancel a new draft.
    await expect
      .element(
        screen.getByRole("searchbox", { name: "Search entries", exact: true }),
      )
      .toBeVisible();
    await screen
      .getByRole("button", { name: "Section actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Edit section properties", exact: true })
      .click();
    await screen
      .getByRole("button", { name: "Choose section icon", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Section icon", exact: true })
      .getByRole("button", { name: "Research", exact: true, pressed: false })
      .click();
    await userEvent.keyboard("{Escape}");
    await screen.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() => controller.getSnapshot().head!.document.sections.at(-1)?.icon)
      .toBe("flask-conical");
    expect((await owner.load()).document.sections.at(-1)?.icon).toBe(
      "flask-conical",
    );
    await screen.unmount();
  });

  it("retains icon recovery, retries one receipt, and rotates icons through replacement and rollback", async () => {
    const owner = await storage();
    const document = createCareerDocument();
    document.sections.push({
      id: "custom-icon",
      kind: "custom",
      icon: "heart-handshake",
      name: "Service",
      heading: {},
      archived: false,
      entries: [],
    });
    const head = await owner.load(document);
    const scope = "section/custom-icon";
    const baseline = readScope(head.document, scope) as object;
    const values = { ...baseline, icon: "rocket" };
    const draft: CareerDraft = {
      draftId: "icon-draft",
      draftVersion: 1,
      workspaceId: head.workspaceId,
      generation: head.generation,
      baselineRevision: head.revision,
      scope,
      baseline,
      values,
    };
    await owner.writeDraft(draft);
    expect((await owner.drafts())[0].values).toEqual(values);
    const save = request(head, scope, baseline, values, {
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
    });
    await owner.prepare(save);
    const committed = await owner.commit(save.id);
    const retried = await owner.commit(save.id);
    expect(retried.revision).toBe(committed.revision);
    expect(retried.document.sections.at(-1)?.icon).toBe("rocket");
    expect(await owner.drafts()).toEqual([]);
    const incoming = structuredClone(committed.document);
    incoming.sections.at(-1)!.icon = "flask-conical";
    const replaced = await owner.replace(committed, incoming);
    expect(replaced.document.sections.at(-1)?.icon).toBe("flask-conical");
    const rolledBack = await owner.replace(replaced);
    expect(rolledBack.document.sections.at(-1)?.icon).toBe("rocket");
    expect((await owner.previous())?.document.sections.at(-1)?.icon).toBe(
      "flask-conical",
    );
    const invalid = structuredClone(rolledBack.document);
    Object.assign(invalid.sections.at(-1)!, { icon: "unknown-icon" });
    const previous = await owner.previous();
    await expect(owner.replace(rolledBack, invalid)).rejects.toThrow();
    expect(await owner.load()).toEqual(rolledBack);
    expect(await owner.previous()).toEqual(previous);
  });
});
