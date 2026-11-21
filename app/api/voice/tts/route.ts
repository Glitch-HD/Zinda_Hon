import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

// Urdu (and English) text-to-speech via Azure AI Speech (free F0 tier). Audio is cached by the browser for a week,
// so repeated prompts cost nothing and work on a weak connection.
// Two Urdu (Pakistan) neural voices; the person picks one in the top bar.
// English uses Azure's Indian English voices, the closest accent to Pakistani English that Azure offers.
const VOICES: Record<string, Record<string, string>> = {
  ur: { female: process.env.AZURE_TTS_VOICE ?? "ur-PK-UzmaNeural", male: process.env.AZURE_TTS_VOICE_MALE ?? "ur-PK-AsadNeural" },
  en: { female: process.env.AZURE_TTS_VOICE_EN ?? "en-IN-NeerjaNeural", male: process.env.AZURE_TTS_VOICE_EN_MALE ?? "en-IN-PrabhatNeural" },
};
const XML_LANG: Record<string, string> = { ur: "ur-PK", en: "en-IN" };
const memoryCache = new Map<string, ArrayBuffer>();

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

/** Splits text into pieces of at most `max` characters, at sentence or word breaks. */
function chunks(text: string, max = 180) {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const cut = Math.max(rest.lastIndexOf("۔", max), rest.lastIndexOf(".", max), rest.lastIndexOf("،", max), rest.lastIndexOf(",", max), rest.lastIndexOf(" ", max));
    const at = cut > 40 ? cut + 1 : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Free fallback when no Azure key is set: the public text-to-speech used by Google Translate, which
 * speaks Urdu. It is unofficial (no key, no guarantee), so it is only a fallback and can be switched off
 * with FREE_TTS=off. MP3 pieces can be joined end to end and still play.
 */
async function freeTts(text: string, lang: "ur" | "en"): Promise<ArrayBuffer | null> {
  if (process.env.FREE_TTS === "off") return null;
  try {
    const parts: Uint8Array[] = [];
    for (const piece of chunks(text)) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(piece)}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) return null;
      parts.push(new Uint8Array(await res.arrayBuffer()));
    }
    const total = parts.reduce((a, p) => a + p.length, 0);
    const all = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    return all.buffer;
  } catch (err) {
    console.error("[tts] free voice failed", err);
    return null;
  }
}

export const GET = handle(async (req: Request) => {
  // Works before login too (the front page talks to people who cannot read), with a tighter per-IP limit.
  const user = await getSessionUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const text = (new URL(req.url).searchParams.get("text") ?? "").slice(0, 400);
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const params = new URL(req.url).searchParams;
  const lang = params.get("lang") === "en" ? "en" : "ur";
  if (!key || !region) {
    // No Azure key: laptops without an Urdu voice (Chrome on Windows) still hear Urdu through the free voice.
    const cacheKey = `free|${lang}|${text}`;
    let audio = memoryCache.get(cacheKey);
    if (!audio) {
      await rateLimit(user ? `tts:${user.id}` : `tts:anon:${ip}`, user ? 40 : 30, 60);
      audio = (await freeTts(text, lang)) ?? undefined;
      if (!audio) return NextResponse.json({ error: "Voice service not configured" }, { status: 503 });
      if (memoryCache.size > 300) memoryCache.clear();
      memoryCache.set(cacheKey, audio);
    }
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=604800", "X-Voice": "free-fallback" } });
  }
  const voiceName = VOICES[lang][params.get("voice") ?? "female"] ?? VOICES[lang].female;
  const cacheKey = `${voiceName}|${text}`;
  let audio = memoryCache.get(cacheKey);
  if (!audio) {
    await rateLimit(user ? `tts:${user.id}` : `tts:anon:${ip}`, user ? 40 : 30, 60);
    const ssml = `<speak version="1.0" xml:lang="${XML_LANG[lang]}"><voice name="${voiceName}"><prosody rate="-10%">${escapeXml(text)}</prosody></voice></speak>`;
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
