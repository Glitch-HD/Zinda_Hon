import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ROLE_HOME, setSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({ phone: z.string().min(5).max(20), password: z.string().min(1).max(100) });

export const POST = handle(async (req: Request) => {
  const { phone, password } = Body.parse(await req.json());
  const cleanPhone = phone.replace(/\D/g, "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  // Independent lookups at the same time: each database round trip costs time on the hosted database.
  const [, , user] = await Promise.all([
    rateLimit(`login:${cleanPhone}`, 10, 60),
    rateLimit(`login:ip:${ip}`, 30, 60),
    prisma.user.findUnique({ where: { phone: cleanPhone } }),
  ]);
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user) {
    const waiting = await prisma.registration.findFirst({ where: { phone: cleanPhone, status: { in: ["pending", "rejected"] } }, orderBy: { createdAt: "desc" } });
    if (waiting) return NextResponse.json({ error: waiting.status === "pending" ? "Your sign-up is waiting for the pension office to check it. You can log in once it is approved." : `Your sign-up was not approved: ${waiting.decidedNote ?? "please visit the pension office"}.` }, { status: 403 });
  }
  if (!user || !ok) {
    await audit({ actorType: "SYSTEM", action: "login_failed", details: { phoneLast4: cleanPhone.slice(-4) } });
    return NextResponse.json({ error: "Wrong phone number or password" }, { status: 401 });
  }
  await Promise.all([
    setSessionCookie({ id: user.id, tenantId: user.tenantId, role: user.role, name: user.name }),
    audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "login" }),
  ]);
  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role] });
});
