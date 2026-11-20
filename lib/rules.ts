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
