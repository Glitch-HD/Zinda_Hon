import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nadraRecordForCnic } from "@/lib/nadra-face";

// DEMO ONLY: loads a face print into the simulated NADRA registry, standing in for the CNIC photo
// NADRA would already hold. Only admins (who manage the mock services) can do this. Use AI-generated
// faces or a team member who agreed; never a real citizen. "wipe" removes every demo face.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load"), cnic: z.string().max(20), descriptor: z.array(z.number().finite()).length(128) }),
  z.object({ action: z.literal("wipe") }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const body = Body.parse(await req.json());
  if (body.action === "wipe") {
    const [n] = await prisma.$transaction([
      prisma.mockNadraRecord.updateMany({ data: { faceDescriptor: [] } }),
      prisma.pensioner.updateMany({ where: { tenantId: user.tenantId, faceSource: "nadra" }, data: { enrolledFaceDescriptor: [], faceSource: null } }),
    ]);
    await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "mock_nadra_faces_wiped", targetType: "mock_nadra", targetId: "all", details: { records: n.count } });
    return NextResponse.json({ ok: true, wiped: n.count });
  }
  const rec = await nadraRecordForCnic(body.cnic);
  if (!rec) throw new HttpError(404, "No mock NADRA record with this CNIC");
  await prisma.mockNadraRecord.update({ where: { id: rec.id }, data: { faceDescriptor: body.descriptor } });
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "mock_nadra_face_loaded", targetType: "mock_nadra", targetId: rec.id, details: { cnic: rec.cnic, simulated: true } });
  return NextResponse.json({ ok: true });
});
