import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getActiveRule } from "@/lib/rules";
import { lookupIdentity } from "@/lib/case-service";
import { ownWords } from "@/lib/officer-notes";

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

/** Risks so serious that one officer alone may not approve: a second, different officer must agree. */
const HARD_RISKS = ["death_record_found", "bank_activity_after_death", "cnic_mismatch", "duplicate_person_records", "face_numbers_reused", "face_not_from_liveness_check", "face_too_identical_possible_replay", "ai_assistant_said_investigate"];

// The human side of "I am not sure": only an officer can stop a pension, and must write a reason.
const Body = z.object({
  action: z.enum(["approve", "stop", "ask_more_proof", "assign_to_me", "reopen"]),
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
  } else if (action === "reopen") {
    // A closed case (approved or stopped) goes back to the review queue, e.g. new facts or an appeal.
    // It is never re-decided here: approving or stopping again follows all the usual rules.
    if (!["VERIFIED", "STOPPED"].includes(c.status)) throw new HttpError(409, "Only a closed case can be reopened");
    if (note.trim().length < 15) throw new HttpError(400, "Write why you are reopening this case (at least 15 characters)");
    const was = c.status;
    await prisma.case.update({ where: { id }, data: { status: "WITH_OFFICER", closedAt: null, assignedOfficerId: user.id, priority: Math.max(c.priority, 5), officerNotes: note, riskFlags: c.riskFlags.filter((f) => f !== "approval_needs_second_officer") } });
    const p = await prisma.pensioner.findUnique({ where: { id: c.pensionerId }, select: { userId: true } });
    if (p?.userId) await prisma.notification.create({ data: { userId: p.userId, title: "Your case is being checked again", body: was === "STOPPED" ? "A pension officer has reopened your case to check it again." : "A pension officer has reopened this year's case to check something again. Your pension is not stopped." } });
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "officer_reopen", targetType: "case", targetId: id, details: { note, previousStatus: was } });
    return NextResponse.json({ ok: true });
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
      risky = await approvalRisks(id, c.pensionerId, c.riskFlags.filter((f) => f !== "approval_needs_second_officer"));
      // The AI case assistant's latest advice counts too: if it said "investigate before paying", approving is a hard risk.
      const lastRun = await prisma.agentRun.findFirst({ where: { caseId: id, status: "done" }, orderBy: { createdAt: "desc" }, select: { report: true } });
      if ((lastRun?.report as { recommendation?: string } | null)?.recommendation === "investigate_stop") risky.push("ai_assistant_said_investigate");
      const own = ownWords(note);
      if (risky.length && own.length < 30) {
        throw new HttpError(400, `This case has open risks (${risky.map((r) => r.replaceAll("_", " ")).join(", ")}). To approve anyway, write at least 30 characters in your own words on how you checked it (for example a home visit). Text pasted from the AI assistant does not count.`);
      }
      const hard = risky.filter((r) => HARD_RISKS.includes(r));
      if (hard.length) {
        // Four-eyes: the first officer only proposes the approval; a different officer must confirm it.
        const lastDecision = await prisma.decision.findFirst({ where: { caseId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
        const proposal = await prisma.auditLog.findFirst({ where: { action: "officer_approval_proposed", targetId: id, ...(lastDecision ? { createdAt: { gt: lastDecision.createdAt } } : {}) }, orderBy: { createdAt: "desc" } });
        if (!proposal || proposal.actorId === user.id) {
          if (proposal) throw new HttpError(409, "You already proposed approving this case. A second officer must confirm it; you cannot confirm your own.");
          await prisma.case.update({ where: { id }, data: { riskFlags: Array.from(new Set([...c.riskFlags, "approval_needs_second_officer"])), priority: Math.max(c.priority, 10), officerNotes: note || c.officerNotes } });
          const others = await prisma.user.findMany({ where: { tenantId: user.tenantId, role: "OFFICER", active: true, id: { not: user.id } }, select: { id: true } });
          await prisma.notification.createMany({ data: others.map((o) => ({ userId: o.id, title: "Second officer needed", body: `${user.name} wants to approve a case with serious risks (${hard.map((r) => r.replaceAll("_", " ")).join(", ")}). Please check and confirm or refuse.` })) });
          await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "officer_approval_proposed", targetType: "case", targetId: id, details: { note, ownWords: own, risks: risky } });
          return NextResponse.json({ ok: true, pending: true, message: `Not approved yet. Because of ${hard.map((r) => r.replaceAll("_", " ")).join(", ")}, a second officer must confirm this approval. The case stays in the review queue.` }, { status: 202 });
        }
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
      prisma.case.update({ where: { id }, data: { status, riskFlags: c.riskFlags.filter((f) => f !== "approval_needs_second_officer"), officerNotes: note || c.officerNotes, closedAt: status === "NEEDS_PROOF" ? null : new Date() } }),
    ]);
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `officer_${action}`, targetType: "case", targetId: id, details: { note, ...(risky.length ? { riskyApproval: true, risks: risky } : {}) } });
  return NextResponse.json({ ok: true });
});
