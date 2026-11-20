import { z } from "zod";
import { prisma } from "./db";
import { DEFAULT_RULE_CONFIG, type RuleConfig } from "./decision";

// Rules that change without code changes (Challenge 04).
// Rules are stored as numbered versions. Editing creates a NEW version; old versions are never changed,
// and every decision records the version it used.

export const RULE_KEY = "proof_of_life";

const prob = z.number().min(0).max(1);
export const RuleConfigSchema = z.object({
  costs: z.object({ wrongApprovalPkr: z.number().positive(), humanReviewPkr: z.number().positive() }),
  face: z.object({ strictDistance: z.number().min(0).max(2), looseDistance: z.number().min(0).max(2), reliabilityWhenStrict: prob }),
  liveness: z.object({ reliabilityWhenPassed: prob }),
  document: z.object({ reliabilityWhenValid: prob, required: z.boolean() }),
  identity: z.object({ autoMinSimilarity: prob, askMinSimilarity: prob, reliabilityWhenMatched: prob }),
  deathRegistry: z.object({ reliabilityWhenClear: prob }),
  anomaly: z.object({ maxAgeYears: z.number().int().min(60).max(130) }),
  maxAttempts: z.number().int().min(1).max(5),
}).refine((c) => c.face.strictDistance <= c.face.looseDistance, { message: "Strict face distance must be at most the loose distance" })
  .refine((c) => c.identity.askMinSimilarity <= c.identity.autoMinSimilarity, { message: "Ask threshold must be at most the auto threshold" });

export async function getActiveRule(tenantId: string) {
  const rule = await prisma.ruleVersion.findFirst({
    where: { tenantId, ruleKey: RULE_KEY, activeFrom: { lte: new Date() } },
    orderBy: { version: "desc" },
  });
  if (rule) return { id: rule.id, version: rule.version, config: RuleConfigSchema.parse(rule.config) as RuleConfig };
  // First run: create version 1 from the defaults so every decision has a rule version to point at.
  const created = await prisma.ruleVersion.create({
    data: { tenantId, ruleKey: RULE_KEY, version: 1, config: DEFAULT_RULE_CONFIG, createdBy: "system", note: "Initial rules" },
  });
  return { id: created.id, version: 1, config: DEFAULT_RULE_CONFIG };
}

export async function publishRuleVersion(tenantId: string, config: unknown, createdBy: string, note?: string) {
  const parsed = RuleConfigSchema.parse(config) as RuleConfig;
  const latest = await prisma.ruleVersion.findFirst({ where: { tenantId, ruleKey: RULE_KEY }, orderBy: { version: "desc" } });
  return prisma.ruleVersion.create({
    data: { tenantId, ruleKey: RULE_KEY, version: (latest?.version ?? 0) + 1, config: parsed, createdBy, note },
  });
}

/**
 * Lists every way a new rule config is LOOSER than the current one: it would let more cases through
 * without an officer. A looser change needs a second admin to approve it, so one admin (or one stolen
 * admin password) cannot quietly open the gate. Tighter changes apply at once.
 */
export function loosenings(oldC: RuleConfig, newC: RuleConfig): string[] {
  const out: string[] = [];
  const up = (label: string, a: number, b: number) => { if (b > a + 1e-12) out.push(`${label}: ${a} → ${b}`); };
  const down = (label: string, a: number, b: number) => { if (b < a - 1e-12) out.push(`${label}: ${a} → ${b}`); };
  // A lower required confidence means more automatic approvals.
  const req = (c: RuleConfig) => 1 - c.costs.humanReviewPkr / c.costs.wrongApprovalPkr;
  down("Confidence needed to auto-approve", Math.round(req(oldC) * 1e6) / 1e6, Math.round(req(newC) * 1e6) / 1e6);
  up("Face distance for auto-approve", oldC.face.strictDistance, newC.face.strictDistance);
  up("Face distance for a mismatch", oldC.face.looseDistance, newC.face.looseDistance);
  up("Trust in a strict face match", oldC.face.reliabilityWhenStrict, newC.face.reliabilityWhenStrict);
  up("Trust in a passed liveness check", oldC.liveness.reliabilityWhenPassed, newC.liveness.reliabilityWhenPassed);
  up("Trust in a valid pension book", oldC.document.reliabilityWhenValid, newC.document.reliabilityWhenValid);
  if (oldC.document.required && !newC.document.required) out.push("Pension book no longer required");
  down("Name similarity to auto-approve", oldC.identity.autoMinSimilarity, newC.identity.autoMinSimilarity);
  down("Name similarity before an officer", oldC.identity.askMinSimilarity, newC.identity.askMinSimilarity);
  up("Trust in a NADRA match", oldC.identity.reliabilityWhenMatched, newC.identity.reliabilityWhenMatched);
  up("Trust in a clear death registry", oldC.deathRegistry.reliabilityWhenClear, newC.deathRegistry.reliabilityWhenClear);
  up("Age before a flag", oldC.anomaly.maxAgeYears, newC.anomaly.maxAgeYears);
  up("Retakes allowed", oldC.maxAttempts, newC.maxAttempts);
  return out;
}
