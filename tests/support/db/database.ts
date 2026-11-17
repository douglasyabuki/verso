import { createHmac, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

export type TestDatabase = {
  db: PGlite;
  prisma: PrismaClient;
  /** SQL statements issued through Prisma since the last `take()`. */
  queries: { take(): string[] };
  close(): Promise<void>;
};

/** Start an isolated in-process Postgres with every checked-in migration applied,
 * and install its client as the server singleton used by `getPrisma()`.
 * @returns {Promise<TestDatabase>} Raw PGlite handle, Prisma client, and cleanup.
 * @example const database = await startTestDatabase(); afterAll(() => database.close())
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create();
  const root = path.resolve("prisma/migrations");
  const migrations = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations)
    await db.exec(
      await readFile(path.join(root, name, "migration.sql"), "utf8"),
    );
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: `postgresql://postgres@${server.getServerConn()}/postgres`,
      max: 1,
    }),
    log: [{ emit: "event", level: "query" }],
  });
  let log: string[] = [];
  prisma.$on("query", (event) => log.push(event.query));
  const global = globalThis as { versoPrisma?: PrismaClient };
  global.versoPrisma = prisma;
  return {
    db,
    prisma,
    queries: {
      take() {
        const taken = log;
        log = [];
        return taken;
      },
    },
    async close() {
      await prisma.$disconnect();
      await server.stop();
      await db.close();
      if (global.versoPrisma === prisma) delete global.versoPrisma;
    },
  };
}

/** Create a user row the way Better Auth would after a provider sign-in.
 * @param prisma Test client.
 * @param id Opaque user ID.
 * @returns {Promise<string>} The created user ID.
 * @example const userId = await createUser(database.prisma, "user-a")
 */
export async function createUser(
  prisma: PrismaClient,
  id: string,
): Promise<string> {
  await prisma.user.create({
    data: { id, name: id, email: `${id}@example.test` },
  });
  return id;
}

/** Insert a Better Auth database session and build its signed cookie.
 * Requires BETTER_AUTH_SECRET to be set before calling.
 * @param prisma Test client.
 * @param userId Owner.
 * @param expiresAt Session expiry, default one day ahead.
 * @returns Session ID (for the session-binding header) and Cookie header value.
 * @example const { sessionId, cookie } = await createSession(prisma, userId)
 */
export async function createSession(
  prisma: PrismaClient,
  userId: string,
  expiresAt = new Date(Date.now() + 86_400_000),
): Promise<{ sessionId: string; cookie: string }> {
  const sessionId = randomUUID();
  const token = randomUUID();
  await prisma.session.create({
    data: { id: sessionId, userId, token, expiresAt },
  });
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(token)
    .digest("base64");
  return {
    sessionId,
    cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
  };
}
