import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { RuleConfigSchema } from "@/lib/rules";
import { decide, type DecisionInputs, type RuleConfig } from "@/lib/decision";

// Digital Twin (bonus): replay past AI decisions under a proposed rule, without changing anything live.
const Body = z.object({ config: z.unknown() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const proposed = RuleConfigSchema.parse(Body.parse(await req.json()).config) as RuleConfig;
  const past = await prisma.decision.findMany({
    where: { decidedBy: "ai", case: { tenantId: user.tenantId } },
    orderBy: { createdAt: "desc" }, take: 500,
    include: { case: { include: { pensioner: { select: { pensionNo: true, name: true } } } } },
  });
  const rows = past.map((d) => {
    const now = decide(d.inputs as unknown as DecisionInputs, proposed);
    return { caseId: d.caseId, pensionNo: d.case.pensioner.pensionNo, name: d.case.pensioner.name, before: d.outcome, after: now.outcome, changed: d.outcome !== now.outcome };
  });
  const count = (k: "before" | "after", o: string) => rows.filter((r) => r[k] === o).length;
  const outcomes = ["APPROVE", "ASK_MORE_PROOF", "SEND_TO_OFFICER"];
  const summary = Object.fromEntries(outcomes.map((o) => [o, { before: count("before", o), after: count("after", o) }]));
  // Expected cost under each rule, using the proposed costs: officer reviews x review cost.
  const reviewCost = proposed.costs.humanReviewPkr;
  return NextResponse.json({
    total: rows.length, changed: rows.filter((r) => r.changed).length, summary,
    officerWorkloadPkr: { before: summary.SEND_TO_OFFICER.before * reviewCost, after: summary.SEND_TO_OFFICER.after * reviewCost },
    changes: rows.filter((r) => r.changed).slice(0, 50),
  });
});
