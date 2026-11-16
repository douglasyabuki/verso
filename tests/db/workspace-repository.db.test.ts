import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it } from "vitest";

import {
  accountOperationStatus,
  checkAccountWorkspace,
  commitAccountSave,
  loadAccountWorkspace,
  loadPreviousAccountWorkspace,
  pruneAccountOperations,
  replaceAccountWorkspace,
} from "@/lib/account/workspace-repository";
import { type CommittedHead, scopeFingerprint } from "@/lib/career/commit";
import { createCareerDocument, readScope } from "@/lib/career/model";
import type { AccountSaveRequest } from "@/types-and-constants/account";

import { createUser, startTestDatabase, type TestDatabase } from "./database";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
});

/** Build an immutable Save that reorders sections (or keeps them) from a head. */
function orderSave(
  head: CommittedHead,
  reverse: boolean,
  id: string = randomUUID(),
): AccountSaveRequest {
  const baseline = [...(readScope(head.document, "sections") as string[])];
  const values = reverse ? [...baseline].reverse() : [...baseline];
  const content = {
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "sections",
    baseline,
    values,
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

function summarySave(head: CommittedHead): AccountSaveRequest {
  const baseline = structuredClone(readScope(head.document, "summary"));
  const values = structuredClone(baseline);
  const id = randomUUID();
  const content = {
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "summary",
    baseline,
    values,
  };
  return {
    id,
    ...content,
    fingerprint: scopeFingerprint(content),
    knownRevision: head.revision,
  };
}

it("creates one clean workspace per owner on first load and isolates owners", async () => {
  const a = await createUser(database.prisma, randomUUID());
  const b = await createUser(database.prisma, randomUUID());
  const [first, again] = await Promise.all([
    loadAccountWorkspace(a),
    loadAccountWorkspace(a),
  ]);
  expect(again.workspaceId).toBe(first.workspaceId);
  expect(first.revision).toBe(0);
  const other = await loadAccountWorkspace(b);
  expect(other.workspaceId).not.toBe(first.workspaceId);

  await commitAccountSave(a, orderSave(first, true));
  expect((await loadAccountWorkspace(b)).revision).toBe(0);
  expect((await loadAccountWorkspace(a)).revision).toBe(1);
  await expect(
    commitAccountSave(b, orderSave(first, true)),
  ).rejects.toMatchObject({ code: "replaced" });
});

it("commits a Save once and replays its receipt without another revision", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  const request = orderSave(head, true);
  const committed = await commitAccountSave(user, request);
  expect(committed).toMatchObject({ revision: 1, replayed: false });
  expect(committed.document).toBeUndefined();

  const replay = await commitAccountSave(user, request);
  expect(replay).toMatchObject({ revision: 1, replayed: true });
  expect((await loadAccountWorkspace(user)).revision).toBe(1);
  expect(await accountOperationStatus(user, request.id)).toMatchObject({
    status: "committed",
    kind: "save",
    result: { revision: 1, generation: 0 },
  });
  expect(await accountOperationStatus(user, randomUUID())).toEqual({
    status: "unknown",
  });

  const changed = { ...orderSave(head, false, request.id) };
  await expect(commitAccountSave(user, changed)).rejects.toMatchObject({
    code: "operation_mismatch",
  });
  await expect(
    commitAccountSave(user, { ...orderSave(head, false), fingerprint: "x" }),
  ).rejects.toMatchObject({ code: "invalid" });
});

it("keeps unrelated changes compatible and rejects a changed scope baseline", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  await commitAccountSave(user, summarySave(head));

  // Same stale head, different scope: commits, and returns the newer document.
  const unrelated = await commitAccountSave(user, orderSave(head, true));
  expect(unrelated).toMatchObject({ revision: 2, replayed: false });
  expect(unrelated.document).toBeDefined();

  await expect(
    commitAccountSave(user, orderSave(head, false)),
  ).rejects.toMatchObject({ code: "conflict" });
  expect((await loadAccountWorkspace(user)).revision).toBe(2);
});

it("replaces only the reviewed revision, keeps one previous workspace, and rejects late Saves", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  const incoming = createCareerDocument("pt-BR");
  const stale = { ...head, revision: head.revision + 1 };
  await expect(
    replaceAccountWorkspace(user, {
      operationId: randomUUID(),
      kind: "import",
      reviewed: stale,
      document: incoming,
    }),
  ).rejects.toMatchObject({ code: "conflict" });
  expect(await loadPreviousAccountWorkspace(user)).toBeUndefined();

  const request = {
    operationId: randomUUID(),
    kind: "import" as const,
    reviewed: head,
    document: incoming,
  };
  const replaced = await replaceAccountWorkspace(user, request);
  expect(replaced).toMatchObject({ revision: 1, generation: 1 });
  expect(await replaceAccountWorkspace(user, request)).toMatchObject({
    revision: 1,
    generation: 1,
  });
  expect(await loadPreviousAccountWorkspace(user)).toMatchObject({
    revision: 0,
    generation: 0,
  });
  await expect(
    commitAccountSave(user, orderSave(head, true)),
  ).rejects.toMatchObject({ code: "replaced" });

  const rolledBack = await replaceAccountWorkspace(user, {
    operationId: randomUUID(),
    kind: "rollback",
    reviewed: replaced,
  });
  expect(rolledBack).toMatchObject({ revision: 2, generation: 2 });
  expect(rolledBack.document.languages[0].tag).toBe(
    head.document.languages[0].tag,
  );
  expect(await loadPreviousAccountWorkspace(user)).toMatchObject({
    revision: 1,
    generation: 1,
  });
});

it("rejects rollback without a previous workspace and malformed replacement", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  await expect(
    replaceAccountWorkspace(user, {
      operationId: randomUUID(),
      kind: "rollback",
      reviewed: head,
    }),
  ).rejects.toMatchObject({ code: "not_found" });
  await expect(
    replaceAccountWorkspace(user, {
      operationId: randomUUID(),
      kind: "replace",
      reviewed: head,
      document: { sections: "nope" },
    }),
  ).rejects.toThrow();
  expect(await loadAccountWorkspace(user)).toMatchObject({ revision: 0 });
});

it("rolls back the whole Save and replacement when the receipt write fails", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  await database.db.exec(`
    CREATE OR REPLACE FUNCTION fail_receipt() RETURNS trigger AS $$
    BEGIN
      IF NEW."operationId" LIKE 'fail-%' THEN
        RAISE EXCEPTION 'injected receipt failure';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS fail_receipt ON account_operation;
    CREATE TRIGGER fail_receipt BEFORE INSERT ON account_operation
      FOR EACH ROW EXECUTE FUNCTION fail_receipt();
  `);
  try {
    await expect(
      commitAccountSave(user, orderSave(head, true, `fail-${randomUUID()}`)),
    ).rejects.toThrow();
    await expect(
      replaceAccountWorkspace(user, {
        operationId: `fail-${randomUUID()}`,
        kind: "replace",
        reviewed: head,
        document: createCareerDocument("pt-BR"),
      }),
    ).rejects.toThrow();
  } finally {
    await database.db.exec(
      "DROP TRIGGER IF EXISTS fail_receipt ON account_operation;",
    );
  }
  expect(await loadAccountWorkspace(user)).toMatchObject({
    revision: 0,
    generation: 0,
  });
  expect(await loadPreviousAccountWorkspace(user)).toBeUndefined();
});

it("prunes the oldest receipts beyond the retention policy for one owner only", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const other = await createUser(database.prisma, randomUUID());
  let head = await loadAccountWorkspace(user);
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    const request = orderSave(head, true);
    ids.push(request.id);
    await commitAccountSave(user, request);
    head = await loadAccountWorkspace(user);
  }
  const otherHead = await loadAccountWorkspace(other);
  const otherRequest = orderSave(otherHead, true);
  await commitAccountSave(other, otherRequest);
  await database.prisma.accountOperation.update({
    where: { userId_operationId: { userId: user, operationId: ids[0] } },
    data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
  });

  expect(await pruneAccountOperations(user, 30, 2)).toBe(2);
  expect(await accountOperationStatus(user, ids[0])).toEqual({
    status: "unknown",
  });
  expect(await accountOperationStatus(user, ids[3])).toMatchObject({
    status: "committed",
  });
  expect(await accountOperationStatus(other, otherRequest.id)).toMatchObject({
    status: "committed",
  });
});

it("answers a current conditional check with identity only and a stale one with the document", async () => {
  const user = await createUser(database.prisma, randomUUID());
  const head = await loadAccountWorkspace(user);
  const known = {
    workspaceId: head.workspaceId,
    revision: head.revision,
    generation: head.generation,
  };
  expect(await checkAccountWorkspace(user, known)).toEqual({
    unchanged: true,
    ...known,
  });
  await commitAccountSave(user, orderSave(head, true));
  const changed = await checkAccountWorkspace(user, known);
  expect(changed).toMatchObject({ revision: head.revision + 1 });
  expect("document" in changed).toBe(true);
});

it("prunes receipts inside at most one Save per day and never on reads", async () => {
  const user = await createUser(database.prisma, randomUUID());
  let head = await loadAccountWorkspace(user);
  const first = orderSave(head, true);
  await commitAccountSave(user, first);
  const pruned = await database.prisma.accountWorkspace.findUnique({
    where: { userId: user },
  });
  expect(pruned?.operationsPrunedAt).toBeInstanceOf(Date);
  // An expired receipt survives later Saves until a day has passed since pruning.
  await database.prisma.accountOperation.update({
    where: { userId_operationId: { userId: user, operationId: first.id } },
    data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
  });
  head = await loadAccountWorkspace(user);
  await commitAccountSave(user, orderSave(head, true));
  head = await loadAccountWorkspace(user);
  await checkAccountWorkspace(user, head);
  expect(await accountOperationStatus(user, first.id)).toMatchObject({
    status: "committed",
  });
  await database.prisma.accountWorkspace.update({
    where: { userId: user },
    data: { operationsPrunedAt: new Date(Date.now() - 86_400_001) },
  });
  await commitAccountSave(user, orderSave(head, true));
  expect(await accountOperationStatus(user, first.id)).toEqual({
    status: "unknown",
  });
});
