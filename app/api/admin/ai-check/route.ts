import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { classifyMessage, claudeAvailable, lastAiError } from "@/lib/claude";

// One-click check that the text AI works on this deployment. Open /api/admin/ai-check while logged in
// as admin, officer or auditor. Shows which keys are present (never their values) and the last error.
export const GET = handle(async () => {
  await requireUser(["ADMIN", "OFFICER", "AUDITOR"]);
  const started = Date.now();
  const r = await classifyMessage("Mubarak ho! BISP inaam 25000. 500 rupay fee bhejein 03001234567 par", null, { pendingPayment: null });
  return NextResponse.json({
    keys: { anthropic: claudeAvailable(), groq: Boolean(process.env.GROQ_API_KEY), azureSpeech: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) },
    working: Boolean(r),
    model: r?.model ?? null,
    answer: r?.data ?? null,
    ms: Date.now() - started,
    problem: r ? null : lastAiError ?? (claudeAvailable() || process.env.GROQ_API_KEY ? "AI call failed (see Vercel logs)" : "No AI key on this deployment. Add GROQ_API_KEY in Vercel and redeploy."),
  });
});
