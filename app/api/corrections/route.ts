import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPensionerAccess } from "@/lib/consent";
import { rateLimit } from "@/lib/ratelimit";
import { cleanCorrectionValue } from "@/lib/corrections";

// "Correct my data": the pensioner asks; an officer accepts or rejects. Nothing changes silently.
const Body = z.object({ field: z.enum(["name", "fatherOrHusbandName", "dateOfBirth", "cnicMock", "bankAccountNo"]), newValue: z.string().min(1).max(200) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const body = Body.parse(await req.json());
  await rateLimit(`correction:${user.id}`, 10, 86400);
  cleanCorrectionValue(body.field, body.newValue); // a clear message now, not a surprise for the officer later
  const pensionerId = new URL(req.url).searchParams.get("pensionerId");
  const p = user.role === "PENSIONER"
    ? await prisma.pensioner.findUnique({ where: { userId: user.id } })
    : pensionerId ? await prisma.pensioner.findUnique({ where: { id: pensionerId } }) : null;
  if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Not found");
  // A helper may only ask for corrections for a family they are linked to, with consent. Changing where
  // the money goes (bank account) or the identity number is never accepted from a helper: the
  // pensioner must ask herself, and an officer checks it, because that is how a pension is stolen.
  if (user.role === "HELPER") {
    await assertPensionerAccess(user, p.id, "name");
    if (body.field === "bankAccountNo" || body.field === "cnicMock") {
      await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "correction_refused_sensitive_field", targetType: "pensioner", targetId: p.id, details: { field: body.field } });
      throw new HttpError(403, "A helper cannot change the bank account or CNIC. The pensioner must ask for this herself, and an officer will check it.");
    }
  }
  if (await prisma.dataCorrectionRequest.findFirst({ where: { pensionerId: p.id, field: body.field, status: { in: ["pending", "awaiting_second"] } } })) throw new HttpError(409, "A request to change this is already waiting for an officer.");
  const oldValue = String((p as Record<string, unknown>)[body.field] ?? "");
  const r = await prisma.dataCorrectionRequest.create({ data: { pensionerId: p.id, field: body.field, oldValue, newValue: body.newValue, requestedBy: user.id } });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "correction_requested", targetType: "pensioner", targetId: p.id, details: { field: body.field, highRisk: body.field === "bankAccountNo" || body.field === "cnicMock" } });
  return NextResponse.json({ ok: true, id: r.id });
});

// Officer: requests waiting in their office. Pensioner: her own requests and what happened to them.
export const GET = handle(async () => {
  const user = await requireUser(["OFFICER", "PENSIONER"]);
  const where = user.role === "OFFICER"
    ? { pensioner: { tenantId: user.tenantId }, status: { in: ["pending", "awaiting_second"] } }
    : { pensioner: { userId: user.id } };
  const requests = await prisma.dataCorrectionRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, field: true, newValue: true, status: true, createdAt: true, resolvedAt: true, pensioner: { select: { pensionNo: true } } } });
  return NextResponse.json({ requests });
});
