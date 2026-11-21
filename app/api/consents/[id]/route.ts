import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// Change what is shared, or withdraw completely. Withdrawal takes effect on the very next request,
// because every data access checks consent live (lib/consent.ts).
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("update_fields"), fields: z.array(z.enum(["name", "cnic", "face", "bank_account", "case_status"])).max(5) }),
  z.object({ action: z.literal("restore") }),
]);

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER"]);
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const consent = await prisma.consent.findUnique({ where: { id }, include: { pensioner: true } });
  if (!consent || consent.pensioner.userId !== user.id) throw new HttpError(404, "Not found");
  if (consent.granteeType === "department" && body.action === "withdraw") {
    throw new HttpError(400, "The pension office needs your bank account to pay you. To stop sharing with them, you would have to stop the pension; please talk to an officer.");
  }
  if (consent.granteeType === "nadra" && body.action !== "withdraw") throw new HttpError(400, "To use your NADRA photo again, start proof of life and agree once more.");
  const before = { fields: consent.fields, withdrawnAt: consent.withdrawnAt };
  // Taking back the NADRA permission deletes the face print copied from her CNIC photo, at once.
  if (consent.granteeType === "nadra" && body.action === "withdraw" && consent.pensioner.faceSource === "nadra") {
    await prisma.pensioner.update({ where: { id: consent.pensionerId }, data: { enrolledFaceDescriptor: [], faceSource: null } });
  }
  const updated = await prisma.consent.update({
    where: { id },
    data: body.action === "withdraw" ? { withdrawnAt: new Date() } : body.action === "restore" ? { withdrawnAt: null } : { fields: body.fields },
  });
  await audit({
    tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: `consent_${body.action}`, targetType: "pensioner", targetId: consent.pensionerId,
    details: { consentId: id, grantee: consent.granteeName, before, after: { fields: updated.fields, withdrawnAt: updated.withdrawnAt } },
  });
  return NextResponse.json({ ok: true, consent: updated });
});
