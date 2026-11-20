import { prisma } from "./db";
import { HttpError, type SessionUser } from "./auth";
import { assertPensionerAccess, type DataField } from "./consent";

export async function loadCaseFor(user: SessionUser, caseId: string, field: DataField = "case_status") {
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: { pensioner: true } });
  if (!c || c.tenantId !== user.tenantId) throw new HttpError(404, "Case not found");
  await assertPensionerAccess(user, c.pensionerId, field);
  return c;
}
