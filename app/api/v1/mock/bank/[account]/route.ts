import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiKey } from "@/lib/apikeys";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";

// MOCK bank / payment service (stands in for a bank or Raast). Simulated data only.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ account: string }> }) => {
  await requireApiKey(req, "mock:read");
  const acc = await prisma.mockBankAccount.findUnique({ where: { accountNo: (await ctx.params).account } });
  if (!acc) throw new HttpError(404, "No account");
  return NextResponse.json({ simulated: true, accountNo: acc.accountNo, holderName: acc.holderName, lastActivity: acc.lastActivity, withdrawalsLast90Days: acc.withdrawalsLast90Days });
});
