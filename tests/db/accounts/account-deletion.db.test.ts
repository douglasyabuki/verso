import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH, POST } from "@/app/api/account/route";
import { GET as workspace } from "@/app/api/account/workspace/route";
import {
  createSession,
  createUser,
  startTestDatabase,
  type TestDatabase,
} from "@/tests/support/db/database";
import {
  ACCOUNT_DELETION_HEADER,
  ACCOUNT_SESSION_HEADER,
} from "@/types-and-constants/account";

const ORIGIN = "http://localhost:3000";

let database: TestDatabase;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://isolated-test-database");
  vi.stubEnv("BETTER_AUTH_URL", ORIGIN);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "isolated-account-deletion-secret-with-32-plus-chars",
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  database = await startTestDatabase();
});

afterAll(async () => {
  await database?.close();
  vi.unstubAllEnvs();
});

type Client = { userId: string; sessionId: string; cookie: string };

async function signIn(): Promise<Client> {
  const userId = await createUser(database.prisma, randomUUID());
  return { userId, ...(await createSession(database.prisma, userId)) };
}

function request(
  client: Client | undefined,
  method: "POST" | "DELETE" | "PATCH" | "GET",
  init: { body?: unknown; capability?: string; origin?: string } = {},
  path = "/api/account",
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(client
        ? { cookie: client.cookie, [ACCOUNT_SESSION_HEADER]: client.sessionId }
        : {}),
      ...(method === "GET" ? {} : { origin: init.origin ?? ORIGIN }),
      ...(init.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...(init.capability
        ? { [ACCOUNT_DELETION_HEADER]: init.capability }
        : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function prepare(client: Client): Promise<string> {
  const response = await POST(
    request(client, "POST", { body: { intent: "prepare" } }),
  );
  expect(response.status).toBe(200);
  return (await response.json()).capability;
}

function remove(client: Client, capability?: string) {
  return DELETE(
    request(client, "DELETE", { body: { confirmation: "DELETE" }, capability }),
  );
}

describe("account deletion", () => {
  it("deletes the owner and everything it owns, leaving other users intact", async () => {
    const owner = await signIn();
    const other = await signIn();
    expect(
      (await workspace(request(owner, "GET", {}, "/api/account/workspace")))
        .status,
    ).toBe(200);
    expect(
      (await workspace(request(other, "GET", {}, "/api/account/workspace")))
        .status,
    ).toBe(200);
    await database.prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: randomUUID(),
        providerId: "github",
        userId: owner.userId,
      },
    });
    await database.prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: `auth-state:${randomUUID()}`,
        value: JSON.stringify({ link: { userId: owner.userId } }),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await remove(owner, await prepare(owner));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "better-auth.session_token=; Path=/; Max-Age=0",
    );

    const prisma = database.prisma;
    expect(
      await prisma.user.findUnique({ where: { id: owner.userId } }),
    ).toBeNull();
    expect(
      await prisma.session.count({ where: { userId: owner.userId } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: owner.userId } }),
    ).toBe(0);
    expect(
      await prisma.accountWorkspace.count({ where: { userId: owner.userId } }),
    ).toBe(0);
    expect(
      await prisma.verification.count({
        where: { value: { contains: owner.userId } },
      }),
    ).toBe(0);
    expect(
      await prisma.user.findUnique({ where: { id: other.userId } }),
    ).not.toBeNull();
    expect(
      await prisma.accountWorkspace.count({ where: { userId: other.userId } }),
    ).toBe(1);
  });

  it("requires a capability, the typed confirmation, and a same-origin request", async () => {
    const owner = await signIn();
    expect((await remove(owner)).status).toBe(400);
    const capability = await prepare(owner);
    const unconfirmed = await DELETE(
      request(owner, "DELETE", {
        body: { confirmation: "delete" },
        capability,
      }),
    );
    expect(unconfirmed.status).toBe(400);
    const crossOrigin = await DELETE(
      request(owner, "DELETE", {
        body: { confirmation: "DELETE" },
        capability,
        origin: "https://evil.example",
      }),
    );
    expect(crossOrigin.status).toBe(403);
    const other = await signIn();
    const foreign = await remove(other, capability);
    expect(foreign.status).toBe(403);
    expect(
      await database.prisma.user.count({ where: { id: owner.userId } }),
    ).toBe(1);
  });

  it("asks for a fresh sign-in when the session is older than the deletion window", async () => {
    const owner = await signIn();
    await database.prisma.session.update({
      where: { id: owner.sessionId },
      data: { createdAt: new Date(Date.now() - 60 * 60_000) },
    });
    const response = await POST(
      request(owner, "POST", { body: { intent: "prepare" } }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("reauthenticate");
  });

  it("settles an unknown outcome without replay: a cancelled attempt cannot delete later", async () => {
    const owner = await signIn();
    const capability = await prepare(owner);
    const settle = await PATCH(request(undefined, "PATCH", { capability }));
    expect(await settle.json()).toEqual({ deleted: false });
    const late = await remove(owner, capability);
    expect(late.status).toBe(409);
    expect((await late.json()).code).toBe("deletion_cancelled");
    expect(
      await database.prisma.user.count({ where: { id: owner.userId } }),
    ).toBe(1);

    const fresh = await prepare(owner);
    expect((await remove(owner, fresh)).status).toBe(200);
    const after = await PATCH(
      request(undefined, "PATCH", { capability: fresh }),
    );
    expect(await after.json()).toEqual({ deleted: true });
    const forged = await PATCH(
      request(undefined, "PATCH", { capability: `${fresh}x` }),
    );
    expect(forged.status).toBe(400);
  });
});
