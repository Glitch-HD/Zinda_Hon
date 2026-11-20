import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { classifyMessage, CLAUDE_MODEL } from "@/lib/claude";
import { heuristicSigns, routeMessage } from "@/lib/scam";
import { EVAL_MESSAGES } from "@/data/eval-messages";
import { audit } from "@/lib/audit";

export const maxDuration = 300;

// Runs the scam checker over the labelled test set and stores each result with its true label.
export const POST = handle(async () => {
  const user = await requireUser(["ADMIN"]);
  let done = 0;
  for (const m of EVAL_MESSAGES) {
    const started = Date.now();
    const h = heuristicSigns(m.text);
    const ai = await classifyMessage(m.text, m.sender ?? null, { pendingPayment: null });
    let label: "scam" | "genuine" | "unsure" = ai?.data.label ?? (h.score >= 0.7 ? "scam" : "unsure");
    let confidence = ai?.data.confidence ?? (h.score >= 0.7 ? h.score : 0.5);
    if (label === "genuine" && h.score >= 0.5) { label = "unsure"; confidence = Math.min(confidence, 0.6); }
    await prisma.checkedMessage.create({
      data: {
        tenantId: user.tenantId, text: m.text, sender: m.sender, area: m.area, label, confidence, route: routeMessage(label, confidence),
        reviewedLabel: m.label, modelName: ai ? CLAUDE_MODEL : null,
        reasons: { source: ai ? "claude" : "signs_only", eval: true, ms: Date.now() - started, usage: ai?.usage ?? null, signs: h.signs },
      },
    });
    done++;
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "evaluation_run", details: { messages: done } });
  return NextResponse.json({ ok: true, messages: done });
});
