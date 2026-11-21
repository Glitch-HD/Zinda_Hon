import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// An officer links a helper to a family after the widow agreed (in person or by phone), and records
// exactly what she agreed to share. She is told, sees it on her "My data" page and can withdraw it at
// any time. Bank account details are never shared with a helper. One helper can hold at most 40 families.
const FIELDS = ["name", "cnic", "face", "case_status"] as const;
const MAX_FAMILIES = 40;
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("link"), pensionerId: z.string().min(5).max(40), helperId: z.string().min(5).max(40), fields: z.array(z.enum(FIELDS)).min(1).max(4), note: z.string().max(500) }),
  z.object({ action: z.literal("unlink"), pensionerId: z.string().min(5).max(40), helperId: z.string().min(5).max(40), note: z.string().max(500).default("") }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["OFFICER"]);
  const body = Body.parse(await req.json());
  const [p, helper] = await Promise.all([
    prisma.pensioner.findUnique({ where: { id: body.pensionerId }, select: { id: true, tenantId: true, pensionNo: true, userId: true } }),
    prisma.user.findUnique({ where: { id: body.helperId }, select: { id: true, tenantId: true, role: true, active: true, name: true } }),
  ]);
  if (!p || p.tenantId !== user.tenantId) throw new HttpError(404, "Pensioner not found");
  if (!helper || helper.tenantId !== user.tenantId || helper.role !== "HELPER") throw new HttpError(404, "Helper not found");
  const base = { tenantId: user.tenantId, actorType: "USER" as const, actorId: user.id, actorRole: user.role, targetType: "pensioner", targetId: p.id };

  if (body.action === "unlink") {
    await prisma.$transaction([
      prisma.helperLink.updateMany({ where: { helperId: helper.id, pensionerId: p.id }, data: { active: false } }),
      prisma.consent.updateMany({ where: { pensionerId: p.id, granteeId: helper.id, withdrawnAt: null }, data: { withdrawnAt: new Date() } }),
    ]);
    await audit({ ...base, action: "helper_unlinked", details: { helperId: helper.id, helper: helper.name, note: body.note } });
    return NextResponse.json({ ok: true });
  }

  if (!helper.active) throw new HttpError(409, "This helper's account is switched off");
  if (body.note.trim().length < 15) throw new HttpError(400, "Write at least 15 characters on how she agreed (for example: she agreed in person at the office today)");
  const fields = Array.from(new Set([...body.fields, "case_status" as const]));
  const families = await prisma.helperLink.count({ where: { helperId: helper.id, active: true, pensionerId: { not: p.id } } });
  if (families >= MAX_FAMILIES) throw new HttpError(409, `${helper.name} already helps ${MAX_FAMILIES} families, the most one helper may have.`);
  await prisma.$transaction([
    prisma.helperLink.upsert({ where: { helperId_pensionerId: { helperId: helper.id, pensionerId: p.id } }, create: { helperId: helper.id, pensionerId: p.id }, update: { active: true } }),
    // Close any older permission and record the new one, so the history of what she agreed to stays visible.
    prisma.consent.updateMany({ where: { pensionerId: p.id, granteeId: helper.id, withdrawnAt: null }, data: { withdrawnAt: new Date() } }),
    prisma.consent.create({ data: { pensionerId: p.id, granteeType: "helper", granteeId: helper.id, granteeName: helper.name, fields } }),
  ]);
  if (p.userId) await prisma.notification.create({ data: { userId: p.userId, title: "A helper can now help you", body: `${helper.name} can now help you with: ${fields.join(", ").replaceAll("_", " ")}. You can take this back any time on your My data page.` } });
  await audit({ ...base, action: "helper_linked", details: { helperId: helper.id, helper: helper.name, fields, note: body.note } });
  return NextResponse.json({ ok: true });
});
