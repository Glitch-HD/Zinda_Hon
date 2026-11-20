import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { runDecision } from "@/lib/case-service";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const { id } = await ctx.params;
  await loadCaseFor(user, id);
  const { result, status } = await runDecision(id, user);
  return NextResponse.json({ status, outcome: result.outcome, reasonEn: result.reasonEn, reasonUr: result.reasonUr, askFor: result.askFor });
});
