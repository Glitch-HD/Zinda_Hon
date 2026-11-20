import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireApiKey } from "@/lib/apikeys";
import { classifyMessage, CLAUDE_MODEL } from "@/lib/claude";
import { heuristicSigns, routeMessage } from "@/lib/scam";
import { audit } from "@/lib/audit";

const Body = z.object({ text: z.string().min(3).max(2000), sender: z.string().max(50).optional() });

export const POST = handle(async (req: Request) => {
  const key = await requireApiKey(req, "messages:check");
  const { text, sender } = Body.parse(await req.json());
  const h = heuristicSigns(text);
  const ai = await classifyMessage(text, sender ?? null, { pendingPayment: null });
  let label: "scam" | "genuine" | "unsure" = ai?.data.label ?? (h.score >= 0.7 ? "scam" : "unsure");
  let confidence = ai?.data.confidence ?? (h.score >= 0.7 ? h.score : 0.5);
  if (label === "genuine" && h.score >= 0.5) { label = "unsure"; confidence = Math.min(confidence, 0.6); }
  await audit({ tenantId: key.tenantId, actorType: "API_CLIENT", actorId: key.prefix, action: `api_message_${label}`, details: { confidence } });
  return NextResponse.json({ label, confidence, route: routeMessage(label, confidence), signs: h.signs.map((s) => s.id), model: ai ? CLAUDE_MODEL : null });
});
