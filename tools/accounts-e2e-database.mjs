// Isolated in-process Postgres for account end-to-end tests. Applies the
// checked-in migrations to a fresh in-memory database, serves it over the
// Postgres wire protocol, and answers a readiness check. Never point account
// tests at shared or hosted data.
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const dbPort = Number(process.env.ACCOUNTS_E2E_DB_PORT ?? 54329);
const healthPort = Number(process.env.ACCOUNTS_E2E_HEALTH_PORT ?? 54330);

const db = await PGlite.create();
const root = path.resolve("prisma/migrations");
const migrations = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
for (const name of migrations)
  await db.exec(await readFile(path.join(root, name, "migration.sql"), "utf8"));

const server = new PGLiteSocketServer({
  db,
  port: dbPort,
  host: "127.0.0.1",
  maxConnections: 20,
});
await server.start();

createServer((_, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("ready");
}).listen(healthPort, "127.0.0.1");

console.log(`Account test database ready on 127.0.0.1:${dbPort}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
