import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

// "My pension was stopped by mistake": the pensioner (or her linked helper) asks for a re-check from
// the app, without travelling to the office. Nothing is restarted automatically. Every OTHER officer of
// the office is told, and the officer who stopped it may not be the one who reopens it.
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const { id } = await ctx.params;
  const c = await loadCaseFor(user, id, "case_status");
  if (c.status !== "STOPPED") throw new HttpError(409, "Only a stopped pension can be appealed");
  if (c.riskFlags.includes("appeal_requested")) return NextResponse.json({ ok: true, already: true });
  await rateLimit(`appeal:${id}`, 3, 86400);
  const stop = await prisma.decision.findFirst({ where: { caseId: id, outcome: "OFFICER_STOPPED" }, orderBy: { createdAt: "desc" }, select: { decidedBy: true } });
  await prisma.case.update({ where: { id }, data: { riskFlags: Array.from(new Set([...c.riskFlags, "appeal_requested"])), priority: Math.max(c.priority, 20) } });
  const officers = await prisma.user.findMany({ where: { tenantId: c.tenantId, role: "OFFICER", active: true, id: { not: stop?.decidedBy ?? "" } }, select: { id: true } });
  if (officers.length) {
    await prisma.notification.createMany({ data: officers.map((o) => ({ userId: o.id, title: "Appeal: stopped pension", body: `${c.pensioner.pensionNo} (${c.pensioner.name}) says the pension was stopped by mistake. Please check and reopen if needed.` })) });
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "appeal_requested", targetType: "case", targetId: id, details: { stoppedBy: stop?.decidedBy ?? null, actingFor: user.role === "HELPER" ? c.pensionerId : undefined } });
  return NextResponse.json({ ok: true });
});
