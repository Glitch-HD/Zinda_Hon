import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { requireUser, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveRule } from "@/lib/rules";
import { faceDistance } from "@/lib/case-service";
import { followedSequence, verifyTicket } from "@/lib/liveness";
import { closestOtherPensioner, looksLikeSomeoneElse } from "@/lib/face-guard";
import { pinProblem } from "@/lib/secrets-check";

// Change my PIN (pensioners only). Knowing her PIN is not enough: a son who watched her type it must
// also pass her LIVE face check, with movements in the order the server chose, using the strict face rule.
// On success every other login ends, the change is audited, and she gets a message.
const Body = z.object({
  currentPin: z.string().regex(/^\d{4}$/),
  newPin: z.string().max(10),
  descriptor: z.array(z.number().finite()).length(128),
  livenessPassed: z.boolean(),
  ticket: z.string().max(600).optional(),
  challenges: z.array(z.object({ action: z.string().max(20), done: z.boolean(), ms: z.number().nonnegative() })).max(6).default([]),
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser(["PENSIONER"]);
  const b = Body.parse(await req.json());
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const pensioner = await prisma.pensioner.findUnique({ where: { userId: me.id } });
  if (!pensioner) return NextResponse.json({ error: "No pension record" }, { status: 404 });
  await rateLimit(`pinchange:${pensioner.id}`, 5, 86400);
  const fail = async (reason: string, en: string, ur: string, status = 401, extra: Record<string, unknown> = {}) => {
    await audit({ tenantId: pensioner.tenantId, actorType: "USER", actorId: user.id, actorRole: "PENSIONER", action: "pin_change_failed", targetType: "pensioner", targetId: pensioner.id, details: { reason, ...extra } as never });
    return NextResponse.json({ error: en, errorUr: ur }, { status });
  };

  if (!user.pinHash || !(await bcrypt.compare(b.currentPin, user.pinHash))) return fail("wrong_current_pin", "Your current PIN is not right.", "آپ کا موجودہ پن غلط ہے۔");
  const weak = pinProblem(b.newPin, pensioner.dateOfBirth?.getUTCFullYear());
  if (weak) return fail("weak_new_pin", weak.en, weak.ur, 400);
  if (await bcrypt.compare(b.newPin, user.pinHash)) return fail("same_pin", "The new PIN must be different.", "نیا پن پرانے سے مختلف ہونا چاہیے۔", 400);

  // Live face, as for login: signed one-time ticket, right order of movements, strict match, not a look-alike.
  const t = verifyTicket(b.ticket, `pinchange:${pensioner.id}`);
  let ticketState: string = t.ok ? "ok" : t.reason;
  if (t.ok) {
    const used = await prisma.auditLog.findFirst({ where: { targetId: pensioner.id, action: { in: ["pin_changed", "pin_change_failed"] }, details: { path: ["nonce"], equals: t.nonce } }, select: { id: true } });
    if (used) ticketState = "reused";
    else if (!followedSequence(t.sequence, b.challenges)) ticketState = "wrong_order";
  }
  const nonce = t.ok ? t.nonce : null;
  const live = b.livenessPassed && ticketState === "ok" && b.challenges.length >= 2 && b.challenges.every((c) => c.done && c.ms >= 150);
  if (pensioner.enrolledFaceDescriptor.length !== 128) return fail("no_face_enrolled", "Your face is not registered yet. Please visit the pension office to change your PIN.", "آپ کا چہرہ رجسٹر نہیں۔ پن بدلنے کے لیے پنشن آفس آئیں۔", 409, { nonce });
  const rule = await getActiveRule(pensioner.tenantId);
  const distance = faceDistance(b.descriptor, pensioner.enrolledFaceDescriptor);
  const other = await closestOtherPensioner(pensioner.tenantId, pensioner.id, b.descriptor);
  const someoneElse = looksLikeSomeoneElse(distance, other, rule.config.face.looseDistance);
  const faceOk = live && distance !== null && distance <= rule.config.face.strictDistance && !someoneElse;
  if (!faceOk) {
    return fail(someoneElse ? "face_other_person" : !live ? "liveness_" + ticketState : "face_mismatch",
      someoneElse ? "This face looks like a different registered person. Only the pensioner herself can change her PIN." : !live ? "The movement check did not finish. Please try again." : "The face did not match. Try again in good light.",
      someoneElse ? "یہ چہرہ کسی اور رجسٹرڈ شخص جیسا ہے۔ پن صرف پنشنر خود بدل سکتی ہیں۔" : !live ? "حرکت کی جانچ مکمل نہیں ہوئی۔ دوبارہ کوشش کریں۔" : "چہرہ نہیں ملا۔ روشنی میں دوبارہ کوشش کریں۔",
      401, { nonce, distance: distance === null ? null : Number(distance.toFixed(3)), looksLike: someoneElse ? other?.pensionNo : undefined });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash(b.newPin, 10), sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  await Promise.all([
    audit({ tenantId: pensioner.tenantId, actorType: "USER", actorId: user.id, actorRole: "PENSIONER", action: "pin_changed", targetType: "pensioner", targetId: pensioner.id, details: { nonce, distance: Number(distance!.toFixed(3)), otherLoginsEnded: true } }),
    prisma.notification.create({ data: { userId: user.id, title: "Your PIN was changed", body: "Your PIN was changed after a live face check, and every other login was signed out. If this was not you, tell the pension office at once." } }),
    setSessionCookie({ ...me, sv: updated.sessionVersion }),
  ]);
  return NextResponse.json({ ok: true });
});
