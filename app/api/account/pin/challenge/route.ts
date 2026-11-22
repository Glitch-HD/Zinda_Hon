import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { issueTicket } from "@/lib/liveness";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Changing the PIN needs her live face. The server picks the order of movements, as for login.
export const POST = handle(async () => {
  const me = await requireUser(["PENSIONER"]);
  const p = await prisma.pensioner.findUnique({ where: { userId: me.id }, select: { id: true } });
  if (!p) return NextResponse.json({ error: "No pension record" }, { status: 404 });
  await rateLimit(`pinchange:challenge:${p.id}`, 20, 3600);
  return NextResponse.json(issueTicket(`pinchange:${p.id}`));
});
