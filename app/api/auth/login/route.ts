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
  await rateLimit(`login:${cleanPhone}`, 10, 60);
  await rateLimit(`login:ip:${ip}`, 30, 60);
  const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    await audit({ actorType: "SYSTEM", action: "login_failed", details: { phoneLast4: cleanPhone.slice(-4) } });
    return NextResponse.json({ error: "Wrong phone number or password" }, { status: 401 });
  }
  await setSessionCookie({ id: user.id, tenantId: user.tenantId, role: user.role, name: user.name });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "login" });
  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role] });
});
