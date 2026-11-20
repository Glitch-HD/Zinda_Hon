import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getActiveRule } from "@/lib/rules";
import { lookupIdentity } from "@/lib/case-service";

/** Why approving this case is risky, if it is. Read live from the records, not from cached flags. */
async function approvalRisks(caseId: string, pensionerId: string, riskFlags: string[]) {
  const [identity, face, live] = await Promise.all([
    lookupIdentity(pensionerId),
    prisma.evidence.count({ where: { caseId, type: "face_match" } }),
    prisma.evidence.count({ where: { caseId, type: "liveness" } }),
  ]);
  const risks: string[] = [];
  if (identity.death) risks.push("death_record_found");
  if (identity.anomalies.includes("bank_activity_after_death")) risks.push("bank_activity_after_death");
  if (identity.duplicates.length) risks.push("duplicate_person_records");
  if (identity.cnicMatch === false) risks.push("cnic_mismatch");
  if (!face || !live) risks.push("no_proof_of_life_this_year");
  for (const f of riskFlags) if (!risks.includes(f)) risks.push(f);
  return risks;
}

// The human side of "I am not sure": only an officer can stop a pension, and must write a reason.
const Body = z.object({
  action: z.enum(["approve", "stop", "ask_more_proof", "assign_to_me"]),
  note: z.string().max(2000).default(""),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER"]);
  const { id } = await ctx.params;
  const { action, note } = Body.parse(await req.json());
  const c = await prisma.case.findUnique({ where: { id } });
  if (!c || c.tenantId !== user.tenantId) throw new HttpError(404, "Case not found");

  let risky: string[] = [];
  if (action === "assign_to_me") {
    await prisma.case.update({ where: { id }, data: { assignedOfficerId: user.id } });
  } else {
    if (["VERIFIED", "STOPPED"].includes(c.status)) throw new HttpError(409, "This case is already closed");
    if (action === "stop" && note.trim().length < 10) throw new HttpError(400, "Write a reason of at least 10 characters before stopping a pension");
    if (action === "approve") {
      // Separation of duties: the officer who enrolled (or re-enrolled) this person's face in the last
      // year may not also approve their proof of life. Otherwise one officer could enrol someone else's
      // face for a dead pensioner and then approve it.
      const enrolledByMe = await prisma.auditLog.findFirst({
        where: { action: { in: ["face_enrolled", "face_reenrolled"] }, actorId: user.id, targetId: c.pensionerId, createdAt: { gte: new Date(Date.now() - 365 * 86400000) } },
      });
      if (enrolledByMe) throw new HttpError(403, "You enrolled this person's face this year, so another officer must approve their proof of life.");
      risky = await approvalRisks(id, c.pensionerId, c.riskFlags);
      if (risky.length && note.trim().length < 30) {
        throw new HttpError(400, `This case has open risks (${risky.map((r) => r.replaceAll("_", " ")).join(", ")}). To approve anyway, write at least 30 characters on how you checked it (for example a home visit). The auditor sees every risky approval.`);
      }
    }
    const rule = await getActiveRule(user.tenantId);
    const status = action === "approve" ? "VERIFIED" : action === "stop" ? "STOPPED" : "NEEDS_PROOF";
    const reasons = {
      approve: { en: "A pension officer checked your case and approved it. Your pension continues.", ur: "پنشن افسر نے آپ کا کیس دیکھ کر منظور کر دیا۔ آپ کی پنشن جاری رہے گی۔" },
      stop: { en: "A pension officer has stopped this pension after review. You can ask for the decision to be checked again.", ur: "جانچ کے بعد پنشن افسر نے یہ پنشن روک دی ہے۔ آپ دوبارہ جانچ کی درخواست کر سکتے ہیں۔" },
      ask_more_proof: { en: "A pension officer needs more proof from you.", ur: "پنشن افسر کو آپ سے مزید ثبوت چاہیے۔" },
    }[action];
    await prisma.$transaction([
      prisma.decision.create({
        data: {
          caseId: id, outcome: action === "approve" ? "OFFICER_APPROVED" : action === "stop" ? "OFFICER_STOPPED" : "ASK_MORE_PROOF",
          confidence: 1, ruleVersionId: rule.id, inputs: { note }, checkScores: [], reasonEn: reasons.en, reasonUr: reasons.ur,
          auditTrace: { decidedBy: "officer", officerId: user.id, note, ruleVersion: rule.version }, decidedBy: user.id,
        },
      }),
      prisma.case.update({ where: { id }, data: { status, officerNotes: note || c.officerNotes, closedAt: status === "NEEDS_PROOF" ? null : new Date() } }),
    ]);
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `officer_${action}`, targetType: "case", targetId: id, details: { note, ...(risky.length ? { riskyApproval: true, risks: risky } : {}) } });
  return NextResponse.json({ ok: true });
});
