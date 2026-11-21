import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";

// Officer: pending sign-ups at their own office (never the password or PIN hashes).
export const GET = handle(async () => {
  const user = await requireUser(["OFFICER"]);
  const registrations = await prisma.registration.findMany({
    where: { tenantId: user.tenantId, status: "pending" },
    select: { id: true, role: true, name: true, cnic: true, phone: true, area: true, pensionNo: true, checks: true, createdAt: true },
    orderBy: { createdAt: "asc" }, take: 50,
  });
  return NextResponse.json({ registrations });
});
