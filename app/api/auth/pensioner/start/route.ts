import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { verifyPensionBookQr } from "@/lib/qr";
import { startPensionerLogin } from "@/lib/pensioner-login";

// Step 1 of the no-typing pensioner login: the signed QR on their pension book.
const Body = z.object({ qrText: z.string().min(1).max(500) });

export const POST = handle(async (req: Request) => {
  const { qrText } = Body.parse(await req.json());
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`plogin:start:${ip}`, 20, 60);
  const check = verifyPensionBookQr(qrText);
  if (!check.readable || !check.fields) {
    return NextResponse.json({ error: "This is not a Zinda Hon pension book QR.", errorUr: "یہ پنشن بک کا کیو آر نہیں ہے۔" }, { status: 400 });
  }
  if (!check.signatureValid) {
    await audit({ actorType: "SYSTEM", action: "pensioner_login_forged_book", details: { pensionNo: check.fields.pensionNo } });
    return NextResponse.json({ error: "This pension book could not be verified. Please visit the pension office.", errorUr: "یہ پنشن بک تصدیق نہیں ہو سکی۔ پنشن آفس تشریف لائیں۔" }, { status: 400 });
  }
  const pensioner = await prisma.pensioner.findUnique({ where: { pensionNo: check.fields.pensionNo }, include: { user: true } });
  if (!pensioner?.user || !pensioner.user.active) {
    return NextResponse.json({ error: "This pension book has no app account yet. Please ask your helper or the pension office.", errorUr: "اس پنشن بک کا ابھی کوئی اکاؤنٹ نہیں۔ اپنے مددگار یا پنشن آفس سے رابطہ کریں۔" }, { status: 404 });
  }
  await startPensionerLogin(pensioner.user.id, pensioner.id);
  await audit({ tenantId: pensioner.tenantId, actorType: "USER", actorId: pensioner.user.id, actorRole: "PENSIONER", action: "pensioner_login_book_scanned", targetType: "pensioner", targetId: pensioner.id });
  return NextResponse.json({
    name: pensioner.name,
    nameUr: pensioner.nameUr,
    hasFace: pensioner.enrolledFaceDescriptor.length === 128,
    hasPin: Boolean(pensioner.user.pinHash),
  });
});
