import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getActiveRule, publishRuleVersion } from "@/lib/rules";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ action: z.enum(["approve", "reject", "cancel"]), note: z.string().max(300).optional() });

// The second admin approves or rejects a looser rule change. The admin who proposed it can only cancel
// it, never approve it. If the rules changed in the meantime, the request is out of date and must be
// proposed again, so nobody approves a comparison that is no longer true.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["ADMIN"]);
  const { id } = await ctx.params;
  const { action, note } = Body.parse(await req.json());
  const r = await prisma.ruleChangeRequest.findUnique({ where: { id } });
  if (!r || r.tenantId !== user.tenantId) throw new HttpError(404, "Rule change not found");
  if (r.status !== "pending") throw new HttpError(409, `This change is already ${r.status}`);

  if (action === "cancel") {
    if (r.proposedBy !== user.id) throw new HttpError(403, "Only the admin who proposed this change can cancel it");
  } else if (r.proposedBy === user.id) {
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "rule_change_self_approval_refused", targetType: "rule_change", targetId: r.id });
    throw new HttpError(403, "A second admin must approve this. You cannot approve your own looser rule change.");
  }

  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
  if (action === "approve") {
    const active = await getActiveRule(user.tenantId);
    if (active.version !== r.baseVersion) {
      await prisma.ruleChangeRequest.updateMany({ where: { id, status: "pending" }, data: { status: "cancelled", decidedBy: user.id, decidedNote: "Out of date: the rules changed after it was proposed", decidedAt: new Date() } });
      throw new HttpError(409, `The rules changed since this was proposed (v${r.baseVersion} → v${active.version}). Please propose it again.`);
    }
  }
  // Only one person can decide: the update succeeds only while it is still pending.
  const claimed = await prisma.ruleChangeRequest.updateMany({ where: { id, status: "pending" }, data: { status, decidedBy: user.id, decidedNote: note, decidedAt: new Date() } });
  if (claimed.count === 0) throw new HttpError(409, "Someone else decided this change first");

  let version: number | null = null;
  if (action === "approve") {
    const v = await publishRuleVersion(user.tenantId, r.config, r.proposedBy, `${r.note ?? "Looser rule change"} (approved by a second admin)`.slice(0, 300));
    version = v.version;
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `rule_change_${status}`, targetType: "rule_change", targetId: r.id, details: { proposedBy: r.proposedBy, loosened: r.loosened, version, note: note ?? null } });
  return NextResponse.json({ ok: true, status, version });
});
