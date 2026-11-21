// Length checks for CNIC and mobile numbers, shown live under the field.
// CNIC: 13 digits, shown as 00000-0000000-0. Mobile: 11 digits starting with 03 (Pakistan).

export const CNIC_KEYS = ["cnic", "husbandCnic"] as const;
export const PHONE_KEYS = ["phone", "helperPhone"] as const;

const digits = (v: string) => v.replace(/\D/g, "");

/** Keeps only digits (at most 13) and adds the dashes: 00000-0000000-0. */
export function formatCnic(v: string) {
  const d = digits(v).slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

/** Keeps only digits, at most 11. */
export function formatPhone(v: string) {
  return digits(v).slice(0, 11);
}

export type Check = { ok: boolean; en: string; ur: string } | null;

export function checkCnic(v: string, optional = false): Check {
  const n = digits(v).length;
  if (n === 0) return optional ? null : { ok: false, en: "CNIC has 13 digits: 00000-0000000-0", ur: "شناختی کارڈ میں 13 ہندسے ہوتے ہیں" };
  if (n === 13) return { ok: true, en: "Correct length: 13 digits", ur: "درست: 13 ہندسے" };
  return { ok: false, en: `${n} of 13 digits. A CNIC has exactly 13.`, ur: `13 میں سے ${n} ہندسے۔ شناختی کارڈ میں پورے 13 ہوتے ہیں۔` };
}

export function checkPhone(v: string): Check {
  const d = digits(v);
  if (d.length === 0) return { ok: false, en: "Mobile number has 11 digits and starts with 03", ur: "موبائل نمبر میں 11 ہندسے ہوتے ہیں اور 03 سے شروع ہوتا ہے" };
  if (!d.startsWith("03")) return { ok: false, en: "A mobile number starts with 03", ur: "موبائل نمبر 03 سے شروع ہوتا ہے" };
  if (d.length === 11) return { ok: true, en: "Correct length: 11 digits", ur: "درست: 11 ہندسے" };
  return { ok: false, en: `${d.length} of 11 digits. A mobile number has exactly 11.`, ur: `11 میں سے ${d.length} ہندسے۔ موبائل نمبر میں پورے 11 ہوتے ہیں۔` };
}
