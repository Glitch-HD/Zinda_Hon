import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { jaroWinkler, nameSimilarity, normalizeCnic } from "@/lib/names";

// Sign-up for new people. It only creates a REQUEST: a pension officer checks it against the mock NADRA
// record (and the pension record, for a pensioner) before any account exists. This is a prototype, so
// only mock CNICs (starting 00000) and mock phone numbers (0300000xxxx) are accepted: never real data.

const Body = z.object({
  tenantId: z.string().min(5).max(40),
  role: z.enum(["PENSIONER", "HELPER", "SHOPKEEPER"]),
  name: z.string().trim().min(3).max(80),
  cnic: z.string().max(20),
  phone: z.string().max(20),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  area: z.string().trim().max(60).optional(),
  pensionNo: z.string().trim().max(20).optional(),
  password: z.string().min(8).max(100).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  // A widow (family pension): her late husband, and the death certificate (mock number only, no upload).
  pensionType: z.enum(["family", "self"]).optional(),
  husbandName: z.string().trim().max(80).optional(),
  husbandCnic: z.string().max(20).optional(),
  husbandDeathDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deathCertNo: z.string().trim().max(30).optional(),
  // A shop.
  shopName: z.string().trim().max(80).optional(),
  shopAddress: z.string().trim().max(120).optional(),
  // Someone filled this for her (she cannot read or write).
  assistedBy: z.object({ name: z.string().trim().min(3).max(80), phone: z.string().max(20), relation: z.string().trim().min(2).max(40) }).optional(),
});

const isUrdu = (t: string) => /[\u0600-\u06FF]/.test(t);
const urduSimilarity = (a: string, b: string) => jaroWinkler(a.replace(/[^\u0600-\u06FF]/g, ""), b.replace(/[^\u0600-\u06FF]/g, ""));

export async function GET() {
  const offices = await prisma.tenant.findMany({ select: { id: true, name: true, nameUr: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ offices });
}

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`register:${ip}`, 10, 3600);
  const b = Body.parse(await req.json());
  const cnic = normalizeCnic(b.cnic);
  if (!cnic || !/^00000\d{8}$/.test(cnic)) throw new HttpError(400, "Please use a mock CNIC that starts with 00000 (for example 00000-1234567-1). This prototype never takes real CNIC numbers.");
  const phone = b.phone.replace(/\D/g, "");
  if (!/^0300000\d{4}$/.test(phone)) throw new HttpError(400, "Please use a mock phone number like 03000001234 (0300000 and 4 digits). This prototype never takes real phone numbers.");
  const tenant = await prisma.tenant.findUnique({ where: { id: b.tenantId } });
  if (!tenant) throw new HttpError(400, "Choose your pension office");
  if (await prisma.user.findUnique({ where: { phone } })) throw new HttpError(409, "An account with this phone number already exists. Please log in.");
  if (await prisma.registration.findFirst({ where: { status: "pending", OR: [{ phone }, { cnic }] } })) throw new HttpError(409, "A sign-up with this phone or CNIC is already waiting for the pension office.");
  if (b.role === "PENSIONER" && !b.pensionNo) throw new HttpError(400, "Enter the pension number from your pension book");
  if (!b.password && !(b.role === "PENSIONER" && b.pin)) throw new HttpError(400, "Choose a password (8 or more letters), or for a pensioner a 4-digit PIN");
  const widow = b.role === "PENSIONER" && b.pensionType === "family";
  if (widow && !b.husbandName) throw new HttpError(400, "For a family (widow's) pension, enter your late husband's name");
  if (b.role === "SHOPKEEPER" && !b.shopName) throw new HttpError(400, "Enter the name of your shop");
  const husbandCnic = b.husbandCnic ? normalizeCnic(b.husbandCnic) : null;
  if (b.husbandCnic && (!husbandCnic || !/^00000\d{8}$/.test(husbandCnic))) throw new HttpError(400, "Your husband's CNIC must also be a mock number starting with 00000");
  let assistedBy: { name: string; phone: string; relation: string } | null = null;
  if (b.assistedBy) {
    const ap = b.assistedBy.phone.replace(/\D/g, "");
    if (!/^0300000\d{4}$/.test(ap)) throw new HttpError(400, "The helper's phone must also be a mock number like 03000001234");
    if (ap === phone) throw new HttpError(400, "The helper's phone must be different from hers");
    assistedBy = { name: b.assistedBy.name, phone: ap, relation: b.assistedBy.relation };
  }

  // Automatic checks, shown to the officer. Mock NADRA by CNIC; for a pensioner also the pension record.
  const nadra = (await prisma.mockNadraRecord.findMany()).find((r) => normalizeCnic(r.cnic) === cnic) ?? null;
  const death = (await prisma.mockDeathRecord.findMany()).find((d) => normalizeCnic(d.cnic) === cnic) ?? null;
  const spokenInUrdu = isUrdu(b.name);
  const checks: Record<string, unknown> = {
    nadraFound: Boolean(nadra), nadraName: nadra?.name ?? null, spokenInUrdu,
    // A name said in Urdu cannot be compared with NADRA's English spelling; the officer compares it.
    nameSimilarity: nadra && !spokenInUrdu ? Math.round(nameSimilarity(nadra.name, b.name) * 100) / 100 : null,
    dobMatches: nadra && b.dateOfBirth ? nadra.dateOfBirth?.toISOString().slice(0, 10) === b.dateOfBirth : null,
    deathRecordFound: Boolean(death),
  };
  if (b.role === "PENSIONER") {
    const p = await prisma.pensioner.findUnique({ where: { pensionNo: b.pensionNo!.toUpperCase() } });
    if (!p || p.tenantId !== tenant.id) throw new HttpError(404, "We could not find this pension number at this office. Please check your pension book, or ask your helper.");
    if (p.userId) throw new HttpError(409, "This pension already has an account. If you lost access, please visit the pension office.");
    checks.pensionRecordName = spokenInUrdu && p.nameUr ? p.nameUr : p.name;
    checks.pensionNameSimilarity = Math.round((spokenInUrdu ? (p.nameUr ? urduSimilarity(p.nameUr, b.name) : 0) : nameSimilarity(p.name, b.name)) * 100) / 100;
    checks.pensionType = p.pensionType;
    if (b.pensionType && b.pensionType !== p.pensionType) checks.pensionTypeMismatch = true;
    if (widow) {
      // The husband: NADRA lists him on her record, the pension record names him, and the death registry
      // must have his death (a family pension is only due after it).
      const hName = b.husbandName!;
      const hUrdu = isUrdu(hName);
      checks.husbandOnNadra = nadra?.fatherOrHusbandName ?? null;
      checks.husbandNadraSimilarity = nadra?.fatherOrHusbandName && !hUrdu ? Math.round(nameSimilarity(nadra.fatherOrHusbandName, hName) * 100) / 100 : null;
      checks.husbandOnPensionRecord = p.fatherOrHusbandName ?? null;
      checks.husbandPensionSimilarity = p.fatherOrHusbandName && !hUrdu ? Math.round(nameSimilarity(p.fatherOrHusbandName, hName) * 100) / 100 : null;
      const deaths = await prisma.mockDeathRecord.findMany();
      const hDeath = (husbandCnic ? deaths.find((d) => normalizeCnic(d.cnic) === husbandCnic) : null)
        ?? (!hUrdu ? deaths.find((d) => nameSimilarity(d.name, hName) >= 0.85) : null) ?? null;
      checks.husbandDeathFound = Boolean(hDeath);
      checks.husbandDeathName = hDeath?.name ?? null;
      checks.husbandDeathDate = hDeath ? hDeath.dateOfDeath.toISOString().slice(0, 10) : null;
      checks.husbandDeathDateMatches = hDeath && b.husbandDeathDate ? checks.husbandDeathDate === b.husbandDeathDate : null;
      checks.husbandDeathRegisteredAt = hDeath?.registeredAt ?? null;
    }
    checks.pensionCnicMatches = p.cnicMock ? normalizeCnic(p.cnicMock) === cnic : null;
  }
  const r = await prisma.registration.create({
    data: {
      tenantId: tenant.id, role: b.role, name: b.name, cnic, phone, area: b.area || null,
      dateOfBirth: b.dateOfBirth ? new Date(`${b.dateOfBirth}T00:00:00Z`) : null, pensionNo: b.pensionNo?.toUpperCase() ?? null,
      // No password (a pensioner who only chose a PIN): store a random one nobody knows.
      passwordHash: await bcrypt.hash(b.password ?? crypto.randomUUID(), 10), pinHash: b.pin ? await bcrypt.hash(b.pin, 10) : null, checks: checks as object,
      details: (b.role === "PENSIONER"
        ? { pensionType: b.pensionType ?? null, husbandName: b.husbandName ?? null, husbandCnic, husbandDeathDate: b.husbandDeathDate ?? null, deathCertNo: b.deathCertNo ?? null }
        : b.role === "SHOPKEEPER" ? { shopName: b.shopName, shopAddress: b.shopAddress ?? null } : {}) as object,
      ...(assistedBy ? { assistedBy } : {}),
    },
  });
  await audit({ tenantId: tenant.id, actorType: "SYSTEM", action: "registration_submitted", targetType: "registration", targetId: r.id, details: { role: b.role, assisted: Boolean(assistedBy), ...checks } });
  return NextResponse.json({ ok: true, message: "Thank you. A pension officer will check your details against the records, usually within one working day. Then you can log in" + (b.password ? " with your phone number and password." : " with your pension book and face, or your PIN.") });
});
