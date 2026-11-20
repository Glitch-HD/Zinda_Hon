import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { HttpError } from "./auth";
import { audit } from "./audit";

// Consent and take-back (Challenge 06). Every read of a pensioner's data by someone other than
// the pensioner or their department's staff goes through here. Withdrawal is effective at once,
// because consent is checked on every request rather than cached in the login token.

export type DataField = "name" | "cnic" | "face" | "bank_account" | "case_status";

export async function hasConsent(pensionerId: string, granteeId: string, field: DataField) {
  const c = await prisma.consent.findFirst({
    where: { pensionerId, granteeId, withdrawnAt: null, fields: { has: field } },
    select: { id: true },
  });
  return Boolean(c);
}

/**
 * Throws 403 unless the user may access this pensioner's data.
 * Officers, admins and auditors of the same department may (their access is itself audited).
 * Pensioners may access their own data. Helpers need an active link AND active consent for the field.
 */
export async function assertPensionerAccess(user: SessionUser, pensionerId: string, field: DataField) {
  const p = await prisma.pensioner.findUnique({ where: { id: pensionerId }, select: { tenantId: true, userId: true } });
  if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Pensioner not found");
  if (["OFFICER", "ADMIN", "AUDITOR"].includes(user.role)) return;
  if (user.role === "PENSIONER" && p.userId === user.id) return;
  if (user.role === "HELPER") {
    const link = await prisma.helperLink.findFirst({ where: { helperId: user.id, pensionerId, active: true } });
    if (link && (await hasConsent(pensionerId, user.id, field))) return;
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "access_denied_no_consent", targetType: "pensioner", targetId: pensionerId, details: { field } });
    throw new HttpError(403, "This person has not given you permission, or has withdrawn it");
  }
  throw new HttpError(403, "Not allowed");
}
