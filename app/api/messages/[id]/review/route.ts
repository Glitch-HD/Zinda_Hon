import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// Officer sets the true label. These labels are what the evaluation page measures accuracy and false alarms against.
const Body = z.object({ label: z.enum(["scam", "genuine"]) });
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER"]);
  const { id } = await ctx.params;
  const { label } = Body.parse(await req.json());
  const m = await prisma.checkedMessage.findUnique({ where: { id } });
  if (!m || m.tenantId !== user.tenantId) throw new HttpError(404, "Not found");
  await prisma.checkedMessage.update({ where: { id }, data: { reviewedLabel: label } });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "message_reviewed", targetType: "checked_message", targetId: id, details: { aiLabel: m.label, trueLabel: label } });
  return NextResponse.json({ ok: true });
});
