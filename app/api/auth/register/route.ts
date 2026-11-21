import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { nameSimilarity, normalizeCnic } from "@/lib/names";

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
  password: z.string().min(8).max(100),
  pin: z.string().regex(/^\d{4}$/).optional(),
});

export async function GET() {
  const offices = await prisma.tenant.findMany({ select: { id: true, name: true, nameUr: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ offices });
}

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`register:${ip}`, 5, 3600);
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

  // Automatic checks, shown to the officer. Mock NADRA by CNIC; for a pensioner also the pension record.
  const nadra = (await prisma.mockNadraRecord.findMany()).find((r) => normalizeCnic(r.cnic) === cnic) ?? null;
  const death = (await prisma.mockDeathRecord.findMany()).find((d) => normalizeCnic(d.cnic) === cnic) ?? null;
  const checks: Record<string, unknown> = {
    nadraFound: Boolean(nadra), nadraName: nadra?.name ?? null,
    nameSimilarity: nadra ? Math.round(nameSimilarity(nadra.name, b.name) * 100) / 100 : null,
    dobMatches: nadra && b.dateOfBirth ? nadra.dateOfBirth?.toISOString().slice(0, 10) === b.dateOfBirth : null,
    deathRecordFound: Boolean(death),
  };
  if (b.role === "PENSIONER") {
    const p = await prisma.pensioner.findUnique({ where: { pensionNo: b.pensionNo!.toUpperCase() } });
    if (!p || p.tenantId !== tenant.id) throw new HttpError(404, "We could not find this pension number at this office. Please check your pension book, or ask your helper.");
    if (p.userId) throw new HttpError(409, "This pension already has an account. If you lost access, please visit the pension office.");
    checks.pensionRecordName = p.name;
    checks.pensionNameSimilarity = Math.round(nameSimilarity(p.name, b.name) * 100) / 100;
    checks.pensionCnicMatches = p.cnicMock ? normalizeCnic(p.cnicMock) === cnic : null;
  }
  const r = await prisma.registration.create({
    data: {
      tenantId: tenant.id, role: b.role, name: b.name, cnic, phone, area: b.area || null,
      dateOfBirth: b.dateOfBirth ? new Date(`${b.dateOfBirth}T00:00:00Z`) : null, pensionNo: b.pensionNo?.toUpperCase() ?? null,
      passwordHash: await bcrypt.hash(b.password, 10), pinHash: b.pin ? await bcrypt.hash(b.pin, 10) : null, checks: checks as object,
    },
  });
  await audit({ tenantId: tenant.id, actorType: "SYSTEM", action: "registration_submitted", targetType: "registration", targetId: r.id, details: { role: b.role, ...checks } });
  return NextResponse.json({ ok: true, message: "Thank you. A pension officer will check your details against the records, usually within one working day. Then you can log in with your phone number and password." });
});
