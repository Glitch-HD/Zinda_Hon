import { prisma } from "./db";
import { HttpError } from "./auth";

// Simple database-backed rate limiter. Works across serverless instances because the count lives in Postgres.
export async function rateLimit(bucket: string, max: number, windowSeconds: number) {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await prisma.rateLimitHit.count({ where: { bucket, createdAt: { gte: since } } });
  if (count >= max) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  await prisma.rateLimitHit.create({ data: { bucket } });
  // Opportunistic cleanup of old rows (1 in 50 requests).
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3600_000) } } }).catch(() => undefined);
  }
}
