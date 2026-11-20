import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { makePensionBookQr } from "@/lib/qr";

// DEMO ONLY: gives the QR text of the sample (fake) pension book, so judges without a printed book
// can try the pensioner login. A real deployment would not have this route.
export const GET = handle(async () => {
  const p = await prisma.pensioner.findUnique({ where: { pensionNo: "PEN-K-1001" } });
  if (!p) return NextResponse.json({ error: "Sample book not found" }, { status: 404 });
  return NextResponse.json({ qrText: makePensionBookQr({ pensionNo: p.pensionNo, name: p.name, cnic: p.cnicMock ?? "", monthlyAmount: p.monthlyAmount }) });
});
