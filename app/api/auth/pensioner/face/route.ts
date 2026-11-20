import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { ROLE_HOME, setSessionCookie } from "@/lib/auth";
import { getActiveRule } from "@/lib/rules";
import { faceDistance } from "@/lib/case-service";
import { endPensionerLogin, readPensionerLogin } from "@/lib/pensioner-login";

// Step 2 (main path): face + liveness against the face enrolled at the pension office.
// This only logs her in. The yearly proof-of-life decision checks the face again with its own, stricter rule.
const Body = z.object({ descriptor: z.array(z.number().finite()).length(128), livenessPassed: z.boolean() });

export const POST = handle(async (req: Request) => {
  const { descriptor, livenessPassed } = Body.parse(await req.json());
  const { user, pensioner } = await readPensionerLogin();
  await rateLimit(`plogin:face:${pensioner.id}`, 5, 600);
  if (pensioner.enrolledFaceDescriptor.length !== 128) {
    return NextResponse.json({ error: "Your face is not registered yet. Please use your PIN.", errorUr: "آپ کا چہرہ ابھی رجسٹر نہیں۔ اپنا پن استعمال کریں۔", usePin: true }, { status: 409 });
  }
  const rule = await getActiveRule(pensioner.tenantId);
  const distance = faceDistance(descriptor, pensioner.enrolledFaceDescriptor);
  const ok = livenessPassed && distance !== null && distance <= rule.config.face.looseDistance;
  await audit({
    tenantId: pensioner.tenantId, actorType: "USER", actorId: user.id, actorRole: "PENSIONER",
    action: ok ? "login_face" : "login_face_failed", targetType: "pensioner", targetId: pensioner.id,
    details: { distance: distance === null ? null : Number(distance.toFixed(3)), livenessPassed, threshold: rule.config.face.looseDistance, ruleVersion: rule.version },
  });
  if (!ok) {
    return NextResponse.json({
      error: livenessPassed ? "Face did not match. Try again in good light, or use your PIN." : "The movement check did not finish. Try again, or use your PIN.",
      errorUr: livenessPassed ? "چہرہ نہیں ملا۔ روشنی میں دوبارہ کوشش کریں یا پن استعمال کریں۔" : "حرکت کی جانچ مکمل نہیں ہوئی۔ دوبارہ کوشش کریں یا پن استعمال کریں۔",
    }, { status: 401 });
  }
  await endPensionerLogin();
  await setSessionCookie({ id: user.id, tenantId: user.tenantId, role: user.role, name: user.name });
  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role] });
});
