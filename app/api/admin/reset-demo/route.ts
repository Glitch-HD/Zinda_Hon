import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError, clearSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { resetDemoData } from "@/lib/demo-reset";

// Seeding a fresh demo takes a while on the hosted database.
export const maxDuration = 60;

// DEMO ONLY: back to a clean start before judging. Admin only, and the admin must type RESET.
// Set DEMO_RESET_DISABLED=1 in the environment to switch this off completely.
const Body = z.object({ confirm: z.literal("RESET") });

export const POST = handle(async (req: Request) => {
  if (process.env.DEMO_RESET_DISABLED === "1") throw new HttpError(403, "Demo reset is switched off on this server");
  const user = await requireUser(["ADMIN"]);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "Type RESET in capitals to confirm");
  await rateLimit(`demo-reset:${user.id}`, 3, 600);
  const started = Date.now();
  await resetDemoData();
  // The old audit log is gone with everything else; the reset itself is the first entry of the new one.
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (tenant) await audit({ tenantId: tenant.id, actorType: "USER", actorId: user.id, actorRole: "ADMIN", action: "demo_data_reset", targetType: "system", targetId: "all", details: { by: user.name, seconds: Math.round((Date.now() - started) / 1000) } });
  // Every account was re-created, so all old logins (including this one) end now.
  await clearSessionCookie();
  return NextResponse.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000) });
});
