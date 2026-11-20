import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { classifyMessage, CLAUDE_MODEL } from "@/lib/claude";
import { heuristicSigns, routeMessage } from "@/lib/scam";

const Body = z.object({ text: z.string().min(3).max(2000), sender: z.string().max(50).optional(), area: z.string().max(80).optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["PENSIONER", "HELPER", "SHOPKEEPER", "OFFICER"]);
  await rateLimit(`scam:${user.id}`, 30, 60);
  const body = Body.parse(await req.json());
  const started = Date.now();

  // Cross-check with our own (mock) records: does this person really have a pending payment?
  const pensioner = user.role === "PENSIONER" ? await prisma.pensioner.findUnique({ where: { userId: user.id } }) : null;
  const pendingPayment = pensioner ? false : null; // mock: payments are automatic, never "pending release"

  const h = heuristicSigns(body.text);
  const ai = await classifyMessage(body.text, body.sender ?? null, { pendingPayment });

  let label: "scam" | "genuine" | "unsure";
  let confidence: number;
  let source: string;
  if (ai) {
    label = ai.data.label;
    confidence = ai.data.confidence;
    source = "claude";
    // Disagreement between Claude and the warning signs lowers confidence instead of picking a side.
    if (label === "genuine" && h.score >= 0.5) { label = "unsure"; confidence = Math.min(confidence, 0.6); source = "claude+signs_disagree"; }
  } else {
    source = "signs_only";
    if (h.score >= 0.7) { label = "scam"; confidence = h.score; }
    else { label = "unsure"; confidence = 0.5; }
  }
  const route = routeMessage(label, confidence);

  const saved = await prisma.checkedMessage.create({
    data: {
      tenantId: user.tenantId, submittedById: user.id, text: body.text, sender: body.sender, area: body.area ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { area: true } }))?.area ?? null,
      label, confidence, route, modelName: ai ? CLAUDE_MODEL : null,
      reasons: { source, signs: h.signs, signScore: h.score, ai: ai?.data ?? null, ms: Date.now() - started, usage: ai?.usage ?? null },
    },
  });
  await audit({ tenantId: user.tenantId, actorType: "AI", actorId: ai ? CLAUDE_MODEL : "scam-signs", action: `message_${label}`, targetType: "checked_message", targetId: saved.id, details: { confidence, route, source, submittedBy: user.id } });

  return NextResponse.json({
    id: saved.id, label, confidence, route,
    scamType: ai?.data.scam_type ?? null,
    explanationUr: ai?.data.explanation_ur ?? (label === "scam" ? "یہ پیغام دھوکہ لگتا ہے۔ کسی کو پن یا پیسے نہ دیں۔" : "ہمیں یقین نہیں ہے۔ پنشن افسر اسے دیکھے گا۔ تب تک کسی کو پن یا پیسے نہ دیں۔"),
    explanationEn: ai?.data.explanation_en ?? (label === "scam" ? "This message looks like a scam. Do not share a PIN or send money." : "We are not sure. A pension officer will check it. Until then, do not share a PIN or send money."),
    signs: h.signs,
  });
});
