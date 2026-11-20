import { prisma } from "./db";

// Error monitoring inside the app. Every unexpected server error, and every crash on a person's phone,
// is saved here so the admin sees it on the System health card. Recording an error must never cause a
// second error, so everything is wrapped and cut short.

const cut = (s: unknown, n: number) => (typeof s === "string" ? s : s == null ? "" : String(s)).slice(0, n);

/** Removes things that look like phone numbers, CNICs or long digit runs, so no personal data is stored. */
export function scrub(s: string) {
  return s.replace(/\d{5}-?\d{7}-?\d/g, "[cnic]").replace(/\b0?3\d{2}-?\d{7}\b/g, "[phone]").replace(/\d{9,}/g, "[number]");
}

export async function recordError(e: { source: "server" | "client"; route?: string | null; error?: unknown; message?: string; stack?: string | null; userId?: string | null; tenantId?: string | null }) {
  try {
    const err = e.error instanceof Error ? e.error : null;
    const message = scrub(cut(e.message ?? err?.message ?? e.error ?? "Unknown error", 300)) || "Unknown error";
    const stack = e.stack ?? err?.stack ?? null;
    await prisma.errorEvent.create({
      data: { source: e.source, route: cut(e.route, 200) || null, message, stack: stack ? scrub(cut(stack, 2000)) : null, userId: e.userId ?? null, tenantId: e.tenantId ?? null },
    });
    // Keep the table small: drop rows older than 30 days now and then.
    if (Math.random() < 0.02) await prisma.errorEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  } catch {
    /* never let monitoring break the request */
  }
}

/** Errors in the last 24 hours grouped by message, for the System health card. */
export async function errorSummary(hours = 24) {
  const since = new Date(Date.now() - hours * 3600_000);
  const rows = await prisma.errorEvent.groupBy({ by: ["source", "message"], where: { createdAt: { gte: since } }, _count: { _all: true }, _max: { createdAt: true, route: true }, orderBy: { _count: { message: "desc" } }, take: 10 });
  const total = await prisma.errorEvent.count({ where: { createdAt: { gte: since } } });
  return { total, groups: rows.map((r) => ({ source: r.source, message: r.message, count: r._count._all, last: r._max.createdAt, route: r._max.route })) };
}
