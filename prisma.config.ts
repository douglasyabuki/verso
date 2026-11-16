import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

// `prisma generate` must work without a database so guest-only builds succeed;
// migrate/studio commands report a missing DATABASE_URL themselves.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
