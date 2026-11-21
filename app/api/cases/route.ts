import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

// Officer opens this year's proof-of-life case: for one pensioner, or for every active pensioner in the
// office who has none yet (the start of the yearly round). A case only says "proof is due"; it never
// approves or stops anything by itself.
const Body = z.union([
  z.object({ pensionerId: z.string().min(5).max(40) }),
  z.object({ all: z.literal(true) }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["OFFICER"]);
  await rateLimit(`case-create:${user.id}`, 30, 600);
  const body = Body.parse(await req.json());
  const year = new Date().getFullYear();
  const candidates = await prisma.pensioner.findMany({
    where: { tenantId: user.tenantId, status: "active", ...("pensionerId" in body ? { id: body.pensionerId } : {}), cases: { none: { year } } },
    select: { id: true, pensionNo: true, userId: true },
  });
  if ("pensionerId" in body && !candidates.length) {
    const p = await prisma.pensioner.findUnique({ where: { id: body.pensionerId }, select: { tenantId: true, status: true } });
    if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Pensioner not found");
    if (p.status !== "active") throw new HttpError(409, "This pension is not active");
    throw new HttpError(409, `This pensioner already has a case for ${year}`);
  }
  const created: string[] = [];
  for (const p of candidates) {
    // The unique (pensioner, year) rule in the database stops a double case even if two officers click at once.
    const c = await prisma.case.create({ data: { tenantId: user.tenantId, pensionerId: p.id, year, status: "DUE" } }).catch(() => null);
    if (!c) continue;
    created.push(c.id);
    if (p.userId) await prisma.notification.create({ data: { userId: p.userId, title: "Proof of life is due", body: `Your ${year} proof of life is due. Open the app and look at the camera; it takes two minutes.` } });
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "case_created", targetType: "case", targetId: c.id, details: { pensionNo: p.pensionNo, year, bulk: !("pensionerId" in body) } });
  }
  return NextResponse.json({ ok: true, created: created.length, caseId: created[0] ?? null });
});
