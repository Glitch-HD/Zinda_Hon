import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiKey } from "@/lib/apikeys";
import { prisma } from "@/lib/db";
import { normalizeCnic } from "@/lib/names";
import { HttpError } from "@/lib/auth";

// MOCK death registry (stands in for union council records). Simulated data only.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ cnic: string }> }) => {
  await requireApiKey(req, "mock:read");
  const cnic = normalizeCnic((await ctx.params).cnic);
  if (!cnic) throw new HttpError(400, "CNIC must have 13 digits");
  const all = await prisma.mockDeathRecord.findMany();
  const rec = all.find((r) => normalizeCnic(r.cnic) === cnic);
  return NextResponse.json({ simulated: true, found: Boolean(rec), dateOfDeath: rec?.dateOfDeath ?? null, registeredAt: rec?.registeredAt ?? null });
});
