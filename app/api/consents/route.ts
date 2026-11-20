import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";

// "See who has my data" for the logged-in pensioner, including what was withdrawn and when.
export const GET = handle(async () => {
  const user = await requireUser(["PENSIONER"]);
  const p = await prisma.pensioner.findUnique({ where: { userId: user.id } });
  if (!p) throw new HttpError(404, "No pension record");
  const consents = await prisma.consent.findMany({ where: { pensionerId: p.id }, orderBy: { grantedAt: "desc" } });
  const accessLog = await prisma.auditLog.findMany({ where: { targetType: "pensioner", targetId: p.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ consents, accessLog });
});
