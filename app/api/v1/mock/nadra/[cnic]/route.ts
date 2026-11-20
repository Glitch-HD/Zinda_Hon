import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiKey } from "@/lib/apikeys";
import { prisma } from "@/lib/db";
import { normalizeCnic } from "@/lib/names";
import { HttpError } from "@/lib/auth";

// MOCK identity service (stands in for NADRA). Simulated data only.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ cnic: string }> }) => {
  await requireApiKey(req, "mock:read");
  const cnic = normalizeCnic((await ctx.params).cnic);
  if (!cnic) throw new HttpError(400, "CNIC must have 13 digits");
  const all = await prisma.mockNadraRecord.findMany();
  const rec = all.filter((r) => normalizeCnic(r.cnic) === cnic);
  if (rec.length === 0) throw new HttpError(404, "No record");
  return NextResponse.json({ simulated: true, matches: rec.map((r) => ({ name: r.name, fatherOrHusbandName: r.fatherOrHusbandName, dateOfBirth: r.dateOfBirth, maritalStatus: r.maritalStatus })) });
});
