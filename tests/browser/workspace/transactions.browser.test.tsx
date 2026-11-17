import { describe, expect, it, vi } from "vitest";

import { createCareerDocument } from "@/lib/career/model";
import {
  request,
  setupCareerTests,
  storage,
  summaryDraft,
} from "@/tests/support/browser/career";

setupCareerTests();

describe("Save and recovery", () => {
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
