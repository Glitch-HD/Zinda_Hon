import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getActiveRule, loosenings, publishRuleVersion, RuleConfigSchema } from "@/lib/rules";
import type { RuleConfig } from "@/lib/decision";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ config: z.unknown(), note: z.string().max(300).optional() });

// Admin publishes a new rule version. A change that only makes checks stricter applies to the very next
// decision. A change that makes any check LOOSER waits for a second admin (four-eyes rule), so one admin
// or one stolen admin password cannot quietly let more cases through.
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const { config, note } = Body.parse(await req.json());
  const parsed = RuleConfigSchema.parse(config) as RuleConfig;
  const active = await getActiveRule(user.tenantId);
  const loosened = loosenings(active.config, parsed);
  if (loosened.length) {
    const open = await prisma.ruleChangeRequest.count({ where: { tenantId: user.tenantId, status: "pending" } });
    if (open >= 5) return NextResponse.json({ error: "Five rule changes are already waiting for approval. Approve or cancel some first." }, { status: 409 });
    const r = await prisma.ruleChangeRequest.create({ data: { tenantId: user.tenantId, baseVersion: active.version, config: parsed, note, loosened, proposedBy: user.id } });
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "rule_change_proposed", targetType: "rule_change", targetId: r.id, details: { baseVersion: active.version, loosened, note: note ?? null } });
    return NextResponse.json({ ok: true, pending: true, requestId: r.id, loosened }, { status: 202 });
  }
  const v = await publishRuleVersion(user.tenantId, parsed, user.id, note);
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "rule_published", targetType: "rule_version", targetId: v.id, details: { version: v.version, note: note ?? null, stricterOrSame: true } });
  return NextResponse.json({ ok: true, version: v.version });
});
