import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiKey } from "@/lib/apikeys";
import { prisma } from "@/lib/db";
import { hasConsent } from "@/lib/consent";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/auth";

// Public API: proof-of-life status for a pension number. Respects the pensioner's consent for "case_status".
export const GET = handle(async (req: Request, ctx: { params: Promise<{ pensionNo: string }> }) => {
  const key = await requireApiKey(req, "cases:read");
  const { pensionNo } = await ctx.params;
  const p = await prisma.pensioner.findUnique({ where: { pensionNo }, include: { cases: { orderBy: { year: "desc" }, take: 1 } } });
  if (!p || p.tenantId !== key.tenantId) throw new HttpError(404, "Not found");
  if (!(await hasConsent(p.id, key.tenantId, "case_status"))) throw new HttpError(403, "The pensioner has not shared their case status");
  await audit({ tenantId: key.tenantId, actorType: "API_CLIENT", actorId: key.prefix, action: "api_case_status_read", targetType: "pensioner", targetId: p.id });
  const c = p.cases[0];
  return NextResponse.json({ pensionNo, year: c?.year ?? null, status: c?.status ?? null, updatedAt: c?.updatedAt ?? null, simulated: true });
});
