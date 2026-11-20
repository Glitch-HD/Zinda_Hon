import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { prisma } from "@/lib/db";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const c = await loadCaseFor(user, id);
  const [evidence, decisions] = await Promise.all([
    prisma.evidence.findMany({ where: { caseId: id }, orderBy: { createdAt: "asc" }, select: { type: true, score: true, passed: true, createdAt: true } }),
    prisma.decision.findMany({ where: { caseId: id }, orderBy: { createdAt: "desc" }, select: { outcome: true, confidence: true, reasonEn: true, reasonUr: true, createdAt: true, decidedBy: true } }),
  ]);
  return NextResponse.json({
    case: { id: c.id, year: c.year, status: c.status, confidence: c.confidence, riskFlags: c.riskFlags },
    pensioner: { id: c.pensioner.id, name: c.pensioner.name, nameUr: c.pensioner.nameUr, pensionNo: c.pensioner.pensionNo, enrolled: c.pensioner.enrolledFaceDescriptor.length === 128 },
    evidence,
    decisions,
  });
});
