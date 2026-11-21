import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Pages run their database lookups side by side (Promise.all). With connection_limit=1 in the pooled
// URL they would still queue on one connection, so allow a few. The pooler (pgbouncer) shares them.
function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  return /connection_limit=1(?!\d)/.test(url) ? url.replace(/connection_limit=1(?!\d)/, "connection_limit=4") : url;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
