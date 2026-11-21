import { prisma } from "./db";
import { runSeed } from "./demo-seed";

/**
 * Wipes every table (faces, cases, evidence, decisions, AI runs, sign-ups, scam reports, audit log,
 * mock NADRA faces, everything) and re-creates the fresh demo data with the same accounts.
 * The migrations table is kept, so the database structure stays as it is.
 * The audit log is NOT wiped: it is append-only at the database level, and a reset must not be a way
 * around that. The fresh demo gets new office (tenant) ids, so the old entries no longer show on any
 * screen, but they are still in the database for anyone who checks.
 */
export async function resetDemoData() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename NOT IN ('_prisma_migrations', 'AuditLog')`;
  if (!tables.length) throw new Error("No tables found");
  // Names come from the database catalogue, not from the request.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename.replaceAll('"', '""')}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await runSeed(prisma);
}
