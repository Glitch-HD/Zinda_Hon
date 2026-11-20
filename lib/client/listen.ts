"use client";
// Voice input for people who cannot read or type. Uses Whisper (through our server) when it is set up,
// otherwise the phone's own speech recognition (Chrome on Android understands Urdu).

type SR = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };

let serverStt: boolean | null = null;
async function serverAvailable() {
  if (serverStt !== null) return serverStt;
  try {
    const r = await fetch("/api/voice/stt");
    serverStt = r.ok && (await r.json()).available === true;
  } catch { serverStt = false; }
  return serverStt;
}

function browserRecognizer(): SR | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function canListen() {
  return typeof navigator !== "undefined" && (!!navigator.mediaDevices?.getUserMedia || !!browserRecognizer());
}

async function recordAndTranscribe(maxMs: number) {
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
  return typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
}

function browserListen(maxMs: number): Promise<string | null> {
  const r = browserRecognizer();
  if (!r) return Promise.resolve(null);
  return new Promise((resolve) => {
    let text: string | null = null;
    r.lang = "ur-PK";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { text = e.results[0]?.[0]?.transcript ?? null; };
    r.onerror = () => resolve(null);
    r.onend = () => resolve(text);
    r.start();
    setTimeout(() => { try { r.stop(); } catch { /* already stopped */ } }, maxMs);
  });
}

/** Listens for up to maxMs and returns what was said (Urdu or English), or null. */
export async function listen(maxMs = 5000): Promise<string | null> {
  try {
    if (await serverAvailable()) {
      const t = await recordAndTranscribe(maxMs);
      if (t) return t;
    }
  } catch { /* microphone or network problem: try the phone's own recogniser */ }
  try { return await browserListen(maxMs); } catch { return null; }
}

// ---------- Understanding what was said ----------

function norm(s: string) {
  return s.toLowerCase().replace(/[ً-ْٰ۪-ۭ]/g, "").replace(/[.,!?؟،۔"']/g, " ").replace(/\s+/g, " ").trim();
}

/** Returns the id of the first command whose words appear in what was said. */
export function matchCommand(said: string, commands: { id: string; words: string[] }[]) {
  const s = norm(said);
  for (const c of commands) if (c.words.some((w) => s.includes(norm(w)))) return c.id;
  return null;
}

const DIGIT_WORDS: [string, string][] = [
  ["صفر", "0"], ["زیرو", "0"], ["zero", "0"], ["sifar", "0"],
  ["ایک", "1"], ["one", "1"], ["aik", "1"], ["ek", "1"],
  ["دو", "2"], ["two", "2"], ["do", "2"],
  ["تین", "3"], ["three", "3"], ["teen", "3"], ["tin", "3"],
  ["چار", "4"], ["four", "4"], ["char", "4"], ["chaar", "4"],
  ["پانچ", "5"], ["five", "5"], ["panch", "5"], ["paanch", "5"],
  ["چھے", "6"], ["چھ", "6"], ["six", "6"], ["chay", "6"], ["chhe", "6"],
  ["سات", "7"], ["seven", "7"], ["saat", "7"],
  ["آٹھ", "8"], ["eight", "8"], ["aath", "8"], ["aat", "8"],
  ["نو", "9"], ["nine", "9"], ["nau", "9"], ["no", "9"],
];
const URDU_NUMERALS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_NUMERALS = "٠١٢٣٤٥٦٧٨٩";

/** "ایک دو تین چار", "1 2 3 4", "۱۲۳۴" or "ek do teen char" → "1234". */
export function spokenDigits(said: string) {
  let out = "";
  for (const tok of norm(said).split(" ")) {
    if (/^[0-9۰-۹٠-٩]+$/.test(tok)) {
      for (const ch of tok) {
        const u = URDU_NUMERALS.indexOf(ch), a = ARABIC_NUMERALS.indexOf(ch);
        out += u >= 0 ? String(u) : a >= 0 ? String(a) : ch;
      }
      continue;
    }
    const hit = DIGIT_WORDS.find(([w]) => w === tok);
    if (hit) out += hit[1];
  }
  return out;
}
