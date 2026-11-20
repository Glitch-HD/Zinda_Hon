import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { claudeAvailable, textAiAvailable } from "@/lib/claude";

// Monitoring: a simple health check for uptime monitors and the demo.
export async function GET() {
  const started = Date.now();
  let db = "ok";
  try { await prisma.$queryRaw`SELECT 1`; } catch { db = "down"; }
  return NextResponse.json({
    status: db === "ok" ? "ok" : "degraded",
    db, dbMs: Date.now() - started,
    services: { claude: claudeAvailable(), textAi: textAiAvailable(), voiceTts: Boolean(process.env.AZURE_SPEECH_KEY), voiceStt: Boolean(process.env.GROQ_API_KEY) },
    time: new Date().toISOString(),
  }, { status: db === "ok" ? 200 : 503 });
}
