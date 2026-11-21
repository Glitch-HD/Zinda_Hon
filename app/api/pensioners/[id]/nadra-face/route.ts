import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPensionerAccess } from "@/lib/consent";
import { faceDistance } from "@/lib/case-service";
import { getActiveRule } from "@/lib/rules";
import { nadraRecordForCnic, photoAgeYears, OLD_PHOTO_YEARS } from "@/lib/nadra-face";

// No office visit: with the pensioner's consent, her face print is fetched from her CNIC photo at
// (simulated) NADRA. Her live scan is then matched against it during proof of life, as before.
// If NADRA has no usable photo, office or home-visit enrolment by an officer stays as the fallback.
const Body = z.object({ consent: z.literal(true) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "She must agree first: press 'Yes, get my CNIC photo from NADRA'.");
  await assertPensionerAccess(user, id, "face");
  const p = await prisma.pensioner.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, "Pensioner not found");
  if (p.enrolledFaceDescriptor.length === 128) return NextResponse.json({ ok: true, already: true, source: p.faceSource ?? "office" });

  const rec = await nadraRecordForCnic(p.cnicMock);
  if (!rec || rec.faceDescriptor.length !== 128) {
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "nadra_face_not_found", targetType: "pensioner", targetId: id });
    throw new HttpError(404, "NADRA (simulated) has no CNIC photo for this person. An officer can enrol the face at the office, or during a home visit with a helper.");
  }

  // One face, one pension: refuse a NADRA face that already belongs to another pensioner here.
  const rule = await getActiveRule(user.tenantId);
  const others = await prisma.pensioner.findMany({ where: { tenantId: p.tenantId, id: { not: id } }, select: { pensionNo: true, enrolledFaceDescriptor: true } });
  const clash = others.find((o) => o.enrolledFaceDescriptor.length === 128 && (faceDistance(o.enrolledFaceDescriptor, rec.faceDescriptor) ?? 9) <= rule.config.face.strictDistance);
  if (clash) {
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "face_enrol_refused_same_face", targetType: "pensioner", targetId: id, details: { source: "nadra", otherPensionNo: clash.pensionNo } });
    throw new HttpError(409, `This CNIC photo matches another pensioner (${clash.pensionNo}). One person cannot hold two pensions. An officer will check; this was logged.`);
  }

  const age = photoAgeYears(rec.photoTakenAt);
  await prisma.$transaction([
    prisma.pensioner.update({ where: { id }, data: { enrolledFaceDescriptor: rec.faceDescriptor, faceSource: "nadra" } }),
    prisma.consent.create({ data: { pensionerId: id, granteeType: "nadra", granteeId: "nadra", granteeName: "NADRA (simulated): my CNIC photo, for the face check only", fields: ["face"] } }),
  ]);
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "face_from_nadra", targetType: "pensioner", targetId: id, details: { consent: true, byHelper: user.role === "HELPER", photoAgeYears: age } });
  return NextResponse.json({ ok: true, source: "nadra", photoAgeYears: age, oldPhoto: age !== null && age >= OLD_PHOTO_YEARS });
});
