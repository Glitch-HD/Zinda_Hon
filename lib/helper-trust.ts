import { prisma } from "./db";

// Helper trust score. A helper (social worker) can act for many families, which is exactly where
// insider fraud hides. This score sums up the helper's record so an officer sees it on every case the
// helper touched, and the admin sees all helpers side by side. It never blocks anyone by itself:
// it tells the officer how closely to look.

export type HelperTrust = {
  helperId: string; name: string; score: number; level: "good" | "watch" | "risky";
  families: number; proofsThisYear: number; points: { text: string; delta: number }[];
};

export async function helperTrust(helperId: string, now = new Date()): Promise<HelperTrust | null> {
  const helper = await prisma.user.findUnique({ where: { id: helperId }, select: { id: true, name: true, role: true } });
  if (!helper || helper.role !== "HELPER") return null;
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [families, faceSteps, withdrawn, refused, visits] = await Promise.all([
    prisma.helperLink.count({ where: { helperId, active: true } }),
    prisma.auditLog.findMany({ where: { action: "evidence_face_match", actorId: helperId }, select: { targetId: true, createdAt: true } }),
    prisma.consent.count({ where: { granteeId: helperId, withdrawnAt: { not: null } } }),
    prisma.auditLog.count({ where: { actorId: helperId, action: { in: ["correction_refused_sensitive_field", "access_denied_no_consent"] } } }),
    prisma.auditLog.count({ where: { actorId: helperId, action: "home_visit_requested" } }),
  ]);
  const caseIds = [...new Set(faceSteps.map((f) => f.targetId).filter(Boolean) as string[])];
  const proofsThisYear = new Set(faceSteps.filter((f) => f.createdAt >= yearStart).map((f) => f.targetId)).size;
  const cases = caseIds.length ? await prisma.case.findMany({ where: { id: { in: caseIds } }, select: { id: true, status: true, riskFlags: true } }) : [];
  const officerDone = caseIds.length ? await prisma.auditLog.findMany({ where: { targetId: { in: caseIds }, action: { in: ["officer_approve", "officer_stop"] } }, select: { targetId: true, action: true } }) : [];

  const points: HelperTrust["points"] = [];
  const add = (n: number, each: number, text: string) => { if (n > 0) points.push({ text: `${text} (${n})`, delta: n * each }); };
  const stopped = cases.filter((c) => c.status === "STOPPED").length;
  add(stopped, -30, "Families helped whose pension an officer then stopped");
  const replay = cases.filter((c) => c.riskFlags.some((f) => ["face_numbers_reused", "face_too_identical_possible_replay", "face_not_from_liveness_check"].includes(f))).length;
  add(replay, -20, "Selfies that looked replayed or skipped the liveness check");
  const spot = cases.filter((c) => c.riskFlags.includes("helper_spot_check"));
  const spotPassed = spot.filter((c) => officerDone.some((o) => o.targetId === c.id && o.action === "officer_approve")).length;
  add(spotPassed, +5, "Random officer spot checks passed");
  add(refused, -10, "Refused attempts to change bank or CNIC, or open a family without permission");
  add(withdrawn, -5, "Families who withdrew permission");
  if (proofsThisYear > 15) points.push({ text: `Unusually many proofs this year (${proofsThisYear})`, delta: -10 });
  add(visits, 0, "Home visits asked for (neutral)");

  const score = Math.max(0, Math.min(100, 80 + points.reduce((a, p) => a + p.delta, 0)));
  return { helperId, name: helper.name, score, level: score >= 75 ? "good" : score >= 50 ? "watch" : "risky", families, proofsThisYear, points };
}

/** Which helper (if any) sent this year's selfie for a case. */
export async function helperForCase(caseId: string) {
  const step = await prisma.auditLog.findFirst({ where: { action: "evidence_face_match", targetId: caseId, actorRole: "HELPER" }, orderBy: { createdAt: "desc" }, select: { actorId: true } });
  return step?.actorId ?? null;
}
