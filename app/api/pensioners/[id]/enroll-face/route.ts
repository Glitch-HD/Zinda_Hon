import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// Enrolment happens once, at the pension office, by an officer. Only the 128-number descriptor is stored.
const Body = z.object({ descriptor: z.array(z.number().finite()).length(128) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER", "ADMIN"]);
  const { id } = await ctx.params;
  const { descriptor } = Body.parse(await req.json());
  const p = await prisma.pensioner.findUnique({ where: { id } });
  if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Pensioner not found");
  await prisma.pensioner.update({ where: { id }, data: { enrolledFaceDescriptor: descriptor } });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "face_enrolled", targetType: "pensioner", targetId: id });
  return NextResponse.json({ ok: true });
});
