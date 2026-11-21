import { prisma } from "./db";
import { normalizeCnic } from "./names";

// Simulated NADRA photo service. In real life the department would call NADRA with the pensioner's
// CNIC (and her consent) and get back her CNIC photo. Here NADRA is a mock: each record can hold a
// face print (128 numbers) loaded on the "Mock NADRA" admin screen, from an AI-generated face or a
// team member who agreed. No real person's photo is ever used, and no photo is stored, only numbers.

/** CNIC photos older than this are likely to match an elderly face weakly. */
export const OLD_PHOTO_YEARS = 8;

export async function nadraRecordForCnic(cnic: string | null | undefined) {
  const want = normalizeCnic(cnic);
  if (!want) return null;
  const all = await prisma.mockNadraRecord.findMany({ where: { cnic: { not: null } } });
  return all.find((r) => normalizeCnic(r.cnic) === want) ?? null;
}

export function photoAgeYears(takenAt: Date | null | undefined) {
  if (!takenAt) return null;
  return Math.floor((Date.now() - takenAt.getTime()) / (365.25 * 86400000));
}

/** CNICs (normalised) that have a usable CNIC photo at (simulated) NADRA, looked up once for a list. */
export async function cnicsWithNadraPhoto() {
  const all = await prisma.mockNadraRecord.findMany({ where: { cnic: { not: null } }, select: { cnic: true, faceDescriptor: true } });
  return new Set(all.filter((r) => r.faceDescriptor.length === 128).map((r) => normalizeCnic(r.cnic)).filter(Boolean) as string[]);
}
