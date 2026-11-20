import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { faceDistance } from "@/lib/case-service";
import { verifyPensionBookQr } from "@/lib/qr";
import { nameSimilarity, normalizeCnic } from "@/lib/names";

// Receives one piece of proof from the phone. Each submission carries a clientActionId made on the phone,
// so if a weak connection makes the phone send it twice, the second copy is ignored (no duplicates).

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("face_match"), clientActionId: z.string().min(8).max(64), descriptor: z.array(z.number().finite()).length(128), quality: z.number().min(0).max(1).optional() }),
  z.object({
    type: z.literal("liveness"), clientActionId: z.string().min(8).max(64), passed: z.boolean(),
    challenges: z.array(z.object({ action: z.enum(["blink", "turn_left", "turn_right", "smile"]), done: z.boolean(), ms: z.number().nonnegative() })).max(6),
  }),
  z.object({ type: z.literal("document"), clientActionId: z.string().min(8).max(64), qrText: z.string().max(500).nullable(), ocrName: z.string().max(200).optional() }),
]);

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER", "OFFICER"]);
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const c = await loadCaseFor(user, id, body.type === "face_match" || body.type === "liveness" ? "face" : "case_status");
  if (["VERIFIED", "STOPPED"].includes(c.status)) throw new HttpError(409, "This case is already closed");

  const dup = await prisma.caseStep.findUnique({ where: { clientActionId: body.clientActionId } });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  let score: number | null = null;
  let passed: boolean | null = null;
  let details: Record<string, unknown> = {};

  if (body.type === "face_match") {
    const enrolled = c.pensioner.enrolledFaceDescriptor;
    if (enrolled.length !== 128) throw new HttpError(409, "No enrolled face for this pensioner yet. An officer must enrol it first.");
    score = faceDistance(enrolled, body.descriptor);
    details = { distance: score, quality: body.quality ?? null, note: "Only the 128-number face descriptor was received; no photo stored." };
  } else if (body.type === "liveness") {
    const allDone = body.challenges.length >= 2 && body.challenges.every((ch) => ch.done);
    passed = body.passed && allDone;
    details = { challenges: body.challenges, clientReported: body.passed };
  } else {
    const qr = verifyPensionBookQr(body.qrText);
    if (!qr.readable) {
      details = { qrValid: null, fieldsMatch: null, reason: "QR not readable" };
    } else if (!qr.signatureValid || !qr.fields) {
      details = { qrValid: false, fieldsMatch: false, reason: "Signature does not match: the book was edited or is not ours" };
    } else {
      const f = qr.fields;
      const fieldsMatch =
        f.pensionNo === c.pensioner.pensionNo &&
        f.monthlyAmount === c.pensioner.monthlyAmount &&
        nameSimilarity(f.name, c.pensioner.name) >= 0.92 &&
        (normalizeCnic(f.cnic) === normalizeCnic(c.pensioner.cnicMock) || !c.pensioner.cnicMock);
      const ocrAgrees = body.ocrName ? nameSimilarity(body.ocrName, f.name) >= 0.8 : null;
      details = { qrValid: true, fieldsMatch, ocrAgrees, qrFields: f };
    }
    passed = details.qrValid === true && details.fieldsMatch === true;
  }

  await prisma.$transaction([
    prisma.caseStep.create({ data: { caseId: id, step: body.type, result: JSON.stringify({ score, passed }), clientActionId: body.clientActionId } }),
    prisma.evidence.create({ data: { caseId: id, type: body.type, score, passed, details: details as object } }),
    prisma.case.update({ where: { id }, data: { status: c.status === "DUE" ? "IN_PROGRESS" : c.status } }),
  ]);
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `evidence_${body.type}`, targetType: "case", targetId: id, details: { score, passed, actingFor: user.role === "HELPER" ? c.pensionerId : undefined } });
  return NextResponse.json({ ok: true, score, passed, details: body.type === "document" ? { qrValid: details.qrValid, fieldsMatch: details.fieldsMatch } : undefined });
});
