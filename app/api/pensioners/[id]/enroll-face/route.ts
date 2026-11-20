import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { faceDistance } from "@/lib/case-service";
import { getActiveRule } from "@/lib/rules";

// Enrolment happens once, at the pension office, by an officer. Only the 128-number descriptor is stored.
// Safeguards against an insider swapping in someone else's face (for example to keep a dead
// pensioner's money flowing):
// - a face that already belongs to another pensioner in this office is refused;
// - replacing an existing face needs a written reason, is logged as "face_reenrolled", and puts this
//   year's case in front of an officer;
// - the enrolling officer may not approve this person's proof of life for a year (see the officer route).
const Body = z.object({ descriptor: z.array(z.number().finite()).length(128), reason: z.string().max(500).optional() });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER", "ADMIN"]);
  const { id } = await ctx.params;
  const { descriptor, reason } = Body.parse(await req.json());
  const p = await prisma.pensioner.findUnique({ where: { id } });
  if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Pensioner not found");

  const rule = await getActiveRule(user.tenantId);
  const others = await prisma.pensioner.findMany({ where: { tenantId: user.tenantId, id: { not: id } }, select: { id: true, pensionNo: true, enrolledFaceDescriptor: true } });
  const clash = others.find((o) => o.enrolledFaceDescriptor.length === 128 && (faceDistance(o.enrolledFaceDescriptor, descriptor) ?? 9) <= rule.config.face.strictDistance);
  if (clash) {
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "face_enrol_refused_same_face", targetType: "pensioner", targetId: id, details: { otherPensionNo: clash.pensionNo } });
    throw new HttpError(409, `This face is already enrolled for another pensioner (${clash.pensionNo}). One person cannot hold two pensions. This attempt was logged.`);
  }

  const reenrol = p.enrolledFaceDescriptor.length === 128;
  if (reenrol && (reason ?? "").trim().length < 10) {
    throw new HttpError(400, "This person already has a face enrolled. To replace it, write a reason of at least 10 characters (for example: old photo, eye surgery). This year's case will then go to an officer.");
  }
  await prisma.pensioner.update({ where: { id }, data: { enrolledFaceDescriptor: descriptor } });
  if (reenrol) {
    const year = new Date().getFullYear();
    const open = await prisma.case.findFirst({ where: { pensionerId: id, year, status: { notIn: ["VERIFIED", "STOPPED"] } } });
    if (open && !open.riskFlags.includes("face_reenrolled_this_year")) await prisma.case.update({ where: { id: open.id }, data: { riskFlags: [...open.riskFlags, "face_reenrolled_this_year"] } });
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: reenrol ? "face_reenrolled" : "face_enrolled", targetType: "pensioner", targetId: id, details: reenrol ? { reason } : undefined });
  return NextResponse.json({ ok: true, reenrolled: reenrol });
});
