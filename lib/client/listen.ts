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

export type ListenResult = { text: string | null; error?: "no_permission" | "no_support" | "no_speech" | "network" };
export type Listening = { result: Promise<ListenResult>; stop: () => void };

/** Watches the microphone level and calls done() once the person has spoken and then gone quiet for
 *  silenceMs (or if nobody speaks within waitMs). So we stop as soon as she finishes, not after a fixed time. */
function stopOnSilence(stream: MediaStream, done: () => void, silenceMs: number, waitMs = 6000) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return () => {};
    const ctx = new Ctx();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const started = performance.now();
    let heard = false;
    let quietSince = started;
    let floor = 0.015; // background noise, learnt in the first moments
    const t = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (now - started < 300) { floor = Math.max(floor, rms * 1.2); return; }
      if (rms > Math.max(0.03, floor * 2.2)) { heard = true; quietSince = now; }
      else if (heard && now - quietSince > silenceMs) done();
      else if (!heard && now - started > waitMs) done();
    }, 80);
    return () => { clearInterval(t); void ctx.close().catch(() => undefined); };
  } catch { return () => {}; }
}

/** Starts listening at once. Call stop() to finish early (the person taps the mic again); otherwise it stops
 *  when she goes quiet for silenceMs after speaking, or after maxMs at most. */
export function startListening(maxMs = 7000, silenceMs = 1300): Listening {
  let stopFn = () => {};
  const result = (async (): Promise<ListenResult> => {
    // 1. Our server (Whisper) when it is set up: best for Urdu, works on every phone and laptop.
    if (await serverAvailable()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        const done = new Promise<void>((r) => (rec.onstop = () => r()));
        rec.start();
        stopFn = () => rec.state !== "inactive" && rec.stop();
        const hardStop = setTimeout(stopFn, maxMs);
        const unwatch = stopOnSilence(stream, () => stopFn(), silenceMs);
        await done;
        clearTimeout(hardStop);
        unwatch();
        stream.getTracks().forEach((t) => t.stop());
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "speech.webm");
        const res = await fetch("/api/voice/stt", { method: "POST", body: form });
        if (!res.ok) return { text: null, error: "network" };
        const data = await res.json();
        const text = typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
        return text ? { text } : { text: null, error: "no_speech" };
      } catch (e) {
        if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) return { text: null, error: "no_permission" };
        /* otherwise fall through to the device's recogniser */
      }
    }
    // 2. The device's own speech recognition (Chrome on Android understands Urdu).
    const r = browserRecognizer();
    if (!r) return { text: null, error: "no_support" };
    return new Promise<ListenResult>((resolve) => {
      let text: string | null = null;
      let error: ListenResult["error"];
      r.lang = "ur-PK";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => { text = e.results[0]?.[0]?.transcript ?? null; };
      r.onerror = ((ev: { error?: string }) => {
        error = ev?.error === "not-allowed" || ev?.error === "service-not-allowed" ? "no_permission" : ev?.error === "network" ? "network" : "no_speech";
      }) as unknown as () => void;
      r.onend = () => resolve(text ? { text } : { text: null, error: error ?? "no_speech" });
      stopFn = () => { try { r.stop(); } catch { /* already stopped */ } };
      try { r.start(); } catch { resolve({ text: null, error: "no_support" }); return; }
      setTimeout(stopFn, maxMs);
    });
  })();
  return { result, stop: () => stopFn() };
}

/** Listens for up to maxMs and returns what was said (Urdu or English), or null. */
export async function listen(maxMs = 5000): Promise<string | null> {
  return (await startListening(maxMs).result).text;
}

export const LISTEN_ERROR: Record<NonNullable<ListenResult["error"]>, { en: string; ur: string }> = {
  no_permission: { en: "Microphone permission is off. Allow the microphone for this site in the browser settings.", ur: "مائیک کی اجازت دیں۔" },
  no_support: { en: "This browser cannot listen. Use Chrome on Android, or Chrome or Edge on a laptop.", ur: "یہ براؤزر آواز نہیں سن سکتا۔ کروم استعمال کریں۔" },
  no_speech: { en: "Did not hear anything clear. Hold the phone close and speak after tapping the mic.", ur: "آواز صاف نہیں آئی۔ فون قریب رکھ کر دوبارہ بولیں۔" },
  network: { en: "Could not reach the speech service. Check the internet and try again.", ur: "انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔" },
};

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
