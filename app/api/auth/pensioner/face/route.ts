import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { ROLE_HOME, setSessionCookie } from "@/lib/auth";
import { getActiveRule } from "@/lib/rules";
import { faceDistance } from "@/lib/case-service";
import { endPensionerLogin, readPensionerLogin } from "@/lib/pensioner-login";
import { prisma } from "@/lib/db";
import { followedSequence, verifyTicket } from "@/lib/liveness";
import { closestOtherPensioner, looksLikeSomeoneElse } from "@/lib/face-guard";

// Step 2 (main path): face + liveness against the face enrolled at the pension office.
// This only logs her in. The yearly proof-of-life decision checks the face again with its own, stricter rule.
// The phone's own "liveness passed" is NOT trusted on its own: it must carry the server-signed, one-time
// ticket for this login, and the movements must be done in the order the server chose.
const Body = z.object({
  descriptor: z.array(z.number().finite()).length(128),
  livenessPassed: z.boolean(),
  ticket: z.string().max(600).optional(),
  challenges: z.array(z.object({ action: z.string().max(20), done: z.boolean(), ms: z.number().nonnegative() })).max(6).default([]),
});

export const POST = handle(async (req: Request) => {
  const { descriptor, livenessPassed: claimed, ticket, challenges } = Body.parse(await req.json());
  const { user, pensioner } = await readPensionerLogin();
  const t = verifyTicket(ticket, `login:${pensioner.id}`);
  let ticketState: string = t.ok ? "ok" : t.reason;
  if (t.ok) {
    const used = await prisma.auditLog.findFirst({ where: { targetId: pensioner.id, action: { in: ["login_face", "login_face_failed"] }, details: { path: ["nonce"], equals: t.nonce } }, select: { id: true } });
    if (used) ticketState = "reused";
    else if (!followedSequence(t.sequence, challenges)) ticketState = "wrong_order";
  }
  const livenessPassed = claimed && ticketState === "ok" && challenges.length >= 2 && challenges.every((c) => c.done && c.ms >= 150);
  await rateLimit(`plogin:face:${pensioner.id}`, 5, 600);
  await rateLimit(`plogin:face:day:${pensioner.id}`, 20, 86400);
  if (pensioner.enrolledFaceDescriptor.length !== 128) {
    return NextResponse.json({ error: "Your face is not registered yet. Please use your PIN.", errorUr: "آپ کا چہرہ ابھی رجسٹر نہیں۔ اپنا پن استعمال کریں۔", usePin: true }, { status: 409 });
  }
  const rule = await getActiveRule(pensioner.tenantId);
  const distance = faceDistance(descriptor, pensioner.enrolledFaceDescriptor);
  // Login uses the STRICT face rule (the same one proof of life needs for a pass), and the face must not
  // look like another registered pensioner, such as a sister. If it fails, she can use her PIN, which
  // only opens the app: proof of life always needs her live face.
  const other = await closestOtherPensioner(pensioner.tenantId, pensioner.id, descriptor);
  const someoneElse = looksLikeSomeoneElse(distance, other, rule.config.face.looseDistance);
  const ok = livenessPassed && distance !== null && distance <= rule.config.face.strictDistance && !someoneElse;
  await audit({
    tenantId: pensioner.tenantId, actorType: "USER", actorId: user.id, actorRole: "PENSIONER",
    action: ok ? "login_face" : someoneElse ? "login_face_other_person" : "login_face_failed", targetType: "pensioner", targetId: pensioner.id,
    details: { distance: distance === null ? null : Number(distance.toFixed(3)), livenessPassed, clientSaidPassed: claimed, ticket: ticketState, nonce: t.ok ? t.nonce : null, threshold: rule.config.face.strictDistance, looksLike: someoneElse ? other?.pensionNo : undefined, ruleVersion: rule.version },
  });
  if (!ok) {
    return NextResponse.json({
      error: someoneElse ? "This face looks like a different registered person. If this is you, use your PIN or visit the pension office." : livenessPassed ? "Face did not match. Try again in good light, or use your PIN." : "The movement check did not finish. Try again, or use your PIN.",
      errorUr: someoneElse ? "یہ چہرہ کسی اور رجسٹرڈ شخص جیسا لگتا ہے۔ اگر یہ آپ ہیں تو پن استعمال کریں یا پنشن آفس آئیں۔" : livenessPassed ? "چہرہ نہیں ملا۔ روشنی میں دوبارہ کوشش کریں یا پن استعمال کریں۔" : "حرکت کی جانچ مکمل نہیں ہوئی۔ دوبارہ کوشش کریں یا پن استعمال کریں۔",
    }, { status: 401 });
  }
  await endPensionerLogin();
  await setSessionCookie({ id: user.id, tenantId: user.tenantId, role: user.role, name: user.name });
  return NextResponse.json({ ok: true, home: ROLE_HOME[user.role] });
});
