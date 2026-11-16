import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { GET as operationStatus } from "@/app/api/account/workspace/operations/[operationId]/route";
import { POST as save } from "@/app/api/account/workspace/operations/route";
import { GET as previous } from "@/app/api/account/workspace/previous/route";
import { POST as replace } from "@/app/api/account/workspace/replace/route";
import { GET as workspace } from "@/app/api/account/workspace/route";
import { GET as authOptions } from "@/app/api/auth-options/route";
import { type CommittedHead, scopeFingerprint } from "@/lib/career/commit";
import { createCareerDocument, readScope } from "@/lib/career/model";
import { ACCOUNT_SESSION_HEADER } from "@/types-and-constants/account";

import {
  createSession,
  createUser,
  startTestDatabase,
  type TestDatabase,
} from "./database";

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
    "isolated-account-api-secret-with-at-least-32-chars",
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
  vi.unstubAllEnvs();
});

type Client = { sessionId: string; cookie: string };

async function signIn(expiresAt?: Date): Promise<Client> {
  const userId = await createUser(database.prisma, randomUUID());
  return createSession(database.prisma, userId, expiresAt);
}

function call(
  client: Client | undefined,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(client
        ? { cookie: client.cookie, [ACCOUNT_SESSION_HEADER]: client.sessionId }
        : {}),
      ...(init.method && init.method !== "GET"
        ? { origin: ORIGIN, "content-type": "application/json" }
        : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function orderSave(head: CommittedHead) {
  const id = randomUUID();
  const baseline = [...(readScope(head.document, "sections") as string[])];
  const content = {
    workspaceId: head.workspaceId,
    generation: head.generation,
    scope: "sections",
    baseline,
    values: [...baseline].reverse(),
  };
  return {
    id,
    ...content,
    fingerprint: scopeFingerprint(content),
    knownRevision: head.revision,
  };
}

async function load(client: Client): Promise<CommittedHead> {
  const response = await workspace(call(client, "/api/account/workspace"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response.json();
}

it("reports configured providers at request time", async () => {
  expect(await (await authOptions()).json()).toEqual({
    github: true,
    google: false,
  });
});

it("rejects missing, expired, and mismatched sessions and cross-origin writes", async () => {
  expect(
    (await workspace(call(undefined, "/api/account/workspace"))).status,
  ).toBe(401);
  const expired = await signIn(new Date(Date.now() - 1_000));
  expect(
    (await workspace(call(expired, "/api/account/workspace"))).status,
  ).toBe(401);
  const client = await signIn();
  const mismatch = await workspace(
    call(client, "/api/account/workspace", {
      headers: { [ACCOUNT_SESSION_HEADER]: randomUUID() },
    }),
  );
  expect(mismatch.status).toBe(403);
  expect(await mismatch.json()).toMatchObject({ code: "session_mismatch" });
  const head = await load(client);
  const crossOrigin = await save(
    call(client, "/api/account/workspace/operations", {
      method: "POST",
      body: orderSave(head),
      headers: { origin: "https://attacker.example" },
    }),
  );
  expect(crossOrigin.status).toBe(403);
  expect((await load(client)).revision).toBe(0);
});

it("saves through the API once, replays a retry, and resolves status per owner", async () => {
  const client = await signIn();
  const other = await signIn();
  const head = await load(client);
  const body = orderSave(head);
  const request = () =>
    save(
      call(client, "/api/account/workspace/operations", {
        method: "POST",
        body,
      }),
    );
  const first = await request();
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ revision: 1, replayed: false });
  expect(await (await request()).json()).toMatchObject({
    revision: 1,
    replayed: true,
  });
  expect((await load(client)).revision).toBe(1);

  const path = `/api/account/workspace/operations/${body.id}`;
  const context = { params: Promise.resolve({ operationId: body.id }) };
  expect(
    await (await operationStatus(call(client, path), context)).json(),
  ).toMatchObject({
    status: "committed",
  });
  // Another owner cannot observe this operation.
  expect(
    await (await operationStatus(call(other, path), context)).json(),
  ).toEqual({
    status: "unknown",
  });
  expect((await load(other)).revision).toBe(0);
});

it("rejects owner fields, malformed bodies, and oversized payloads without writes", async () => {
  const client = await signIn();
  const head = await load(client);
  const withOwner = await save(
    call(client, "/api/account/workspace/operations", {
      method: "POST",
      body: { ...orderSave(head), userId: "someone-else" },
    }),
  );
  expect(withOwner.status).toBe(400);
  const conflict = orderSave(head);
  const malformed = await save(
    call(client, "/api/account/workspace/operations", {
      method: "POST",
      body: { ...conflict, fingerprint: "tampered" },
    }),
  );
  expect(await malformed.json()).toMatchObject({ code: "invalid" });
  const oversized = await replace(
    call(client, "/api/account/workspace/replace", {
      method: "POST",
      body: {
        operationId: randomUUID(),
        kind: "replace",
        reviewed: head,
        document: { padding: "x".repeat(4 * 1024 * 1024 + 70 * 1024) },
      },
    }),
  );
  expect(oversized.status).toBe(413);
  expect((await load(client)).revision).toBe(0);
});

it("imports a reviewed workspace and exposes the one previous workspace", async () => {
  const client = await signIn();
  const head = await load(client);
  expect(
    await (
      await previous(call(client, "/api/account/workspace/previous"))
    ).json(),
  ).toBeNull();
  const imported = await replace(
    call(client, "/api/account/workspace/replace", {
      method: "POST",
      body: {
        operationId: randomUUID(),
        kind: "import",
        reviewed: {
          workspaceId: head.workspaceId,
          revision: head.revision,
          generation: head.generation,
        },
        document: createCareerDocument("pt-BR"),
      },
    }),
  );
  expect(await imported.json()).toMatchObject({ revision: 1, generation: 1 });
  expect(
    await (
      await previous(call(client, "/api/account/workspace/previous"))
    ).json(),
  ).toMatchObject({ revision: 0, generation: 0 });
  const stale = await save(
    call(client, "/api/account/workspace/operations", {
      method: "POST",
      body: orderSave(head),
    }),
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: "replaced" });
});
