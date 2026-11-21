import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeName } from "@/lib/names";
import { cleanCorrectionValue as cleanValue } from "@/lib/corrections";

// An officer accepts or rejects a "correct my data" request. Changing WHERE THE MONEY GOES (bank
// account) or WHO SHE IS (CNIC) is how pensions are stolen, so those need two different officers:
// the first one only proposes, the second one applies it. The officer who proposed cannot apply it.
const Body = z.object({ action: z.enum(["accept", "reject"]), note: z.string().max(500).default("") });
const HIGH_RISK = ["bankAccountNo", "cnicMock"];

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER"]);
  const { id } = await ctx.params;
  const { action, note } = Body.parse(await req.json());
  const r = await prisma.dataCorrectionRequest.findUnique({ where: { id }, include: { pensioner: true } });
  if (!r || r.pensioner.tenantId !== user.tenantId) throw new HttpError(404, "Request not found");
  if (!["pending", "awaiting_second"].includes(r.status)) throw new HttpError(409, `Already ${r.status}`);
  if (note.trim().length < 10) throw new HttpError(400, "Write at least 10 characters on how you checked this (for example: saw her bank letter)");
  const highRisk = HIGH_RISK.includes(r.field);
  const base = { tenantId: user.tenantId, actorType: "USER" as const, actorId: user.id, actorRole: user.role, targetType: "pensioner", targetId: r.pensionerId };

  if (action === "reject") {
    const done = await prisma.dataCorrectionRequest.updateMany({ where: { id, status: r.status }, data: { status: "rejected", resolvedAt: new Date() } });
    if (!done.count) throw new HttpError(409, "Someone else decided this first");
    await audit({ ...base, action: "correction_rejected", details: { requestId: id, field: r.field, note } });
  } else {
    const value = cleanValue(r.field, r.newValue);
    if (highRisk && r.status === "pending") {
      // Step 1 of 2: propose. Nothing changes yet.
      await prisma.dataCorrectionRequest.update({ where: { id }, data: { status: "awaiting_second" } });
      await audit({ ...base, action: "correction_proposed", details: { requestId: id, field: r.field, note } });
      const others = await prisma.user.findMany({ where: { tenantId: user.tenantId, role: "OFFICER", active: true, id: { not: user.id } }, select: { id: true } });
      await prisma.notification.createMany({ data: others.map((o) => ({ userId: o.id, title: "Second officer needed", body: `${user.name} wants to change the ${r.field === "bankAccountNo" ? "bank account" : "CNIC"} of ${r.pensioner.pensionNo}. Please check and confirm or refuse.` })) });
      return NextResponse.json({ ok: true, pending: true, message: "Proposed. Because this changes the bank account or CNIC, a second officer must confirm it." }, { status: 202 });
    }
    if (highRisk) {
      const proposal = await prisma.auditLog.findFirst({ where: { action: "correction_proposed", targetId: r.pensionerId, details: { path: ["requestId"], equals: id } }, orderBy: { createdAt: "desc" } });
      if (!proposal || proposal.actorId === user.id) throw new HttpError(403, "You proposed this change. A different officer must confirm it.");
    }
    const claimed = await prisma.dataCorrectionRequest.updateMany({ where: { id, status: r.status }, data: { status: "accepted", resolvedAt: new Date() } });
    if (!claimed.count) throw new HttpError(409, "Someone else decided this first");
    await prisma.pensioner.update({
      where: { id: r.pensionerId },
      data: r.field === "name" ? { name: value as string, nameNormalized: normalizeName(value as string) } : { [r.field]: value },
    });
    // A new bank account or CNIC is exactly what a thief would ask for: this year's open case goes to an officer.
    if (highRisk) {
      const open = await prisma.case.findFirst({ where: { pensionerId: r.pensionerId, year: new Date().getFullYear(), status: { notIn: ["VERIFIED", "STOPPED"] } } });
      const flag = r.field === "bankAccountNo" ? "bank_account_changed_this_year" : "cnic_changed_this_year";
      if (open && !open.riskFlags.includes(flag)) await prisma.case.update({ where: { id: open.id }, data: { riskFlags: [...open.riskFlags, flag] } });
    }
    if (r.pensioner.userId) await prisma.notification.create({ data: { userId: r.pensioner.userId, title: "Your details were corrected", body: `An officer changed your ${r.field === "bankAccountNo" ? "bank account" : r.field === "cnicMock" ? "CNIC" : r.field === "dateOfBirth" ? "date of birth" : "name"} as you asked. If you did not ask for this, tell the pension office at once.` } });
    await audit({ ...base, action: "correction_accepted", details: { requestId: id, field: r.field, oldValue: highRisk ? "(hidden)" : r.oldValue, note, secondOfficer: highRisk } });
  }
  return NextResponse.json({ ok: true });
});
