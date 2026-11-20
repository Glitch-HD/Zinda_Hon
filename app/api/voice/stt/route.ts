import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

// Urdu speech-to-text via Whisper on Groq. Audio is sent for transcription and not stored by us.
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`stt:${user.id}`, 20, 60);
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Speech service not configured" }, { status: 503 });
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "No audio" }, { status: 400 });
  if (audio.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Recording too long" }, { status: 413 });

  const out = new FormData();
  out.append("file", audio, "speech.webm");
  out.append("model", "whisper-large-v3");
  out.append("language", "ur");
  out.append("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: out });
  if (!res.ok) {
    console.error("[stt] Groq error", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Speech service failed" }, { status: 502 });
  }
  const data = (await res.json()) as { text?: string };
  await audit({ tenantId: user.tenantId, actorType: "AI", actorId: "whisper-large-v3", action: "speech_transcribed", details: { chars: data.text?.length ?? 0, byUser: user.id } });
  return NextResponse.json({ text: data.text ?? "" });
});
