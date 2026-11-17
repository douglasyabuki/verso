import { afterEach, describe, expect, it, vi } from "vitest";

import {
  commitScopeRequest,
  type CommittedHead,
  replaceHead,
} from "@/lib/career/commit";
import { draftConflict } from "@/lib/career/conflict";
import { createCareerDocument } from "@/lib/career/model";
import { openAccountBackend } from "@/stores/career/account-backend";
import { CareerController } from "@/stores/career/controller";
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
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  const state = {
    offline: false,
    dropResponse: false,
    expired: false,
    commits: 0,
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
