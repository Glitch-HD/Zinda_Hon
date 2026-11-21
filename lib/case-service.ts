import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { decide, type DecisionInputs } from "./decision";
import { getActiveRule } from "./rules";
import { nameSimilarity, normalizeCnic } from "./names";
import { audit } from "./audit";
import { HttpError, type SessionUser } from "./auth";

// Gathers every check for one proof-of-life case from our own records and the mock government
// services, then applies the current rule version. Bad data is expected: every lookup tolerates
// missing fields and duplicates instead of crashing or silently picking a match.

export function faceDistance(a: number[], b: number[]): number | null {
  if (!a?.length || !b?.length || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function ageOn(dob: Date | null, now = new Date()) {
  if (!dob) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  if (!a || !b) return null;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export async function lookupIdentity(pensionerId: string) {
  const p = await prisma.pensioner.findUniqueOrThrow({ where: { id: pensionerId } });
  const cnic = normalizeCnic(p.cnicMock);

  // Mock NADRA: by CNIC when we have one, otherwise by date of birth + similar name (never by name alone).
  const allNadra = await prisma.mockNadraRecord.findMany();
  let nadra = cnic ? allNadra.find((r) => normalizeCnic(r.cnic) === cnic) ?? null : null;
  let matchedBy: "cnic" | "dob_and_name" | "none" = nadra ? "cnic" : "none";
  if (!nadra) {
    const candidates = allNadra.filter((r) => sameDay(r.dateOfBirth, p.dateOfBirth) && nameSimilarity(r.name, p.name) >= 0.8);
    if (candidates.length === 1) {
      nadra = candidates[0];
      matchedBy = "dob_and_name";
    }
  }

  // If the pension record has no CNIC but NADRA (found by DOB + name) does, a later CNIC comparison is not possible.
  const cnicMatch = cnic && nadra ? normalizeCnic(nadra.cnic) === cnic : cnic && !nadra ? false : null;

  // Duplicate people inside our own pension records.
  const others = await prisma.pensioner.findMany({ where: { tenantId: p.tenantId, id: { not: p.id } } });
  const duplicates = others.filter((o) => {
    const sameCnic = cnic && normalizeCnic(o.cnicMock) === cnic;
    const similarPerson = sameDay(o.dateOfBirth, p.dateOfBirth) && nameSimilarity(o.name, p.name) >= 0.88;
    return Boolean(sameCnic || similarPerson);
  });

  // Mock death registry: by CNIC (ours, or NADRA's if ours is missing).
  const deathCnic = cnic ?? normalizeCnic(nadra?.cnic);
  const deaths = await prisma.mockDeathRecord.findMany();
  const death = deathCnic ? deaths.find((d) => normalizeCnic(d.cnic) === deathCnic) ?? null : null;

  // Mock bank: activity after a recorded death is a ghost-pension signal.
  const bank = p.bankAccountNo ? await prisma.mockBankAccount.findUnique({ where: { accountNo: p.bankAccountNo } }) : null;
  const anomalies: string[] = [];
  if (death && bank?.lastActivity && bank.lastActivity > death.dateOfDeath) anomalies.push("bank_activity_after_death");
  if (duplicates.length > 0) anomalies.push("possible_duplicate_pension");

  return {
    pensioner: p,
    nadra,
    matchedBy,
    nameSimilarity: nadra ? nameSimilarity(nadra.name, p.name) : 0,
    spouseSimilarity: nadra && p.fatherOrHusbandName ? nameSimilarity(nadra.fatherOrHusbandName, p.fatherOrHusbandName) : null,
    cnicMatch,
    dobMatch: nadra ? sameDay(nadra.dateOfBirth, p.dateOfBirth) : null,
    duplicates: duplicates.map((d) => ({ id: d.id, pensionNo: d.pensionNo, name: d.name })),
    death,
    bank,
    anomalies,
    ageYears: ageOn(p.dateOfBirth),
  };
}

async function latestEvidence(caseId: string, type: string) {
  const [latest, attempts] = await Promise.all([
    prisma.evidence.findFirst({ where: { caseId, type }, orderBy: { createdAt: "desc" } }),
    prisma.evidence.count({ where: { caseId, type } }),
  ]);
  return { latest, attempts };
}

export async function gatherInputs(caseId: string): Promise<{ inputs: DecisionInputs; identity: Awaited<ReturnType<typeof lookupIdentity>> }> {
  const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  const identity = await lookupIdentity(c.pensionerId);
  const [face, live, doc] = await Promise.all([latestEvidence(caseId, "face_match"), latestEvidence(caseId, "liveness"), latestEvidence(caseId, "document")]);
  const docDetails = (doc.latest?.details ?? {}) as { qrValid?: boolean | null; fieldsMatch?: boolean | null; ocrAgrees?: boolean | null; ocrConfidence?: number | null };
  // The QR is valid but the clearly-read printed name is someone else's: a real QR stuck on another book.
  const ocrFlag = docDetails.qrValid === true && docDetails.ocrAgrees === false && (docDetails.ocrConfidence ?? 0) >= 70 ? ["printed_name_differs_from_qr"] : [];

  const inputs: DecisionInputs = {
    face: face.latest && face.latest.score !== null ? { distance: face.latest.score, attempts: face.attempts } : null,
    liveness: live.latest ? { passed: Boolean(live.latest.passed), attempts: live.attempts } : null,
    document: doc.latest ? { qrValid: docDetails.qrValid ?? null, fieldsMatch: docDetails.fieldsMatch ?? null, attempts: doc.attempts } : null,
    identity: {
      nameSimilarity: Math.round(identity.nameSimilarity * 1000) / 1000,
      cnicMatch: identity.cnicMatch,
      dobMatch: identity.dobMatch,
      duplicateRecords: identity.duplicates.length,
    },
    deathRecordFound: Boolean(identity.death),
    ageYears: identity.ageYears,
    anomalies: [...identity.anomalies.filter((a) => a !== "possible_duplicate_pension"), ...ocrFlag, ...(await fraudSignals(c, face.latest?.score ?? null, face.latest?.details ?? null))], // duplicates are already counted in identity
  };
  return { inputs, identity };
}

/** Share of helper-assisted proofs that an officer checks at random, even when everything looks fine. */
export const HELPER_SPOT_CHECK_RATE = 0.1;
/** A helper who completes more proofs than this in a year has every further one checked by an officer. */
export const HELPER_YEARLY_LIMIT = 15;

/** Stable 0..1 number per case, so a spot check cannot be dodged by submitting again. */
function caseDraw(caseId: string) {
  let h = 2166136261;
  for (const ch of caseId) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

/**
 * Insider and replay checks that need history, not just this year's evidence. Each returns a flag that
 * sends the case to an officer; none of them stops a pension on its own.
 * - face_numbers_reused: exactly the same face numbers were sent before (a replay of an old submission).
 * - face_too_identical_possible_replay: a live selfie is never almost identical to the enrolment photo;
 *   a replayed photo or copied numbers are.
 * - face_not_from_liveness_check: the selfie does not carry the one-time ticket of a passed liveness check.
 * - face_reenrolled_this_year: someone replaced the enrolled face this year.
 * - helper_spot_check: a random 10% of proofs done through a helper.
 * - helper_high_volume: the helper has done unusually many proofs this year.
 * - helper_only_3_years: the pensioner has not done proof herself for three years in a row.
 */
async function fraudSignals(c: { id: string; pensionerId: string; tenantId: string; year: number }, faceDistanceNow: number | null, faceDetails: unknown) {
  const flags: string[] = [];
  if ((faceDetails as { reusedFrom?: string | null } | null)?.reusedFrom) flags.push("face_numbers_reused");
  // The live face looks at least as much like another registered pensioner (for example her sister).
  if ((faceDetails as { otherPerson?: unknown } | null)?.otherPerson) flags.push("face_matches_another_pensioner");
  // The selfie did not come from the server-issued liveness check (sent on its own, or with a used ticket).
  if ((faceDetails as { livenessLinked?: boolean } | null)?.livenessLinked === false) flags.push("face_not_from_liveness_check");
  if (faceDistanceNow !== null && faceDistanceNow < 0.08) flags.push("face_too_identical_possible_replay");
  const yearStart = new Date(Date.UTC(c.year, 0, 1));
  const reenrol = await prisma.auditLog.findFirst({ where: { action: "face_reenrolled", targetId: c.pensionerId, createdAt: { gte: yearStart } } });
  if (reenrol) flags.push("face_reenrolled_this_year");

  // Who submitted this year's selfie: the pensioner or a helper?
  const faceStep = await prisma.auditLog.findFirst({ where: { action: "evidence_face_match", targetId: c.id }, orderBy: { createdAt: "desc" } });
  if (faceStep?.actorRole === "HELPER" && faceStep.actorId) {
    if (caseDraw(c.id) < HELPER_SPOT_CHECK_RATE) flags.push("helper_spot_check");
    const helped = await prisma.auditLog.findMany({ where: { action: "evidence_face_match", actorId: faceStep.actorId, createdAt: { gte: yearStart } }, select: { targetId: true }, distinct: ["targetId"] });
    if (helped.length > HELPER_YEARLY_LIMIT) flags.push("helper_high_volume");
    const earlier = await prisma.case.findMany({ where: { pensionerId: c.pensionerId, year: { in: [c.year - 1, c.year - 2] } }, select: { id: true } });
    if (earlier.length === 2) {
      const byHelper = await Promise.all(earlier.map((e) => prisma.auditLog.findFirst({ where: { action: "evidence_face_match", targetId: e.id, actorRole: "HELPER" } })));
      if (byHelper.every(Boolean)) flags.push("helper_only_3_years");
    }
  }
  return flags;
}

/** Runs the decision engine on a case and records the result with a full audit trace. */
export async function runDecision(caseId: string, actor: SessionUser | null) {
  const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  if (c.status === "VERIFIED" || c.status === "STOPPED") throw new HttpError(409, "This case is already closed");
  const { inputs, identity } = await gatherInputs(caseId);
  const rule = await getActiveRule(c.tenantId);
  const result = decide(inputs, rule.config);

  const trace = {
    ruleVersion: rule.version,
    ruleConfig: rule.config,
    inputs,
    lookups: {
      nadraMatchedBy: identity.matchedBy,
      nadraName: identity.nadra?.name ?? null,
      pensionName: identity.pensioner.name,
      spouseSimilarity: identity.spouseSimilarity,
      duplicates: identity.duplicates,
      deathRecord: identity.death ? { date: identity.death.dateOfDeath, registeredAt: identity.death.registeredAt } : null,
      bankLastActivity: identity.bank?.lastActivity ?? null,
    },
    checks: result.checks,
    redFlags: result.redFlags,
    confidence: result.confidence,
    requiredConfidence: result.requiredConfidence,
    outcome: result.outcome,
    engine: "decision-engine v1 (deterministic rules over AI check scores)",
  };

  const status = result.outcome === "APPROVE" ? "VERIFIED" : result.outcome === "ASK_MORE_PROOF" ? "NEEDS_PROOF" : "WITH_OFFICER";
  let assignedOfficerId = c.assignedOfficerId;
  if (status === "WITH_OFFICER" && !assignedOfficerId) {
    // Assign to the officer in this department with the fewest open cases.
    const officers = await prisma.user.findMany({
      where: { tenantId: c.tenantId, role: "OFFICER", active: true },
      include: { _count: { select: { assignedCases: { where: { status: "WITH_OFFICER" } } } } },
    });
    officers.sort((a, b) => a._count.assignedCases - b._count.assignedCases);
    assignedOfficerId = officers[0]?.id ?? null;
  }

  const [decision] = await prisma.$transaction([
    prisma.decision.create({
      data: {
        caseId, outcome: result.outcome, confidence: result.confidence, ruleVersionId: rule.id,
        inputs: inputs as unknown as Prisma.InputJsonValue, checkScores: result.checks as unknown as Prisma.InputJsonValue,
        reasonEn: result.reasonEn, reasonUr: result.reasonUr, auditTrace: trace as unknown as Prisma.InputJsonValue, decidedBy: "ai",
      },
    }),
    prisma.case.update({
      where: { id: caseId },
      data: {
        status, confidence: result.confidence, priority: result.priority, riskFlags: result.redFlags, assignedOfficerId,
        closedAt: status === "VERIFIED" ? new Date() : null,
      },
    }),
  ]);

  await audit({
    tenantId: c.tenantId, actorType: "AI", actorId: "decision-engine", action: `decision_${result.outcome.toLowerCase()}`,
    targetType: "case", targetId: caseId,
    details: { decisionId: decision.id, ruleVersion: rule.version, confidence: result.confidence, redFlags: result.redFlags, triggeredBy: actor?.id ?? "system" },
  });
  if (assignedOfficerId && status === "WITH_OFFICER") {
    await prisma.notification.create({
      data: { userId: assignedOfficerId, title: "New case to review", body: `${identity.pensioner.pensionNo}: ${result.redFlags.join(", ") || "low confidence"}` },
    });
  }
  return { decision, result, status };
}
