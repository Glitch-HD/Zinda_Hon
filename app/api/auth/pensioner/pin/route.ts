import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { ROLE_HOME, setSessionCookie } from "@/lib/auth";
import { endPensionerLogin, readPensionerLogin } from "@/lib/pensioner-login";

// Step 2 (backup path): 4-digit PIN on a big number pad, only after the pension book was scanned.
const Body = z.object({ pin: z.string().regex(/^\d{4}$/) });

export const POST = handle(async (req: Request) => {
  const { pin } = Body.parse(await req.json());
  const { user, pensioner } = await readPensionerLogin();
  await rateLimit(`plogin:pin:${pensioner.id}`, 5, 600);
  const ok = Boolean(user.pinHash) && (await bcrypt.compare(pin, user.pinHash!));
  await audit({ tenantId: pensioner.tenantId, actorType: "USER", actorId: user.id, actorRole: "PENSIONER", action: ok ? "login_pin" : "login_pin_failed", targetType: "pensioner", targetId: pensioner.id });
  if (!ok) return NextResponse.json({ error: "Wrong PIN. Try again.", errorUr: "پن غلط ہے۔ دوبارہ کوشش کریں۔" }, { status: 401 });
  await endPensionerLogin();
  await setSessionCookie({ id: user.id, tenantId: user.tenantId, role: user.role, name: user.name });
  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role] });
});
