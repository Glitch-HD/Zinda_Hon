import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getActiveRule } from "@/lib/rules";

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

  if (action === "assign_to_me") {
    await prisma.case.update({ where: { id }, data: { assignedOfficerId: user.id } });
  } else {
    if (["VERIFIED", "STOPPED"].includes(c.status)) throw new HttpError(409, "This case is already closed");
    if (action === "stop" && note.trim().length < 10) throw new HttpError(400, "Write a reason of at least 10 characters before stopping a pension");
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
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `officer_${action}`, targetType: "case", targetId: id, details: { note } });
  return NextResponse.json({ ok: true });
});
