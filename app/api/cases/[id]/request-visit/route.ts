import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ reason: z.enum(["slow_network", "download_failed", "camera_problem", "other"]) });

// The light path. When the signal is too weak for the face check, or the camera will not work, the
// pensioner (or her helper) can ask for an officer to check in person instead. Her pension is not
// stopped and nothing is approved automatically: the case goes to an officer with the reason.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const { id } = await ctx.params;
  const { reason } = Body.parse(await req.json().catch(() => ({})));
  const c = await loadCaseFor(user, id, "case_status");
  if (["VERIFIED", "STOPPED"].includes(c.status)) throw new HttpError(409, "This case is already closed");
  if (c.riskFlags.includes("asked_for_home_visit") && c.status === "WITH_OFFICER") return NextResponse.json({ ok: true, already: true });

  let officerId = c.assignedOfficerId;
  if (!officerId) {
    const officers = await prisma.user.findMany({ where: { tenantId: c.tenantId, role: "OFFICER", active: true }, include: { _count: { select: { assignedCases: { where: { status: "WITH_OFFICER" } } } } } });
    officers.sort((a, b) => a._count.assignedCases - b._count.assignedCases);
    officerId = officers[0]?.id ?? null;
  }
  await prisma.case.update({ where: { id }, data: { status: "WITH_OFFICER", assignedOfficerId: officerId, riskFlags: Array.from(new Set([...c.riskFlags, "asked_for_home_visit"])), priority: Math.max(c.priority, 1) } });
  if (officerId) await prisma.notification.create({ data: { userId: officerId, title: "Home visit requested", body: `${c.pensioner.pensionNo}: ${reason.replaceAll("_", " ")}. Please check in person.` } });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "home_visit_requested", targetType: "case", targetId: id, details: { reason, actingFor: user.role === "HELPER" ? c.pensionerId : undefined } });
  return NextResponse.json({ ok: true });
});
