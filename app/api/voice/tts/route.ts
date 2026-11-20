import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Urdu text-to-speech via Azure AI Speech (free F0 tier). Audio is cached by the browser for a week,
// so repeated prompts cost nothing and work on a weak connection.
// Two Urdu (Pakistan) neural voices; the person picks one in the top bar.
const VOICES: Record<string, string> = {
  female: process.env.AZURE_TTS_VOICE ?? "ur-PK-UzmaNeural",
  male: process.env.AZURE_TTS_VOICE_MALE ?? "ur-PK-AsadNeural",
};
const memoryCache = new Map<string, ArrayBuffer>();

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

export const GET = handle(async (req: Request) => {
  // Works before login too (the front page talks to people who cannot read), with a tighter per-IP limit.
  const user = await getSessionUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const text = (new URL(req.url).searchParams.get("text") ?? "").slice(0, 400);
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return NextResponse.json({ error: "Voice service not configured" }, { status: 503 });

  const voiceName = VOICES[new URL(req.url).searchParams.get("voice") ?? "female"] ?? VOICES.female;
  const cacheKey = `${voiceName}|${text}`;
  let audio = memoryCache.get(cacheKey);
  if (!audio) {
    await rateLimit(user ? `tts:${user.id}` : `tts:anon:${ip}`, user ? 40 : 15, 60);
    const ssml = `<speak version="1.0" xml:lang="ur-PK"><voice name="${voiceName}"><prosody rate="-10%">${escapeXml(text)}</prosody></voice></speak>`;
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3", "User-Agent": "zinda-hon-prototype" },
      body: ssml,
    });
    if (!res.ok) {
      console.error("[tts] Azure error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "Voice service failed" }, { status: 502 });
    }
    audio = await res.arrayBuffer();
    if (memoryCache.size > 300) memoryCache.clear();
    memoryCache.set(cacheKey, audio);
  }
  return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=604800" } });
});
