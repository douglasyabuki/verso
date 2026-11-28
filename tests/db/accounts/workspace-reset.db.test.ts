import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PATCH, POST } from "@/app/api/account/workspace/reset/route";
import { servePublicPdf } from "@/lib/account/public-pdf";
import { createRelease } from "@/lib/account/release-repository";
import {
  accountOperationStatus,
  cancelAccountWorkspaceReset,
  commitAccountSave,
  loadAccountWorkspace,
  loadPreviousAccountWorkspace,
  pruneAccountOperations,
  replaceAccountWorkspace,
  resetAccountWorkspace,
  resetRequestHash,
} from "@/lib/account/workspace-repository";
import { type CommittedHead, scopeFingerprint } from "@/lib/career/commit";
import { createCareerDocument, readScope } from "@/lib/career/model";
import {
  createSession,
  createUser,
  startTestDatabase,
  type TestDatabase,
} from "@/tests/support/db/database";
import {
  pdf,
  releaseMetadata,
  seedWorkspace,
} from "@/tests/support/db/releases";
import {
  ACCOUNT_SESSION_HEADER,
  type AccountSaveRequest,
} from "@/types-and-constants/account";

const ORIGIN = "http://localhost:3000";

let database: TestDatabase;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://isolated-test-database");
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-workspace-reset-secret-with-32-plus-chars",
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
  vi.unstubAllEnvs();
});

const identity = (head: CommittedHead) => ({
  workspaceId: head.workspaceId,
  revision: head.revision,
  generation: head.generation,
});

/** Immutable Save that renames the summary-free section order (keeps a valid scope). */
function sectionSave(head: CommittedHead): AccountSaveRequest {
  const baseline = [...(readScope(head.document, "sections") as string[])];
  const id = randomUUID();
  const content = {
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "sections",
    baseline,
    values: [...baseline].reverse(),
    draftId: id,
    draftVersion: 1,
  };
  return {
    id,
    ...content,
    fingerprint: scopeFingerprint(content),
    knownRevision: head.revision,
  };
}

/** Owner with a published latest release and a separately pinned release. */
async function publishedOwner() {
  const userId = await createUser(database.prisma, randomUUID());
  const head = await seedWorkspace(database, userId);
  const first = await createRelease(userId, releaseMetadata(head), pdf("one"));
  await createRelease(
    userId,
    releaseMetadata(head, { advance: false }),
    pdf("two"),
  );
  const token = first.list.links[0].token;
  return { userId, head, token };
}

async function counts(userId: string) {
  const prisma = database.prisma;
  return {
    links: await prisma.publicLink.count({ where: { userId } }),
    releases: await prisma.publicRelease.count({ where: { userId } }),
    previous: await prisma.accountPreviousWorkspace.count({
      where: { userId },
    }),
    receipts: await prisma.accountOperation.count({ where: { userId } }),
    sessions: await prisma.session.count({ where: { userId } }),
    accounts: await prisma.account.count({ where: { userId } }),
    users: await prisma.user.count({ where: { id: userId } }),
  };
}

describe("workspace data deletion", () => {
  it("deletes content, previous workspace, receipts, and public PDFs while keeping the account", async () => {
    const { userId, head, token } = await publishedOwner();
    const other = await publishedOwner();
    await database.prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: randomUUID(),
        providerId: "github",
        userId,
      },
    });
    await createSession(database.prisma, userId);
    const replaced = await replaceAccountWorkspace(userId, {
      operationId: randomUUID(),
      kind: "replace",
      reviewed: identity(head),
      document: head.document,
    });
    expect(await loadPreviousAccountWorkspace(userId)).toBeDefined();
    expect((await servePublicPdf(token)).status).toBe(200);
    expect((await servePublicPdf(token, "2")).status).toBe(200);

    const operationId = randomUUID();
    const fresh = await resetAccountWorkspace(userId, {
      operationId,
      reviewed: identity(replaced),
      confirmation: "DELETE",
    });

    expect(fresh.workspaceId).not.toBe(replaced.workspaceId);
    expect(fresh.revision).toBe(replaced.revision + 1);
    expect(fresh.generation).toBe(replaced.generation + 1);
    expect(fresh.document.resumes).toEqual([]);
    expect(fresh.document.sections.map((section) => section.kind)).toEqual([
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
    ]);
    expect(
      fresh.document.sections.every((section) => !section.entries.length),
    ).toBe(true);
    expect(await loadAccountWorkspace(userId)).toEqual(fresh);
    expect(await loadPreviousAccountWorkspace(userId)).toBeUndefined();
    expect(await counts(userId)).toEqual({
      links: 0,
      releases: 0,
      previous: 0,
      receipts: 1,
      sessions: 1,
      accounts: 1,
      users: 1,
    });
    expect((await servePublicPdf(token)).status).toBe(404);
    expect((await servePublicPdf(token, "1")).status).toBe(404);
    expect((await servePublicPdf(token, "2")).status).toBe(404);
    expect(await accountOperationStatus(userId, operationId)).toMatchObject({
      status: "committed",
      kind: "reset",
      requestHash: resetRequestHash(identity(replaced)),
    });
    // Other owners keep everything.
    expect((await servePublicPdf(other.token)).status).toBe(200);
    expect((await counts(other.userId)).releases).toBe(2);
  });

  it("rejects a changed workspace without writing and requires a fresh review", async () => {
    const { userId, head, token } = await publishedOwner();
    const saved = await commitAccountSave(userId, sectionSave(head));
    await expect(
      resetAccountWorkspace(userId, {
        operationId: randomUUID(),
        reviewed: identity(head),
        confirmation: "DELETE",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const current = await loadAccountWorkspace(userId);
    expect(current).toMatchObject({
      workspaceId: head.workspaceId,
      revision: saved.revision,
    });
    expect((await servePublicPdf(token)).status).toBe(200);
  });

  it("replays a lost-response retry without deleting work saved in the fresh workspace", async () => {
    const { userId, head } = await publishedOwner();
    const request = {
      operationId: randomUUID(),
      reviewed: identity(head),
      confirmation: "DELETE" as const,
    };
    const fresh = await resetAccountWorkspace(userId, request);
    const saved = await commitAccountSave(userId, sectionSave(fresh));
    const replay = await resetAccountWorkspace(userId, request);
    expect(replay).toMatchObject({
      workspaceId: fresh.workspaceId,
      revision: saved.revision,
    });
    const current = await loadAccountWorkspace(userId);
    expect(readScope(current.document, "sections")).toEqual(
      [...(readScope(fresh.document, "sections") as string[])].reverse(),
    );
    // A different attempt against the deleted identity cannot delete either.
    await expect(
      resetAccountWorkspace(userId, { ...request, operationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await accountOperationStatus(userId, randomUUID())).toMatchObject({
      status: "unknown",
    });
    // Stale Saves and releases from the deleted workspace are rejected.
    await expect(
      commitAccountSave(userId, sectionSave(head)),
    ).rejects.toMatchObject({ code: "replaced" });
    await expect(
      createRelease(userId, releaseMetadata(head), pdf("stale")),
    ).rejects.toMatchObject({ code: "replaced" });
    expect((await counts(userId)).links).toBe(0);
  });

  it("serializes cancellation with the attempt so exactly one wins", async () => {
    const { userId, head, token } = await publishedOwner();
    const request = {
      operationId: randomUUID(),
      reviewed: identity(head),
      confirmation: "DELETE" as const,
    };
    expect(await cancelAccountWorkspaceReset(userId, request)).toEqual({
      deleted: false,
    });
    expect(await cancelAccountWorkspaceReset(userId, request)).toEqual({
      deleted: false,
    });
    // Tombstones survive receipt pruning, so a very late original still cannot delete.
    await pruneAccountOperations(userId, 0, 0);
    await expect(resetAccountWorkspace(userId, request)).rejects.toMatchObject({
      code: "deletion_cancelled",
    });
    expect((await loadAccountWorkspace(userId)).workspaceId).toBe(
      head.workspaceId,
    );
    expect((await servePublicPdf(token)).status).toBe(200);
    await expect(
      resetAccountWorkspace(userId, {
        ...request,
        reviewed: {
          ...request.reviewed,
          revision: request.reviewed.revision + 1,
        },
      }),
    ).rejects.toMatchObject({ code: "operation_mismatch" });

    const committed = { ...request, operationId: randomUUID() };
    const fresh = await resetAccountWorkspace(userId, committed);
    expect(await cancelAccountWorkspaceReset(userId, committed)).toEqual({
      deleted: true,
      head: fresh,
    });
  });

  it("keeps the first workspace initializer for brand-new accounts", async () => {
    const userId = await createUser(database.prisma, randomUUID());
    const initial = await loadAccountWorkspace(userId);
    const fresh = await resetAccountWorkspace(userId, {
      operationId: randomUUID(),
      reviewed: identity(initial),
      confirmation: "DELETE",
    });
    const expected = createCareerDocument();
    expect(fresh.document.sections.map((section) => section.name)).toEqual(
      expected.sections.map((section) => section.name),
    );
    expect(fresh.document.defaults).toEqual(expected.defaults);
  });
});

describe("workspace data deletion API", () => {
  async function client() {
    const userId = await createUser(database.prisma, randomUUID());
    const head = await seedWorkspace(database, userId);
    return { userId, head, ...(await createSession(database.prisma, userId)) };
  }

  function call(
    who: { cookie: string; sessionId: string },
    method: "POST" | "PATCH",
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    return new Request(`${ORIGIN}/api/account/workspace/reset`, {
      method,
      headers: {
        cookie: who.cookie,
        [ACCOUNT_SESSION_HEADER]: who.sessionId,
        origin: ORIGIN,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  it("deletes only the verified owner's workspace and answers uncached", async () => {
    const owner = await client();
    const other = await client();
    const body = {
      operationId: randomUUID(),
      reviewed: identity(owner.head),
      confirmation: "DELETE",
    };
    const response = await POST(call(owner, "POST", body));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).workspaceId).not.toBe(
      owner.head.workspaceId,
    );
    expect((await loadAccountWorkspace(other.userId)).workspaceId).toBe(
      other.head.workspaceId,
    );
    const cancel = await PATCH(
      call(owner, "PATCH", {
        operationId: body.operationId,
        reviewed: body.reviewed,
      }),
    );
    expect((await cancel.json()).deleted).toBe(true);
  });

  it("rejects cross-origin, other-session, unknown-field, and unconfirmed requests without writes", async () => {
    const owner = await client();
    const body = {
      operationId: randomUUID(),
      reviewed: identity(owner.head),
      confirmation: "DELETE",
    };
    const cases = [
      [call(owner, "POST", body, { origin: "https://evil.example" }), 403],
      [
        call(owner, "POST", body, { [ACCOUNT_SESSION_HEADER]: randomUUID() }),
        403,
      ],
      [call(owner, "POST", { ...body, userId: randomUUID() }), 400],
      [call(owner, "POST", { ...body, confirmation: "delete" }), 400],
    ] as const;
    for (const [request, status] of cases)
      expect((await POST(request)).status).toBe(status);
    expect(await loadAccountWorkspace(owner.userId)).toMatchObject({
      workspaceId: owner.head.workspaceId,
      revision: owner.head.revision,
    });
  });
});
