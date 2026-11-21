import { prisma } from "./db";
import { HttpError } from "./auth";

// Simple database-backed rate limiter. Works across serverless instances because the count lives in Postgres.
export async function rateLimit(bucket: string, max: number, windowSeconds: number) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  // One round trip: count the recent hits and, only if under the limit, record this one. (The main SELECT
  // sees the table as it was before the INSERT in the same statement, so it returns the earlier count.)
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    WITH ins AS (
      INSERT INTO "RateLimitHit" (id, bucket, "createdAt")
      SELECT ${crypto.randomUUID()}, ${bucket}, now()
      WHERE (SELECT count(*) FROM "RateLimitHit" WHERE bucket = ${bucket} AND "createdAt" >= ${since}) < ${max}
    )
    SELECT count(*)::int AS n FROM "RateLimitHit" WHERE bucket = ${bucket} AND "createdAt" >= ${since}`;
  if ((rows[0]?.n ?? 0) >= max) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  // Opportunistic cleanup of old rows (1 in 50 requests).
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 25 * 3600_000) } } }).catch(() => undefined);
  }
}
