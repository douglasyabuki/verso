import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commitScopeRequest,
  type CommittedHead,
  replaceHead,
  resetHead,
} from "@/lib/career/commit";
import { draftConflict } from "@/lib/career/conflict";
import { createCareerDocument } from "@/lib/career/model";
import { openAccountBackend } from "@/stores/career/account-backend";
import { CareerController } from "@/stores/career/controller";
import { CareerStorage, openCareerStorage } from "@/stores/career/persistence";
import {
  ACCOUNT_ROUTES,
  ACCOUNT_SESSION_HEADER,
} from "@/types-and-constants/account";

type Receipt = { hash: string; revision: number; generation: number };

/** Server receipt hash: hex SHA-256 of the request fingerprint. */
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** In-memory stand-in for the account API using the server's pure commit rules.
 * It proves client behavior only; real database atomicity is covered by db tests. */
function fakeServer(sessionId: string) {
  let head: CommittedHead = {
    workspaceId: crypto.randomUUID(),
    revision: 0,
    generation: 0,
    document: createCareerDocument(),
  };
  let previous: CommittedHead | null = null;
  const receipts = new Map<string, Receipt>();
  /** Deletion receipts and cancellation tombstones, by operation ID. */
  const resets = new Map<
    string,
    { kind: "reset" | "reset-cancelled"; hash: string }
  >();
  const resetHash = (reviewed: Record<string, unknown>) =>
    sha256(
      JSON.stringify([
        "reset",
        reviewed.workspaceId,
        reviewed.revision,
        reviewed.generation,
      ]),
    );
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  const state = {
    offline: false,
    dropResponse: false,
    /** Lose the next deletion request before it reaches the server. */
    loseResetRequest: false,
    /** Commit the next deletion, then lose its response. */
    dropResetResponse: false,
    /** After a dropped deletion response, stay unreachable. */
    offlineAfterReset: false,
    expired: false,
    commits: 0,
    resets: 0,
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    calls.push({ path, body });
    if (state.offline) throw new TypeError("Failed to fetch");
    const headers = new Headers(init?.headers);
    if (state.expired)
      return json({ code: "unauthorized", message: "Sign in again." }, 401);
    if (headers.get(ACCOUNT_SESSION_HEADER) !== sessionId)
      return json({ code: "session_mismatch", message: "Mismatch." }, 403);
    if (path === ACCOUNT_ROUTES.workspace) return json(head);
    if (path.startsWith(`${ACCOUNT_ROUTES.workspace}?`)) {
      const query = new URLSearchParams(path.split("?")[1]);
      return query.get("workspaceId") === head.workspaceId &&
        Number(query.get("revision")) === head.revision &&
        Number(query.get("generation")) === head.generation
        ? json({
            unchanged: true,
            workspaceId: head.workspaceId,
            revision: head.revision,
            generation: head.generation,
          })
        : json(head);
    }
    if (path.startsWith(`${ACCOUNT_ROUTES.operations}/`)) {
      const reset = resets.get(path.split("/").pop()!);
      if (reset)
        return json({
          status: "committed",
          kind: reset.kind,
          requestHash: reset.hash,
          result: { revision: head.revision, generation: head.generation },
        });
      const receipt = receipts.get(path.split("/").pop()!);
      return json(
        receipt
          ? {
              status: "committed",
              kind: "save",
              requestHash: await sha256(receipt.hash),
              result: {
                revision: receipt.revision,
                generation: receipt.generation,
              },
            }
          : { status: "unknown" },
      );
    }
    if (path === ACCOUNT_ROUTES.previous) return json(previous);
    if (path === ACCOUNT_ROUTES.reset && body) {
      const id = String(body.operationId);
      const reviewed = body.reviewed as Record<string, unknown>;
      const hash = await resetHash(reviewed);
      const receipt = resets.get(id);
      if (init?.method === "PATCH") {
        if (receipt?.kind === "reset") return json({ deleted: true, head });
        resets.set(id, { kind: "reset-cancelled", hash });
        return json({ deleted: false });
      }
      if (state.loseResetRequest) {
        state.loseResetRequest = false;
        throw new TypeError("Request lost before reaching the server");
      }
      if (receipt?.kind === "reset-cancelled")
        return json({ code: "deletion_cancelled", message: "Cancelled." }, 409);
      if (!receipt) {
        const decision = resetHead(
          head,
          reviewed as never,
          createCareerDocument(),
          crypto.randomUUID(),
        );
        if (!decision.ok)
          return json(
            { code: decision.reason, message: decision.message },
            409,
          );
        head = decision.head;
        previous = null;
        receipts.clear();
        resets.clear();
        resets.set(id, { kind: "reset", hash });
        state.resets++;
      }
      if (state.dropResetResponse) {
        state.dropResetResponse = false;
        if (state.offlineAfterReset) state.offline = true;
        throw new TypeError("Connection reset after deletion");
      }
      return json(head);
    }
    if (path === ACCOUNT_ROUTES.operations && body) {
      const hash = String(body.fingerprint);
      const receipt = receipts.get(String(body.id));
      let response: unknown;
      if (receipt) {
        if (receipt.hash !== hash)
          return json({ code: "operation_mismatch", message: "Reused." }, 409);
        response = {
          ...receipt,
          workspaceId: head.workspaceId,
          replayed: true,
        };
      } else {
        const decision = commitScopeRequest(head, body as never);
        if (!decision.ok)
          return json(
            { code: decision.reason, message: decision.message },
            409,
          );
        const stale = body.knownRevision !== head.revision;
        head = decision.head;
        state.commits++;
        receipts.set(String(body.id), {
          hash,
          revision: head.revision,
          generation: head.generation,
        });
        response = {
          workspaceId: head.workspaceId,
          revision: head.revision,
          generation: head.generation,
          replayed: false,
          ...(stale ? { document: head.document } : {}),
        };
      }
      if (state.dropResponse) {
        state.dropResponse = false;
        throw new TypeError("Connection reset after commit");
      }
      return json(response);
    }
    if (path === ACCOUNT_ROUTES.replace && body) {
      const decision = replaceHead(
        head,
        body.reviewed as CommittedHead,
        (body.document as CommittedHead["document"]) ?? previous!.document,
      );
      if (!decision.ok)
        return json({ code: decision.reason, message: decision.message }, 409);
      previous = head;
      head = decision.head;
      return json(head);
    }
    return json({ code: "not_found", message: "Unknown route." }, 404);
  });
  return {
    fetch,
    state,
    calls,
    get head() {
      return head;
    },
    /** Another device deletes the workspace data. */
    resetElsewhere() {
      const decision = resetHead(
        head,
        head,
        createCareerDocument(),
        crypto.randomUUID(),
      );
      if (decision.ok) head = decision.head;
      receipts.clear();
      resets.clear();
    },
    commitElsewhere(wording: string) {
      const decision = commitScopeRequest(head, {
        workspaceId: head.workspaceId,
        generation: head.generation,
        scope: "summary",
        baseline: head.document.summary,
        values: { ...head.document.summary, wording: { "en-US": wording } },
      });
      if (decision.ok) head = decision.head;
    },
  };
}

const controllers: CareerController[] = [];
const databases = new Set<string>();

async function deleteDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  await new Promise((resolve) => setTimeout(resolve, 50));
  for (const name of databases) await deleteDatabase(name);
  databases.clear();
  await deleteDatabase("verso-local");
});

async function accountController(
  server: ReturnType<typeof fakeServer>,
  identity = { userId: crypto.randomUUID(), sessionId: "session-1" },
  onSessionInvalid = vi.fn(),
) {
  databases.add(`verso-account-${identity.userId}`);
  const controller = new CareerController({
    owner: "account",
    openBackend: () =>
      openAccountBackend(identity, {
        fetch: server.fetch as typeof fetch,
        onSessionInvalid,
      }),
  });
  controllers.push(controller);
  await controller.initialize();
  return { controller, identity, onSessionInvalid };
}

function editSummary(controller: CareerController, wording: string) {
  const head = controller.getSnapshot().head!;
  controller.open("summary");
  controller.change({
    ...head.document.summary,
    wording: { "en-US": wording },
  });
}

describe("account Saves", () => {
  it("confirms a Save only after server acknowledgment and reports account status", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    expect(controller.getSnapshot()).toMatchObject({
      storageMode: "account",
      status: "Saved to account · revision 0",
    });
    editSummary(controller, "Account summary");
    expect(await controller.save()).toBe(true);
    expect(server.state.commits).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      draft: null,
      status: "Saved to account · revision 1",
    });
    expect(
      controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("Account summary");
  });

  it("replays the receipt when the acknowledgment was lost, without a second commit", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    editSummary(controller, "Lost acknowledgment");
    server.state.dropResponse = true;
    expect(await controller.save()).toBe(false);
    expect(server.state.commits).toBe(1);
    expect(controller.getSnapshot().head!.revision).toBe(0);

    expect(await controller.save()).toBe(true);
    expect(server.state.commits).toBe(1);
    expect(controller.getSnapshot().head!.revision).toBe(1);
    expect(controller.getSnapshot().draft).toBeNull();
  });

  it("adopts the server document when another device committed an unrelated change", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    server.commitElsewhere("From another device");
    controller.open("sections");
    controller.change(
      [...controller.getSnapshot().head!.document.sections]
        .map((section) => section.id)
        .reverse(),
    );
    expect(await controller.save()).toBe(true);
    const head = controller.getSnapshot().head!;
    expect(head.revision).toBe(2);
    expect(head.document.summary.wording["en-US"]).toBe("From another device");
  });

  it("reports an expired session, keeps the draft, and notifies the owner boundary", async () => {
    const server = fakeServer("session-1");
    const { controller, onSessionInvalid } = await accountController(server);
    editSummary(controller, "Needs sign-in");
    server.state.expired = true;
    expect(await controller.save()).toBe(false);
    expect(onSessionInvalid).toHaveBeenCalledWith("unauthorized");
    expect(controller.getSnapshot()).toMatchObject({
      saveStatus: { kind: "failed", reason: "session" },
      draft: { scope: "summary" },
    });
    expect(server.state.commits).toBe(0);
  });

  it("isolates recovery per account and from the guest database", async () => {
    const server = fakeServer("session-1");
    const first = await accountController(server);
    editSummary(first.controller, "Private draft");
    await first.controller.flushRecovery();
    first.controller.dispose();
    controllers.splice(controllers.indexOf(first.controller), 1);

    const other = await accountController(server, {
      userId: crypto.randomUUID(),
      sessionId: "session-1",
    });
    expect(other.controller.getSnapshot().recovery).toEqual([]);

    const guest = new CareerController();
    controllers.push(guest);
    await guest.initialize();
    expect(guest.getSnapshot().recovery).toEqual([]);

    const again = await accountController(server, first.identity);
    expect(again.controller.getSnapshot().recovery).toMatchObject([
      { scope: "summary" },
    ]);
  });
});

describe("account sync", () => {
  it("checks freshness conditionally and labels changes from another device", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    expect(await controller.refresh("remote")).toBe(true);
    expect(server.calls.at(-1)?.path).toContain("?workspaceId=");
    expect(controller.getSnapshot().head!.revision).toBe(0);

    server.commitElsewhere("From another device");
    expect(await controller.refresh("remote")).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      saveStatus: { kind: "remote-update", revision: 1 },
      status: "Updated from another device or tab · revision 1",
    });
    expect(
      controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("From another device");
  });

  it("confirms an interrupted Save through operation status on reconnect without resending it", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    editSummary(controller, "Committed but unacknowledged");
    server.state.dropResponse = true;
    expect(await controller.save()).toBe(false);
    const sends = () =>
      server.calls.filter((call) => call.path === ACCOUNT_ROUTES.operations)
        .length;
    expect(sends()).toBe(1);

    await controller.sync("online");
    expect(sends()).toBe(1);
    expect(server.state.commits).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      draft: null,
      saveStatus: { kind: "saved", revision: 1 },
    });
    expect(controller.getSnapshot().recovery).toEqual([]);
  });

  it("keeps an unconfirmed offline Save pending for an explicit retry", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    editSummary(controller, "Written offline");
    server.state.offline = true;
    expect(await controller.save()).toBe(false);
    const operationId = controller.getSnapshot().draft?.operationId;

    server.state.offline = false;
    await controller.sync("online");
    expect(server.state.commits).toBe(0);
    expect(controller.getSnapshot().draft).toMatchObject({ operationId });

    expect(await controller.save()).toBe(true);
    expect(server.state.commits).toBe(1);
  });

  it("opens the last confirmed head offline and clears the stale notice once reachable", async () => {
    const server = fakeServer("session-1");
    const first = await accountController(server);
    editSummary(first.controller, "Cached content");
    expect(await first.controller.save()).toBe(true);
    first.controller.dispose();
    controllers.splice(controllers.indexOf(first.controller), 1);

    server.state.offline = true;
    const again = await accountController(server, first.identity);
    expect(again.controller.getSnapshot()).toMatchObject({
      storageMode: "account",
      saveStatus: { kind: "offline-cached", revision: 1 },
    });
    expect(
      again.controller.getSnapshot().head!.document.summary.wording["en-US"],
    ).toBe("Cached content");

    server.state.offline = false;
    expect(await again.controller.refresh("remote")).toBe(true);
    expect(again.controller.getSnapshot().saveStatus).toEqual({
      kind: "saved",
      revision: 1,
    });
  });

  it("retains both versions after a same-scope conflict from another device", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    editSummary(controller, "Mine");
    server.commitElsewhere("Theirs");
    expect(await controller.save()).toBe(false);
    expect(controller.getSnapshot().saveStatus).toEqual({
      kind: "failed",
      reason: "conflict",
    });
    await expect.poll(() => controller.getSnapshot().head?.revision).toBe(1);
    const { head, draft } = controller.getSnapshot();
    expect(draftConflict(head!, draft!)).toMatchObject({
      saved: { wording: { "en-US": "Theirs" } },
      draft: { wording: { "en-US": "Mine" } },
      revision: 1,
    });

    expect(controller.reconcile()).toBe(true);
    expect(
      draftConflict(
        controller.getSnapshot().head!,
        controller.getSnapshot().draft!,
      ),
    ).toBeNull();
    expect(await controller.save()).toBe(true);
    expect(server.head.document.summary.wording["en-US"]).toBe("Mine");
  });
});

describe("account workspace data deletion", () => {
  const identityOf = (head: CommittedHead) => ({
    workspaceId: head.workspaceId,
    revision: head.revision,
    generation: head.generation,
  });

  async function rawDrafts(name: string) {
    const storage = await openCareerStorage(name);
    try {
      return await storage.drafts();
    } finally {
      storage.close();
    }
  }

  it("deletes on the server, clears only this account's local copy, and keeps the guest workspace", async () => {
    const guest = await openCareerStorage();
    const guestHead = await guest.load(createCareerDocument());
    await guest.writeDraft({
      draftId: crypto.randomUUID(),
      draftVersion: 1,
      workspaceId: guestHead.workspaceId,
      generation: 0,
      baselineRevision: 0,
      scope: "summary",
      baseline: guestHead.document.summary,
      values: guestHead.document.summary,
    });
    guest.close();
    const server = fakeServer("session-1");
    const { controller, identity } = await accountController(server);
    editSummary(controller, "Unsaved account draft");
    await controller.flushRecovery();
    const reviewed = controller.getSnapshot().head!;

    const result = await controller.deleteWorkspaceData(reviewed);
    expect(result).toEqual({
      ok: true,
      by: "this-request",
      cleanup: "complete",
    });
    expect(server.state.resets).toBe(1);
    const fresh = controller.getSnapshot();
    expect(fresh.head!.workspaceId).toBe(server.head.workspaceId);
    expect(fresh.head!.workspaceId).not.toBe(reviewed.workspaceId);
    expect(fresh).toMatchObject({ draft: null, recovery: [] });
    expect(await rawDrafts(`verso-account-${identity.userId}`)).toEqual([]);
    expect(await rawDrafts("verso-local")).toHaveLength(1);
    const local = await openCareerStorage(`verso-account-${identity.userId}`);
    expect((await local.cachedAccountHead())?.workspaceId).toBe(
      server.head.workspaceId,
    );
    expect(await local.resetMarkers()).toEqual([]);
    local.close();
  });

  it("resolves a lost response from the receipt and never deletes the fresh workspace afterwards", async () => {
    const server = fakeServer("session-1");
    const { controller, identity } = await accountController(server);
    const reviewed = controller.getSnapshot().head!;
    server.state.dropResetResponse = true;
    const result = await controller.deleteWorkspaceData(reviewed);
    expect(result).toMatchObject({ ok: true, by: "this-request" });
    const fresh = server.head;
    editSummary(controller, "New work");
    expect(await controller.save()).toBe(true);
    // A reload finds no remaining attempt and sends no further deletion.
    controller.dispose();
    controllers.splice(controllers.indexOf(controller), 1);
    const reopened = await accountController(server, identity);
    expect(reopened.controller.getSnapshot().head!.workspaceId).toBe(
      fresh.workspaceId,
    );
    expect(reopened.controller.getSnapshot().workspaceDeletion).toBeNull();
    expect(server.state.resets).toBe(1);
    expect(server.head.document.summary.wording["en-US"]).toBe("New work");
  });

  it("keeps an undelivered deletion pending until the server cancels it", async () => {
    const server = fakeServer("session-1");
    const { controller, identity } = await accountController(server);
    editSummary(controller, "Kept draft");
    const reviewed = controller.getSnapshot().head!;
    server.state.loseResetRequest = true;
    const result = await controller.deleteWorkspaceData(reviewed);
    expect(result).toMatchObject({ ok: false, reason: "pending" });
    const pending = controller.getSnapshot().workspaceDeletion;
    expect(pending).toMatchObject({ kind: "pending", reason: "unconfirmed" });
    expect(controller.getSnapshot().draft).not.toBeNull();
    // The attempt survives a reload and is resolved, not resent.
    await controller.dispose();
    controllers.splice(controllers.indexOf(controller), 1);
    const reopened = await accountController(server, identity);
    expect(reopened.controller.getSnapshot().workspaceDeletion).toMatchObject({
      kind: "pending",
      operationId: (pending as { operationId: string }).operationId,
    });
    expect(server.state.resets).toBe(0);

    const kept = await reopened.controller.cancelWorkspaceDeletion(
      (pending as { operationId: string }).operationId,
    );
    expect(kept).toMatchObject({ ok: false, reason: "cancelled" });
    expect(reopened.controller.getSnapshot().workspaceDeletion).toBeNull();
    expect(server.head.workspaceId).toBe(reviewed.workspaceId);
    expect(reopened.controller.getSnapshot().recovery).toMatchObject([
      { scope: "summary" },
    ]);
    // A delayed copy of the cancelled request can no longer delete anything.
    const replay = await server.fetch(ACCOUNT_ROUTES.reset, {
      method: "POST",
      headers: { [ACCOUNT_SESSION_HEADER]: "session-1" },
      body: JSON.stringify({
        operationId: (pending as { operationId: string }).operationId,
        reviewed: identityOf(reviewed),
        confirmation: "DELETE",
      }),
    });
    expect(replay.status).toBe(409);
    expect(server.head.workspaceId).toBe(reviewed.workspaceId);
  });

  it("treats Keep workspace as a deletion when the original request already committed", async () => {
    const server = fakeServer("session-1");
    const { controller } = await accountController(server);
    const reviewed = controller.getSnapshot().head!;
    server.state.dropResetResponse = true;
    server.state.offlineAfterReset = true;
    expect(await controller.deleteWorkspaceData(reviewed)).toMatchObject({
      ok: false,
      reason: "pending",
    });
    const pending = controller.getSnapshot().workspaceDeletion;
    expect(pending).toMatchObject({ kind: "pending", reason: "offline" });
    server.state.offline = false;
    expect(
      await controller.cancelWorkspaceDeletion(
        (pending as { operationId: string }).operationId,
      ),
    ).toMatchObject({ ok: true });
    expect(controller.getSnapshot().head!.workspaceId).toBe(
      server.head.workspaceId,
    );
    expect(controller.getSnapshot().workspaceDeletion).toBeNull();
    expect(server.state.resets).toBe(1);
  });

  it("reports pending local cleanup and retries it against the deleted workspace", async () => {
    const server = fakeServer("session-1");
    const { controller, identity } = await accountController(server);
    editSummary(controller, "Old draft");
    await controller.flushRecovery();
    const failure = vi
      .spyOn(CareerStorage.prototype, "completeWorkspaceReset")
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const result = await controller.deleteWorkspaceData(
      controller.getSnapshot().head!,
    );
    expect(result).toMatchObject({ ok: true, cleanup: "pending" });
    const status = controller.getSnapshot().workspaceDeletion;
    expect(status).toMatchObject({ kind: "cleanup-pending" });
    expect(await rawDrafts(`verso-account-${identity.userId}`)).toHaveLength(1);
    expect(
      await controller.resolveWorkspaceDeletion(
        (status as { operationId: string }).operationId,
      ),
    ).toMatchObject({ ok: true, cleanup: "complete" });
    expect(controller.getSnapshot().workspaceDeletion).toBeNull();
    expect(await rawDrafts(`verso-account-${identity.userId}`)).toEqual([]);
    failure.mockRestore();
  });

  it("scopes a delayed cleanup retry to the deleted workspace and keeps newer work", async () => {
    const name = `verso-account-${crypto.randomUUID()}`;
    databases.add(name);
    const local = await openCareerStorage(name);
    const deleted = {
      workspaceId: "deleted",
      revision: 3,
      generation: 0,
      document: createCareerDocument(),
    };
    const fresh = {
      ...deleted,
      workspaceId: "fresh",
      revision: 4,
      generation: 1,
    };
    await local.cacheAccountHead(deleted);
    const marker = (operationId: string) => ({
      operationId,
      reviewed: identityOf(deleted),
      requestHash: "hash",
      createdAt: Date.now(),
    });
    await local.writeResetMarker(marker("stale-retry"));
    await local.writeResetMarker(marker("other-tab"));
    await local.completeWorkspaceReset("first", "deleted", fresh);
    const newDraft = {
      draftId: crypto.randomUUID(),
      draftVersion: 1,
      workspaceId: "fresh",
      generation: 1,
      baselineRevision: 4,
      scope: "summary",
      baseline: fresh.document.summary,
      values: fresh.document.summary,
    };
    await local.writeDraft(newDraft, "fresh");
    await local.cacheAccountHead({ ...fresh, revision: 5 });

    await local.completeWorkspaceReset("stale-retry", "deleted", fresh);

    expect(await local.drafts()).toEqual([newDraft]);
    expect((await local.cachedAccountHead())?.revision).toBe(5);
    expect(
      (await local.resetMarkers()).map((item) => item.operationId),
    ).toEqual(["other-tab"]);
    // A stale writer bound to the deleted workspace is fenced.
    await expect(
      local.writeDraft({ ...newDraft, draftId: "late" }, "deleted"),
    ).rejects.toMatchObject({ code: "replaced" });
    local.close();
  });

  it("without a cached head, removes only records that name the deleted workspace", async () => {
    const name = `verso-account-${crypto.randomUUID()}`;
    databases.add(name);
    const local = await openCareerStorage(name);
    const document = createCareerDocument();
    const draft = (workspaceId: string) => ({
      draftId: crypto.randomUUID(),
      draftVersion: 1,
      workspaceId,
      generation: 0,
      baselineRevision: 0,
      scope: "summary",
      baseline: document.summary,
      values: document.summary,
    });
    const imported = draft("imported-foreign");
    await local.writeDraft(draft("deleted"));
    await local.writeDraft(imported);
    await local.completeWorkspaceReset("op", "deleted", {
      workspaceId: "fresh",
      revision: 1,
      generation: 1,
      document,
    });
    expect(await local.drafts()).toEqual([imported]);
    local.close();
  });

  it("clears another device's stale recovery when it next reconciles", async () => {
    const server = fakeServer("session-1");
    const device = await accountController(server);
    editSummary(device.controller, "Typed on the other device");
    await device.controller.flushRecovery();
    await device.controller.dispose();
    controllers.splice(controllers.indexOf(device.controller), 1);

    server.resetElsewhere();
    const reopened = await accountController(server, device.identity);
    expect(reopened.controller.getSnapshot().head!.workspaceId).toBe(
      server.head.workspaceId,
    );
    expect(reopened.controller.getSnapshot().recovery).toEqual([]);
    expect(await rawDrafts(`verso-account-${device.identity.userId}`)).toEqual(
      [],
    );
  });
});
