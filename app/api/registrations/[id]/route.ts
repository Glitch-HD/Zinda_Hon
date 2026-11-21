import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).default("") });

// An officer checks a sign-up and approves (the account is created) or rejects it with a reason.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER"]);
  const { id } = await ctx.params;
  const { action, note } = Body.parse(await req.json());
  const r = await prisma.registration.findUnique({ where: { id } });
  if (!r || r.tenantId !== user.tenantId) throw new HttpError(404, "Sign-up not found");
  if (r.status !== "pending") throw new HttpError(409, `Already ${r.status}`);
  if (action === "reject" && note.trim().length < 5) throw new HttpError(400, "Write a short reason for rejecting");
  const checks = r.checks as { deathRecordFound?: boolean; nadraFound?: boolean; nameSimilarity?: number | null; pensionCnicMatches?: boolean | null; pensionTypeMismatch?: boolean; husbandDeathFound?: boolean; husbandDeathDateMatches?: boolean | null };
  const details = (r.details ?? {}) as { pensionType?: string | null };
  if (action === "approve") {
    if (checks.deathRecordFound) throw new HttpError(409, "The death registry has a record for this CNIC. This sign-up cannot be approved.");
    const widowUnproven = details.pensionType === "family" && (!checks.husbandDeathFound || checks.husbandDeathDateMatches === false);
    // A pensioner account is the key to her money, and a son can know her CNIC and pension number.
    // So the officer must always say how they confirmed it is really her (call, visit, or office).
    const isPensioner = r.role === "PENSIONER";
    const doubtful = isPensioner || !checks.nadraFound || (checks.nameSimilarity ?? 0) < 0.8 || checks.pensionCnicMatches === false || checks.pensionTypeMismatch || widowUnproven || Boolean(r.assistedBy);
    if (doubtful && note.trim().length < 20) throw new HttpError(400, widowUnproven ? "The death registry does not confirm her husband's death. Write at least 20 characters on how you checked it (for example, saw the original death certificate)." : r.assistedBy ? "Someone else filled this form for her. Write at least 20 characters on how you confirmed it is really her (for example, called her or met her)." : isPensioner && !(!checks.nadraFound || (checks.nameSimilarity ?? 0) < 0.8 || checks.pensionCnicMatches === false || checks.pensionTypeMismatch) ? "A pensioner account controls her pension. Write at least 20 characters on how you confirmed it is really her and her phone (for example, called the number on her pension file, or met her)." : "The records do not fully match. Write at least 20 characters on how you checked this person (for example, saw the original CNIC at the office).");
    if (await prisma.user.findUnique({ where: { phone: r.phone } })) throw new HttpError(409, "This phone number already has an account");
    const pensioner = r.role === "PENSIONER" && r.pensionNo ? await prisma.pensioner.findUnique({ where: { pensionNo: r.pensionNo } }) : null;
    if (r.role === "PENSIONER" && (!pensioner || pensioner.userId)) throw new HttpError(409, "This pension already has an account");
    const claimed = await prisma.registration.updateMany({ where: { id, status: "pending" }, data: { status: "approved", decidedBy: user.id, decidedNote: note, decidedAt: new Date() } });
    if (!claimed.count) throw new HttpError(409, "Someone else decided this first");
    const created = await prisma.user.create({ data: { tenantId: r.tenantId, role: r.role as never, name: r.name, phone: r.phone, passwordHash: r.passwordHash, pinHash: r.pinHash, area: r.area ?? pensioner?.area ?? null } });
    if (pensioner) await prisma.pensioner.update({ where: { id: pensioner.id }, data: { userId: created.id } });
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "registration_approved", targetType: "user", targetId: created.id, details: { registrationId: id, role: r.role, note, checks, answers: r.details, assistedBy: r.assistedBy } });
  } else {
    await prisma.registration.update({ where: { id }, data: { status: "rejected", decidedBy: user.id, decidedNote: note, decidedAt: new Date() } });
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "registration_rejected", targetType: "registration", targetId: id, details: { note } });
  }
  return NextResponse.json({ ok: true });
});
