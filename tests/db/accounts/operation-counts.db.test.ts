import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { PATCH as patchLink } from "@/app/api/account/releases/links/[linkId]/route";
import {
  GET as listReleases,
  POST as upload,
} from "@/app/api/account/releases/route";
import { POST as save } from "@/app/api/account/workspace/operations/route";
import { GET as workspace } from "@/app/api/account/workspace/route";
import { GET as pinnedPdf } from "@/app/pdf/[token]/[number]/route";
import { GET as latestPdf } from "@/app/pdf/[token]/route";
import { type CommittedHead, scopeFingerprint } from "@/lib/career/commit";
import { readScope } from "@/lib/career/model";
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
import { ACCOUNT_SESSION_HEADER } from "@/types-and-constants/account";
import type { CreateReleaseResponse } from "@/types-and-constants/releases";

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

const ORIGIN = "http://localhost:3000";

let database: TestDatabase;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://isolated-test-database");
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-operation-count-secret-with-32-chars",
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
  vi.unstubAllEnvs();
});

/** Count Prisma-issued SQL statements by kind. Transaction control is not
 * reported as a query event by the driver adapter. */
function summarize(queries: string[]) {
  const kinds = queries
    .map((query) => query.trim().split(/\s+/)[0].toUpperCase())
    .filter((kind) => !["BEGIN", "COMMIT", "ROLLBACK"].includes(kind));
  return {
    total: kinds.length,
    reads: kinds.filter((kind) => kind === "SELECT").length,
    writes: kinds.filter((kind) => kind !== "SELECT").length,
  };
}

// These counts are measurements recorded as regression bounds. One HTTP request
// is not one billable operation; reverify billing against the selected plan.
it("records database statements for session checks, loads, Saves, and retries", async () => {
  const userId = await createUser(database.prisma, randomUUID());
  const client = await createSession(database.prisma, userId);
  const headers = {
    cookie: client.cookie,
    [ACCOUNT_SESSION_HEADER]: client.sessionId,
  };
  const get = () =>
    workspace(new Request(`${ORIGIN}/api/account/workspace`, { headers }));

  database.queries.take();
  const head = (await (await get()).json()) as CommittedHead;
  const firstLoad = summarize(database.queries.take());

  await get();
  const load = summarize(database.queries.take());

  const check = (known: CommittedHead) =>
    workspace(
      new Request(
        `${ORIGIN}/api/account/workspace?${new URLSearchParams({
          workspaceId: known.workspaceId,
          revision: String(known.revision),
          generation: String(known.generation),
        })}`,
        { headers },
      ),
    );
  expect(await (await check(head)).json()).toMatchObject({ unchanged: true });
  const unchangedCheck = summarize(database.queries.take());

  const baseline = [...(readScope(head.document, "sections") as string[])];
  const content = {
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "sections",
    baseline,
    values: [...baseline].reverse(),
  };
  const body = {
    id: randomUUID(),
    ...content,
    fingerprint: scopeFingerprint(content),
    knownRevision: head.revision,
  };
  const post = () =>
    save(
      new Request(`${ORIGIN}/api/account/workspace/operations`, {
        method: "POST",
        headers: { ...headers, origin: ORIGIN },
        body: JSON.stringify(body),
      }),
    );
  // The first Save also runs the daily receipt pruning inside its transaction.
  expect((await post()).status).toBe(200);
  const commitWithPrune = summarize(database.queries.take());
  expect((await post()).status).toBe(200);
  const replay = summarize(database.queries.take());

  const changed = (await (await check(head)).json()) as CommittedHead;
  expect(changed.revision).toBe(head.revision + 1);
  const changedCheck = summarize(database.queries.take());

  const nextBaseline = [
    ...(readScope(changed.document, "sections") as string[]),
  ];
  const nextContent = {
    workspaceId: changed.workspaceId,
    generation: changed.generation,
    scope: "sections",
    baseline: nextBaseline,
    values: [...nextBaseline].reverse(),
  };
  const nextResponse = await save(
    new Request(`${ORIGIN}/api/account/workspace/operations`, {
      method: "POST",
      headers: { ...headers, origin: ORIGIN },
      body: JSON.stringify({
        id: randomUUID(),
        ...nextContent,
        fingerprint: scopeFingerprint(nextContent),
        knownRevision: changed.revision,
      }),
    }),
  );
  expect(nextResponse.status).toBe(200);
  const commit = summarize(database.queries.take());

  const report = {
    firstLoad,
    load,
    unchangedCheck,
    changedCheck,
    commit,
    commitWithPrune,
    replay,
  };
  console.info("Account database statements", JSON.stringify(report));
  // Each request includes the session lookup (database sessions, no cookie cache).
  expect(load.writes).toBe(0);
  expect(unchangedCheck.writes).toBe(0);
  expect(changedCheck.writes).toBe(0);
  // A freshness check is the session lookup plus one workspace read.
  expect(unchangedCheck.total).toBeLessThanOrEqual(load.total);
  expect(load.total).toBeLessThanOrEqual(4);
  expect(commit.writes).toBe(2);
  expect(commit.total).toBeLessThanOrEqual(8);
  expect(replay.writes).toBe(0);
});

it("records database statements for release uploads, lists, latest moves, and public downloads", async () => {
  const userId = await createUser(database.prisma, randomUUID());
  const client = await createSession(database.prisma, userId);
  const head = await seedWorkspace(database, userId);
  const headers = {
    cookie: client.cookie,
    [ACCOUNT_SESSION_HEADER]: client.sessionId,
  };
  const send = (title: string) => {
    const form = new FormData();
    form.set("metadata", JSON.stringify(releaseMetadata(head)));
    form.set("pdf", new Blob([pdf(title)]));
    return upload(
      new Request(`${ORIGIN}/api/account/releases`, {
        method: "POST",
        headers: { ...headers, origin: ORIGIN },
        body: form,
      }),
    );
  };

  database.queries.take();
  const first = (await (await send("one")).json()) as CreateReleaseResponse;
  const firstRelease = summarize(database.queries.take());
  await send("two");
  const release = summarize(database.queries.take());

  await listReleases(
    new Request(`${ORIGIN}/api/account/releases`, { headers }),
  );
  const list = summarize(database.queries.take());

  const link = first.list.links[0];
  const moved = await patchLink(
    new Request(`${ORIGIN}/api/account/releases/links/${link.id}`, {
      method: "PATCH",
      headers: { ...headers, origin: ORIGIN },
      body: JSON.stringify({
        action: "set-latest",
        releaseId: first.releaseId,
      }),
    }),
    { params: Promise.resolve({ linkId: link.id }) },
  );
  expect(moved.status).toBe(200);
  const setLatest = summarize(database.queries.take());

  const anonymous = new Request(`${ORIGIN}/pdf/${link.token}`);
  expect(
    (
      await latestPdf(anonymous, {
        params: Promise.resolve({ token: link.token }),
      })
    ).status,
  ).toBe(200);
  const latestDownload = summarize(database.queries.take());
  expect(
    (
      await pinnedPdf(anonymous, {
        params: Promise.resolve({ token: link.token, number: "2" }),
      })
    ).status,
  ).toBe(200);
  const pinnedDownload = summarize(database.queries.take());

  const report = {
    firstRelease,
    release,
    list,
    setLatest,
    latestDownload,
    pinnedDownload,
  };
  console.info("Release database statements", JSON.stringify(report));
  // Public downloads never touch sessions: one read, no writes.
  expect(latestDownload).toEqual({ total: 1, reads: 1, writes: 0 });
  expect(pinnedDownload).toEqual({ total: 1, reads: 1, writes: 0 });
  expect(list.writes).toBe(0);
  expect(release.writes).toBe(2);
  expect(release.total).toBeLessThanOrEqual(12);
  expect(firstRelease.writes).toBe(4);
  expect(setLatest.writes).toBe(1);
});
