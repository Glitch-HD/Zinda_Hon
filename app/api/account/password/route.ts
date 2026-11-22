import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { requireUser, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { passwordProblem } from "@/lib/secrets-check";

// Change my password (helpers, shopkeepers, officers, admins, auditors). Needs the current password.
// On success every other login of this account ends at once (session version goes up), this browser
// gets a fresh login, the change is in the audit log, and the person gets a message about it.
const Body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

export const POST = handle(async (req: Request) => {
  const me = await requireUser(["HELPER", "SHOPKEEPER", "OFFICER", "ADMIN", "AUDITOR"]);
  const { current, next } = Body.parse(await req.json());
  await rateLimit(`pwchange:${me.id}`, 5, 3600);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) {
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "password_change_failed", targetType: "user", targetId: user.id, details: { reason: "wrong_current" } });
    return NextResponse.json({ error: "Your current password is not right." }, { status: 401 });
  }
  const problem = passwordProblem(next, user.phone, user.name) ?? (await bcrypt.compare(next, user.passwordHash) ? "The new password must be different from the old one." : null);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10), sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  await Promise.all([
    audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "password_changed", targetType: "user", targetId: user.id, details: { otherLoginsEnded: true } }),
    prisma.notification.create({ data: { userId: user.id, title: "Your password was changed", body: "Your password was changed and every other login was signed out. If this was not you, tell the pension office at once." } }),
    setSessionCookie({ ...me, sv: updated.sessionVersion }),
  ]);
  return NextResponse.json({ ok: true });
});
