import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { POST as save } from "@/app/api/account/workspace/operations/route";
import { GET as workspace } from "@/app/api/account/workspace/route";
import { type CommittedHead, scopeFingerprint } from "@/lib/career/commit";
import { readScope } from "@/lib/career/model";
import { ACCOUNT_SESSION_HEADER } from "@/types-and-constants/account";

import {
  createSession,
  createUser,
  startTestDatabase,
  type TestDatabase,
} from "./database";

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
  expect((await post()).status).toBe(200);
  const commit = summarize(database.queries.take());
  expect((await post()).status).toBe(200);
  const replay = summarize(database.queries.take());

  const report = { firstLoad, load, commit, replay };
  console.info("Account database statements", JSON.stringify(report));
  // Each request includes the session lookup (database sessions, no cookie cache).
  expect(load.total).toBeLessThanOrEqual(6);
  expect(commit.writes).toBe(2);
  expect(commit.total).toBeLessThanOrEqual(8);
  expect(replay.writes).toBe(0);
});
