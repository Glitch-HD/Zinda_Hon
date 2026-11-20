import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { publishRuleVersion } from "@/lib/rules";
import { audit } from "@/lib/audit";

const Body = z.object({ config: z.unknown(), note: z.string().max(300).optional() });

// Admin publishes a new rule version. It applies to the very next decision: no code change, no redeploy.
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const { config, note } = Body.parse(await req.json());
  const v = await publishRuleVersion(user.tenantId, config, user.id, note);
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "rule_published", targetType: "rule_version", targetId: v.id, details: { version: v.version, note: note ?? null } });
  return NextResponse.json({ ok: true, version: v.version });
});
