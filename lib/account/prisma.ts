import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalPrisma = globalThis as unknown as { versoPrisma?: PrismaClient };

/** Return one PostgreSQL client per server process, including across hot reloads.
 * @returns {PrismaClient} Shared adapter-backed client; throws when DATABASE_URL is missing.
 * @example const rows = await getPrisma().$queryRaw`SELECT 1`
 */
export function getPrisma(): PrismaClient {
  if (globalPrisma.versoPrisma) return globalPrisma.versoPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  globalPrisma.versoPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return globalPrisma.versoPrisma;
}
