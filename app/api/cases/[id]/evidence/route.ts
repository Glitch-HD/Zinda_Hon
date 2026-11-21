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
import { createHash } from "node:crypto";
import { followedSequence, verifyTicket } from "@/lib/liveness";

/** A fingerprint of the face numbers (not reversible to a face). A real selfie never repeats exactly. */
/** Best match of the QR's name against any run of the same number of words in the OCR text (0..1). */
function printedNameScore(ocrText: string, name: string) {
  const words = ocrText.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const n = name.split(/\s+/).filter(Boolean).length || 1;
  let best = 0;
  for (let i = 0; i + n <= words.length; i++) best = Math.max(best, nameSimilarity(words.slice(i, i + n).join(" "), name));
  return best;
}

const faceFingerprint = (d: number[]) => createHash("sha256").update(d.map((x) => x.toFixed(3)).join(",")).digest("hex").slice(0, 24);

// Receives one piece of proof from the phone. Each submission carries a clientActionId made on the phone,
// so if a weak connection makes the phone send it twice, the second copy is ignored (no duplicates).

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("face_match"), clientActionId: z.string().min(8).max(64), descriptor: z.array(z.number().finite()).length(128), quality: z.number().min(0).max(1).optional(), ticket: z.string().max(600).optional() }),
  z.object({
    type: z.literal("liveness"), clientActionId: z.string().min(8).max(64), passed: z.boolean(),
    challenges: z.array(z.object({ action: z.enum(["blink", "turn_left", "turn_right", "smile"]), done: z.boolean(), ms: z.number().nonnegative() })).max(6),
    ticket: z.string().max(600).optional(),
  }),
  z.object({ type: z.literal("document"), clientActionId: z.string().min(8).max(64), qrText: z.string().max(500).nullable(), ocrName: z.string().max(200).optional(), ocrText: z.string().max(1000).optional(), ocrConfidence: z.number().min(0).max(100).optional() }),
]);

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  // Staff cannot submit proof of life for a pensioner: otherwise an officer could "prove" a dead person
  // alive and have it approved. Only the pensioner, or a helper she has linked and consented to, can.
  const user = await requireUser(["PENSIONER", "HELPER"]);
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
    const fp = faceFingerprint(body.descriptor);
    const reused = await prisma.evidence.findFirst({ where: { type: "face_match", case: { pensionerId: c.pensionerId }, details: { path: ["fp"], equals: fp } }, select: { caseId: true } });
    // The selfie must come from the same server-issued liveness check as the movements, not from
    // a separate photo sent later: both carry the same one-time ticket.
    const t = verifyTicket(body.ticket, id);
    let livenessLinked = false;
    if (t.ok) {
      const [live, faceBefore] = await Promise.all([
        prisma.evidence.findFirst({ where: { caseId: id, type: "liveness", passed: true, details: { path: ["nonce"], equals: t.nonce } }, select: { id: true } }),
        prisma.evidence.findFirst({ where: { caseId: id, type: "face_match", details: { path: ["nonce"], equals: t.nonce } }, select: { id: true } }),
      ]);
      livenessLinked = Boolean(live) && !faceBefore;
    }
    details = {
      fp, reusedFrom: reused?.caseId ?? null, distance: score, quality: body.quality ?? null, nonce: t.ok ? t.nonce : null, livenessLinked,
      note: "Only the 128-number face descriptor was received; no photo stored." };
  } else if (body.type === "liveness") {
    // A person needs time to blink or turn; a script that just says "done" usually does not wait.
    const allDone = body.challenges.length >= 2 && body.challenges.every((ch) => ch.done && ch.ms >= 150);
    // The order of movements was chosen and signed by the server; each ticket can be used once.
    const t = verifyTicket(body.ticket, id);
    let ticket: string = t.ok ? "ok" : t.reason;
    if (t.ok) {
      const used = await prisma.evidence.findFirst({ where: { caseId: id, type: "liveness", details: { path: ["nonce"], equals: t.nonce } }, select: { id: true } });
      if (used) ticket = "reused";
      else if (!followedSequence(t.sequence, body.challenges)) ticket = "wrong_order";
    }
    passed = body.passed && allDone && ticket === "ok";
    details = { challenges: body.challenges, clientReported: body.passed, ticket, nonce: t.ok ? t.nonce : null, asked: t.ok ? t.sequence : null };
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
      // OCR of the printed page: does the name printed on the book match the name inside the QR?
      const ocrScore = body.ocrText ? printedNameScore(body.ocrText, f.name) : body.ocrName ? nameSimilarity(body.ocrName, f.name) : null;
      const ocrAgrees = ocrScore === null ? null : ocrScore >= 0.8;
      details = { qrValid: true, fieldsMatch, ocrAgrees, ocrScore: ocrScore === null ? null : Math.round(ocrScore * 100) / 100, ocrConfidence: body.ocrConfidence ?? null, ocrSample: body.ocrText?.slice(0, 160) ?? null, qrFields: f };
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
