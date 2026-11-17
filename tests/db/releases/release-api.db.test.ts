import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, expect, it, vi } from "vitest";

import {
  DELETE as deleteRelease,
  PATCH as patchRelease,
} from "@/app/api/account/releases/[releaseId]/route";
import {
  DELETE as revokeLink,
  PATCH as patchLink,
} from "@/app/api/account/releases/links/[linkId]/route";
import { GET as list, POST as upload } from "@/app/api/account/releases/route";
import { GET as pinned } from "@/app/pdf/[token]/[number]/route";
import { GET as latest } from "@/app/pdf/[token]/route";
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
import type {
  CreateReleaseResponse,
  ReleaseList,
  ReleaseRequestMetadata,
} from "@/types-and-constants/releases";
import { RELEASE_LIMITS } from "@/types-and-constants/releases";

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

type Client = { sessionId: string; cookie: string; userId: string };

async function signIn(): Promise<Client> {
  const userId = await createUser(database.prisma, randomUUID());
  return { userId, ...(await createSession(database.prisma, userId)) };
}

function auth(client: Client, mutation = true): Record<string, string> {
  return {
    cookie: client.cookie,
    [ACCOUNT_SESSION_HEADER]: client.sessionId,
    ...(mutation ? { origin: ORIGIN } : {}),
  };
}

function uploadRequest(
  client: Client,
  metadata: ReleaseRequestMetadata | Record<string, unknown>,
  bytes: Uint8Array = pdf(),
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set(
    "pdf",
    new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }),
  );
  return new Request(`${ORIGIN}/api/account/releases`, {
    method: "POST",
    headers: { ...auth(client), ...headers },
    body: form,
  });
}

function jsonRequest(
  client: Client,
  path: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { ...auth(client), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

async function publicGet(token: string, number?: number) {
  const request = new Request(`${ORIGIN}/pdf/${token}`);
  return number === undefined
    ? latest(request, params({ token }))
    : pinned(request, params({ token, number: String(number) }));
}

it("uploads a reviewed release and serves it anonymously with PDF headers", async () => {
  const client = await signIn();
  const head = await seedWorkspace(database, client.userId);
  const bytes = pdf("public");
  const response = await upload(
    uploadRequest(client, releaseMetadata(head), bytes),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const created = (await response.json()) as CreateReleaseResponse;
  const token = created.list.links[0].token;
  expect(JSON.stringify(created)).not.toContain('"pdf"');

  for (const served of [await publicGet(token), await publicGet(token, 1)]) {
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("application/pdf");
    expect(served.headers.get("cache-control")).toBe("no-store");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("x-robots-tag")).toContain("noindex");
    expect(served.headers.get("referrer-policy")).toBe("no-referrer");
    expect(served.headers.get("content-disposition")).toContain(
      'inline; filename="ana-souza-en-us-v1.pdf"',
    );
    expect(served.headers.get("etag")).toBe(
      `"${created.list.links[0].releases[0].pdfSha256}"`,
    );
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
  }

  const listed = await list(
    new Request(`${ORIGIN}/api/account/releases`, {
      headers: auth(client, false),
    }),
  );
  expect(((await listed.json()) as ReleaseList).links).toHaveLength(1);
});

it("rejects anonymous, cross-origin, wrong-session, malformed, and oversized uploads", async () => {
  const client = await signIn();
  const head = await seedWorkspace(database, client.userId);
  const metadata = releaseMetadata(head);
  const anonymous = new Request(`${ORIGIN}/api/account/releases`, {
    headers: {},
  });
  expect((await list(anonymous)).status).toBe(401);
  expect(
    (
      await upload(
        uploadRequest(client, metadata, pdf(), {
          origin: "https://evil.example",
        }),
      )
    ).status,
  ).toBe(403);
  const mismatch = await upload(
    uploadRequest(client, metadata, pdf(), {
      [ACCOUNT_SESSION_HEADER]: "another-session",
    }),
  );
  expect(await mismatch.json()).toMatchObject({ code: "session_mismatch" });
  const unknown = await upload(
    uploadRequest(client, { ...metadata, owner: "someone-else" }),
  );
  expect(await unknown.json()).toMatchObject({ code: "invalid" });
  const extraField = new FormData();
  extraField.set("metadata", JSON.stringify(metadata));
  extraField.set("pdf", new Blob([pdf()]));
  extraField.set("note", "x");
  const extra = await upload(
    new Request(`${ORIGIN}/api/account/releases`, {
      method: "POST",
      headers: auth(client),
      body: extraField,
    }),
  );
  expect(await extra.json()).toMatchObject({ code: "invalid" });
  const oversized = await upload(
    uploadRequest(
      client,
      metadata,
      new Uint8Array(RELEASE_LIMITS.pdfBytes + 70_000),
    ),
  );
  expect(oversized.status).toBe(413);
  const lists = (await (
    await list(
      new Request(`${ORIGIN}/api/account/releases`, {
        headers: auth(client, false),
      }),
    )
  ).json()) as ReleaseList;
  expect(lists.links).toEqual([]);
});

it("applies owner actions through routes and returns one 404 for every unavailable public URL", async () => {
  const client = await signIn();
  const other = await signIn();
  const head = await seedWorkspace(database, client.userId);
  const one = (await (
    await upload(uploadRequest(client, releaseMetadata(head), pdf("one")))
  ).json()) as CreateReleaseResponse;
  const two = (await (
    await upload(uploadRequest(client, releaseMetadata(head), pdf("two")))
  ).json()) as CreateReleaseResponse;
  const link = two.list.links[0];
  const linkPath = `/api/account/releases/links/${link.id}`;

  const foreign = await patchLink(
    jsonRequest(other, linkPath, "PATCH", {
      action: "auto-release",
      enabled: true,
    }),
    params({ linkId: link.id }),
  );
  expect(foreign.status).toBe(404);
  const unknownField = await patchLink(
    jsonRequest(client, linkPath, "PATCH", {
      action: "set-latest",
      releaseId: one.releaseId,
      extra: 1,
    }),
    params({ linkId: link.id }),
  );
  expect(unknownField.status).toBe(400);
  const malformedId = await patchLink(
    jsonRequest(client, "/api/account/releases/links/x", "PATCH", {
      action: "auto-release",
      enabled: true,
    }),
    params({ linkId: "x" }),
  );
  expect(malformedId.status).toBe(400);

  const rolled = await patchLink(
    jsonRequest(client, linkPath, "PATCH", {
      action: "set-latest",
      releaseId: one.releaseId,
    }),
    params({ linkId: link.id }),
  );
  expect(rolled.status).toBe(200);
  expect(
    new Uint8Array(await (await publicGet(link.token)).arrayBuffer()),
  ).toEqual(pdf("one"));

  const releasePath = `/api/account/releases/${two.releaseId}`;
  expect(
    (
      await patchRelease(
        jsonRequest(client, releasePath, "PATCH", { action: "revoke" }),
        params({ releaseId: two.releaseId }),
      )
    ).status,
  ).toBe(200);
  const revoked = await publicGet(link.token, 2);
  expect(revoked.status).toBe(404);
  expect(revoked.headers.get("cache-control")).toBe("no-store");
  const deletedLatest = await deleteRelease(
    jsonRequest(client, `/api/account/releases/${one.releaseId}`, "DELETE"),
    params({ releaseId: one.releaseId }),
  );
  expect(await deletedLatest.json()).toMatchObject({ code: "conflict" });
  expect(
    (
      await deleteRelease(
        jsonRequest(client, releasePath, "DELETE"),
        params({ releaseId: two.releaseId }),
      )
    ).status,
  ).toBe(200);

  const unknownToken = "A".repeat(43);
  const statuses = [
    (await publicGet(unknownToken)).status,
    (await publicGet("short")).status,
    (await publicGet(link.token, 2)).status,
    (
      await pinned(
        new Request(`${ORIGIN}/pdf`),
        params({ token: link.token, number: "0" }),
      )
    ).status,
  ];
  expect(statuses).toEqual([404, 404, 404, 404]);

  expect(
    (
      await revokeLink(
        jsonRequest(client, linkPath, "DELETE"),
        params({ linkId: link.id }),
      )
    ).status,
  ).toBe(200);
  expect((await publicGet(link.token)).status).toBe(404);
  expect((await publicGet(link.token, 1)).status).toBe(404);
});

it("serves no public PDFs when accounts are disabled", async () => {
  const client = await signIn();
  const head = await seedWorkspace(database, client.userId);
  const created = (await (
    await upload(uploadRequest(client, releaseMetadata(head)))
  ).json()) as CreateReleaseResponse;
  vi.stubEnv("BETTER_AUTH_SECRET", "");
  try {
    expect((await publicGet(created.list.links[0].token)).status).toBe(404);
  } finally {
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "isolated-account-api-secret-with-at-least-32-chars",
    );
  }
});
