import { HttpError } from "./auth";
import { normalizeCnic } from "./names";

// Checks and cleans a "correct my data" value, both when she asks and again when an officer accepts it.
export function cleanCorrectionValue(field: string, v: string) {
  const t = v.trim();
  if (field === "cnicMock") {
    const c = normalizeCnic(t);
    if (!c || !/^00000\d{8}$/.test(c)) throw new HttpError(400, "The new CNIC must be a mock CNIC with 13 digits starting 00000");
    return c.replace(/^(\d{5})(\d{7})(\d)$/, "$1-$2-$3");
  }
  if (field === "dateOfBirth") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) throw new HttpError(400, "The date of birth must look like 1950-03-21");
    const d = new Date(`${t}T00:00:00Z`);
    const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
    if (age < 18 || age > 120) throw new HttpError(400, "That date of birth is not possible for a pensioner");
    return d;
  }
  if (field === "bankAccountNo") {
    if (!/^[A-Z0-9-]{6,34}$/i.test(t)) throw new HttpError(400, "The bank account must be 6 to 34 letters or digits");
    return t.toUpperCase();
  }
  if (t.length < 3 || t.length > 80) throw new HttpError(400, "A name must be 3 to 80 characters");
  return t;
}

