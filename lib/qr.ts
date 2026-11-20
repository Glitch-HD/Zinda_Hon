import { createHmac, timingSafeEqual } from "node:crypto";

// Signed QR codes on mock pension books (Challenge 08: forged or edited documents).
// The QR holds the book's key fields plus a signature made with a secret only the server knows.
// If anyone edits a field (for example the amount or the name), the signature no longer matches.

const VERSION = "ZH1";

function key() {
  const s = process.env.QR_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("QR_SIGNING_SECRET must be set to at least 32 characters");
  return s;
}

export type PensionBookFields = { pensionNo: string; name: string; cnic: string; monthlyAmount: number };

function payload(f: PensionBookFields) {
  return [VERSION, f.pensionNo, f.name, f.cnic, String(f.monthlyAmount)].join("|");
}

function sign(p: string) {
  return createHmac("sha256", key()).update(p).digest("hex").slice(0, 24);
}

export function makePensionBookQr(f: PensionBookFields) {
  const p = payload(f);
  return `${p}|${sign(p)}`;
}

export type QrCheck =
  | { readable: false }
  | { readable: true; signatureValid: boolean; fields: PensionBookFields | null };

export function verifyPensionBookQr(text: string | null | undefined): QrCheck {
  if (!text) return { readable: false };
  const parts = text.trim().split("|");
  if (parts.length !== 6 || parts[0] !== VERSION) return { readable: true, signatureValid: false, fields: null };
  const [, pensionNo, name, cnic, amount, sig] = parts;
  const fields = { pensionNo, name, cnic, monthlyAmount: Number(amount) };
  const expected = Buffer.from(sign(payload(fields)));
  const given = Buffer.from(sig);
  const signatureValid = expected.length === given.length && timingSafeEqual(expected, given);
  return { readable: true, signatureValid, fields };
}
