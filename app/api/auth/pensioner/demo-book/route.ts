import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/api";
import { makePensionBookQr } from "@/lib/qr";

// DEMO ONLY: gives the QR text of a sample (fake) pension book, so judges without a printed book
// can try the pensioner login. A real deployment would not have this route.
const SAMPLE_BOOKS = ["PEN-K-1001", "PEN-K-1011", "PEN-K-1012"];

export const GET = handle(async (req: Request) => {
  const asked = new URL(req.url).searchParams.get("no") ?? SAMPLE_BOOKS[0];
  if (!SAMPLE_BOOKS.includes(asked)) return NextResponse.json({ error: "Not a sample book" }, { status: 400 });
  const p = await prisma.pensioner.findUnique({ where: { pensionNo: asked } });
  if (!p) return NextResponse.json({ error: "Sample book not found" }, { status: 404 });
  return NextResponse.json({ qrText: makePensionBookQr({ pensionNo: p.pensionNo, name: p.name, cnic: p.cnicMock ?? "", monthlyAmount: p.monthlyAmount }) });
});
