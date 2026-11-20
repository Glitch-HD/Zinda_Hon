import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { classifyMessage } from "@/lib/claude";
import { heuristicSigns, routeMessage } from "@/lib/scam";
import { EVAL_MESSAGES } from "@/data/eval-messages";
import { audit } from "@/lib/audit";

export const maxDuration = 60;
const BATCH = 5;

const Body = z.object({ runId: z.string().max(40).optional(), offset: z.number().int().min(0).default(0) });

// Runs the scam checker over the labelled test set, a few messages per request so each request stays
// well inside the hosting time limit and the free AI rate limit. The page calls it again with the next
// offset until it is done. Each result is stored with its true label and the run it belongs to.
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const { runId: given, offset } = Body.parse(await req.json().catch(() => ({})));
  const runId = given ?? `eval-${Date.now().toString(36)}`;
  if (offset === 0) await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "evaluation_started", details: { runId, messages: EVAL_MESSAGES.length } });

  const slice = EVAL_MESSAGES.slice(offset, offset + BATCH);
  for (const [k, m] of slice.entries()) {
    const started = Date.now();
    const h = heuristicSigns(m.text);
    const ai = await classifyMessage(m.text, m.sender ?? null, { pendingPayment: null });
    let label: "scam" | "genuine" | "unsure" = ai?.data.label ?? (h.score >= 0.7 ? "scam" : "unsure");
    let confidence = ai?.data.confidence ?? (h.score >= 0.7 ? h.score : 0.5);
    if (label === "genuine" && h.score >= 0.5) { label = "unsure"; confidence = Math.min(confidence, 0.6); }
    await prisma.checkedMessage.create({
      data: {
        tenantId: user.tenantId, text: m.text, sender: m.sender, area: m.area, label, confidence, route: routeMessage(label, confidence),
        reviewedLabel: m.label, modelName: ai ? ai.model : null,
        reasons: { source: ai ? "ai" : "signs_only", eval: true, runId, index: offset + k, lang: m.lang, hard: Boolean(m.hard), ms: Date.now() - started, usage: ai?.usage ?? null, signs: h.signs, ai: ai?.data ?? null },
      },
    });
  }
  const next = offset + slice.length;
  const done = next >= EVAL_MESSAGES.length;
  if (done) await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "evaluation_run", details: { runId, messages: EVAL_MESSAGES.length } });
  return NextResponse.json({ ok: true, runId, next, total: EVAL_MESSAGES.length, done });
});
