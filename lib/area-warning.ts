import { prisma } from "./db";

// Area early warning. When people in the same area have reported scam messages in the last 7 days,
// pensioners and helpers there see (and hear, in Urdu) which trick is going round, before it reaches
// them. Only messages real users reported count: the labelled test set has no submitter.

const ADVICE: Record<string, { en: string; ur: string }> = {
  asks_pin_otp: { en: "Never tell anyone a code or PIN. The pension office never asks for one.", ur: "کسی کو بھی کوڈ یا پن نہ بتائیں۔ پنشن آفس کبھی کوڈ نہیں مانگتا۔" },
  fee_to_release: { en: "There is never a fee to receive your pension. Do not send money.", ur: "پنشن لینے کے لیے کبھی کوئی فیس نہیں ہوتی۔ پیسے نہ بھیجیں۔" },
  cnic_photo: { en: "Do not send a photo of your CNIC to anyone who messages you.", ur: "پیغام بھیجنے والے کو اپنے شناختی کارڈ کی تصویر نہ بھیجیں۔" },
  relief_payment: { en: "Fake relief payment messages are going round. Real relief never asks for a code or fee.", ur: "امداد کے جھوٹے پیغام آ رہے ہیں۔ اصلی امداد کبھی کوڈ یا فیس نہیں مانگتی۔" },
  has_link: { en: "Do not open links in messages about your pension.", ur: "پنشن کے بارے میں پیغام میں آئے لنک نہ کھولیں۔" },
  prize: { en: "Prize messages are a trick. You did not win anything.", ur: "انعام کے پیغام دھوکہ ہیں۔" },
};
const DEFAULT = { en: "If a message about your pension asks for money or a code, check it here first.", ur: "پنشن کے بارے میں کوئی پیغام پیسے یا کوڈ مانگے تو پہلے یہاں جانچیں۔" };

export type AreaWarning = { area: string; count: number; trickEn: string; trickUr: string; adviceEn: string; adviceUr: string };

export async function areaScamWarning(tenantId: string, area: string | null | undefined): Promise<AreaWarning | null> {
  if (!area) return null;
  const since = new Date(Date.now() - 7 * 86400_000);
  const rows = await prisma.checkedMessage.findMany({
    where: { tenantId, area: { equals: area, mode: "insensitive" }, createdAt: { gte: since }, submittedById: { not: null }, AND: [
      { OR: [{ label: "scam" }, { reviewedLabel: "scam" }] },
      // An officer can overrule: a message they marked genuine does not count. (NULL means not reviewed.)
      { OR: [{ reviewedLabel: null }, { reviewedLabel: { not: "genuine" } }] },
    ] },
    select: { reasons: true }, take: 200,
  });
  if (!rows.length) return null;
  const tally = new Map<string, { n: number; en: string; ur: string }>();
  for (const r of rows) {
    for (const s of ((r.reasons as { signs?: { id: string; en: string; ur: string }[] })?.signs ?? [])) {
      if (s.id === "urgency" || s.id === "talks_to_the_checker") continue;
      const t = tally.get(s.id) ?? { n: 0, en: s.en, ur: s.ur };
      t.n++; tally.set(s.id, t);
    }
  }
  const top = [...tally.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  const advice = (top && ADVICE[top[0]]) || DEFAULT;
  return { area, count: rows.length, trickEn: top?.[1].en ?? "Messages asking for money or codes", trickUr: top?.[1].ur ?? "پیسے یا کوڈ مانگنے والے پیغام", adviceEn: advice.en, adviceUr: advice.ur };
}
