import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { runCaseAgent, type AgentEvent } from "@/lib/agent";

// The officer's AI case assistant. POST starts an investigation and streams each step as one JSON
// object per line (NDJSON), so the officer watches the assistant work. GET returns the last saved run.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function ownCase(id: string, tenantId: string) {
  const c = await prisma.case.findUnique({ where: { id }, select: { id: true, tenantId: true } });
  if (!c || c.tenantId !== tenantId) throw new HttpError(404, "Case not found");
  return c;
}

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER", "AUDITOR"]);
  const { id } = await ctx.params;
  await ownCase(id, user.tenantId);
  const run = await prisma.agentRun.findFirst({ where: { caseId: id, status: "done" }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ run });
});

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(["OFFICER"]);
  const { id } = await ctx.params;
  await ownCase(id, user.tenantId);
  await rateLimit(`agent:${user.id}`, 6, 600);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent | { type: "error"; error: string }) => {
        try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { /* the officer closed the page; keep going so the run is saved */ }
      };
      try {
        await runCaseAgent(id, user, send);
      } catch (err) {
        console.error("[agent] run failed", err);
        await prisma.agentRun.updateMany({ where: { caseId: id, startedById: user.id, status: "running" }, data: { status: "failed" } }).catch(() => {});
        send({ type: "error", error: "The case assistant could not finish. Nothing was changed. Please try again." });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
});
