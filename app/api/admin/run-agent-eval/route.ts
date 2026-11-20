import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runCaseAgent } from "@/lib/agent";
import { AGENT_EVAL_CASES, scoreAgentCase } from "@/lib/agent-eval";

export const maxDuration = 60;

const Body = z.object({ runId: z.string().max(40).optional(), offset: z.number().int().min(0).default(0) });

// Runs the officer's AI case assistant on ONE labelled case per request (each investigation takes
// several AI calls), scores it, and stores the score as an audit-log row. The page calls it again
// with the next offset until every case has been run. The assistant only reads, so nothing changes.
export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const { runId: given, offset } = Body.parse(await req.json().catch(() => ({})));
  const runId = given ?? `agent-eval-${Date.now().toString(36)}`;
  const total = AGENT_EVAL_CASES.length;
  const c = AGENT_EVAL_CASES[offset];
  if (!c) return NextResponse.json({ ok: true, runId, next: total, total, done: true });

  const year = new Date().getFullYear();
  const kase = await prisma.case.findFirst({ where: { tenantId: user.tenantId, year, pensioner: { pensionNo: c.pensionNo } } });
  let details: Record<string, unknown>;
  if (!kase) {
    details = { runId, index: offset, pensionNo: c.pensionNo, what: c.what, skipped: "No case for this pensioner this year in your office" };
  } else {
    const r = await runCaseAgent(kase.id, user, () => {});
    const score = scoreAgentCase(c, r.raw, r.report, r.notes, r.facts);
    details = {
      runId, index: offset, pensionNo: c.pensionNo, what: c.what, planted: c.planted, agentRunId: r.runId,
      mode: r.mode, model: r.model, ms: r.ms, toolCalls: r.toolCalls, called: r.called,
      raw: r.raw.recommendation, final: r.report.recommendation, confidence: r.report.confidence,
      guardrails: r.notes.map((n) => n.rule), ...score,
    };
  }
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "agent_eval_case", targetType: "case", targetId: kase?.id, details: details as object });
  const next = offset + 1;
  return NextResponse.json({ ok: true, runId, next, total, done: next >= total });
});
