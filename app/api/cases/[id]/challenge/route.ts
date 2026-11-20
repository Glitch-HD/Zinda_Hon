import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { loadCaseFor } from "@/lib/case-access";
import { issueTicket } from "@/lib/liveness";
import { rateLimit } from "@/lib/ratelimit";

// A fresh liveness ticket (the server-chosen order of movements) for one case. The case page also
// gets one when it loads, so the check still works if the signal drops before the camera step.
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["PENSIONER", "HELPER"]);
  const { id } = await ctx.params;
  await loadCaseFor(user, id, "face");
  await rateLimit(`challenge:${id}`, 30, 3600);
  return NextResponse.json(issueTicket(id));
});
