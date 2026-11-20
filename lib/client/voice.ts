"use client";
import { getLang } from "./prefs";
// Voice for people who cannot read: Urdu text-to-speech (Azure neural voice through our server, with the
// phone's own voice as a fallback) and Urdu speech-to-text (Whisper on Groq through our server).

let current: HTMLAudioElement | null = null;
let serverVoice: boolean | null = null; // null = not tried yet; false = not set up, stop asking
let serverIsFree = false; // the server is using the free fallback voice (no Azure key)

export type VoiceChoice = "female" | "male";
export function getVoiceChoice(): VoiceChoice {
  try { return localStorage.getItem("zh_tts") === "male" ? "male" : "female"; } catch { return "female"; }
}
export function setVoiceChoice(v: VoiceChoice) {
  try { localStorage.setItem("zh_tts", v); } catch { /* ignore */ }
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
    speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); resolve(speechSynthesis.getVoices()); }, { once: true });
  });
}

/** True if this device can speak Urdu (our voice service, or an Urdu voice installed on the device). */
export async function canSpeakUrdu() {
  if (serverVoice) return true;
  if (!("speechSynthesis" in window)) return false;
  return (await loadVoices()).some((v) => v.lang.toLowerCase().startsWith("ur"));
}

type SpokenLang = "ur" | "en";
let token = 0; // each new speech gets a new token; older speech stops at the next step

/** Which languages to say, following the language switch: اردو = Urdu, English = English,
 *  Both = Urdu first, then English. Without an English text, Urdu is always used. */
function plan(ur: string, en?: string): { lang: SpokenLang; text: string }[] {
  const lang = getLang();
  if (!en) return [{ lang: "ur", text: ur }];
  if (lang === "en") return [{ lang: "en", text: en }];
  if (lang === "ur") return [{ lang: "ur", text: ur }];
  return [{ lang: "ur", text: ur }, { lang: "en", text: en }];
}

function waitForAudio(a: HTMLAudioElement) {
  return new Promise<void>((resolve) => {
    a.addEventListener("ended", () => resolve(), { once: true });
    a.addEventListener("pause", () => resolve(), { once: true });
    a.addEventListener("error", () => resolve(), { once: true });
  });
}

/** Says one piece of text and resolves when it has finished. Returns false if nothing could say it. */
async function sayOne(lang: SpokenLang, text: string, my: number): Promise<boolean> {
  // With only the free server voice, a voice already on the device is faster and works offline, so use it first.
  const deviceFirst = serverIsFree && "speechSynthesis" in window && (await loadVoices()).some((v) => v.lang.toLowerCase().startsWith(lang));
  if (serverVoice !== false && !deviceFirst) {
    try {
      const res = await fetch(`/api/voice/tts?lang=${lang}&voice=${getVoiceChoice()}&text=${encodeURIComponent(text)}`);
      if (my !== token) return true;
      if (res.ok) {
        serverVoice = true;
        serverIsFree = res.headers.get("x-voice") === "free-fallback";
        const blob = await res.blob();
        if (my !== token) return true;
        current = new Audio(URL.createObjectURL(blob));
        await current.play();
        await waitForAudio(current);
        return true;
      }
      if (res.status === 503) serverVoice = false;
    } catch { /* fall through to the device's voice */ }
  }
  if (!("speechSynthesis" in window)) return false;
  const voices = await loadVoices();
  const mine = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (!mine.length) return false;
  const want = getVoiceChoice();
  const female = /uzma|female|zira|samantha|susan|hazel|heera|neerja|karen|moira|tessa|victoria|aria|jenny/i;
  const male = /asad|male|david|daniel|mark|george|ravi|prabhat|alex|fred|guy/i;
  // For English prefer a South Asian accent, then British, then any.
  const ranked = lang === "en" ? [...mine.filter((v) => /en-(in|pk)/i.test(v.lang)), ...mine.filter((v) => /en-gb/i.test(v.lang)), ...mine] : mine;
  // ("Female" contains "male", so a male voice must also not look female.)
  const pick = ranked.find((v) => (want === "male" ? male.test(v.name) && !female.test(v.name) : female.test(v.name))) ?? ranked[0];
  const u = new SpeechSynthesisUtterance(text);
  u.lang = pick.lang;
  u.voice = pick;
  u.rate = 0.9;
  await new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
  return true;
}

/** Speaks a prompt. The Urdu text is always given; the English one is optional.
 *  Which language is heard follows the language switch (see plan). Uses our natural voice service when it
 *  is set up, else the device's own voice. If Urdu cannot be spoken (for example Chrome on a laptop),
 *  a notice is shown instead of silence. Resolves when everything has been said. */
export async function speakUrdu(ur: string, en?: string) {
  stopSpeaking();
  const my = ++token;
  let any = false;
  for (const part of plan(ur, en)) {
    if (my !== token) break;
    const ok = await sayOne(part.lang, part.text, my);
    if (!ok && part.lang === "ur") window.dispatchEvent(new CustomEvent("zh-no-voice"));
    any ||= ok;
  }
  return any;
}

/** Speaks and resolves when the speech has finished (or after maxMs), so the microphone does not hear it. */
export async function speakUrduAndWait(ur: string, maxMs = 8000, en?: string) {
  await Promise.race([speakUrdu(ur, en), new Promise((r) => setTimeout(r, en && getLang() === "both" ? maxMs * 2 : maxMs))]);
}

export function stopSpeaking() {
  token++;
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}

/** Records up to maxMs of speech and returns the Urdu transcript, or null. */
export async function listenUrdu(maxMs = 6000): Promise<string | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  setTimeout(() => rec.state !== "inactive" && rec.stop(), maxMs);
  await done;
  stream.getTracks().forEach((t) => t.stop());
  const form = new FormData();
  form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "speech.webm");
  const res = await fetch("/api/voice/stt", { method: "POST", body: form });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.text === "string" ? data.text : null;
}
