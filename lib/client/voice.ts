"use client";
// Voice for people who cannot read: Urdu text-to-speech (Azure neural voice through our server, with the
// phone's own voice as a fallback) and Urdu speech-to-text (Whisper on Groq through our server).

let current: HTMLAudioElement | null = null;
let serverVoice: boolean | null = null; // null = not tried yet; false = not set up, stop asking

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

/** Speaks Urdu text. Uses our natural voice service when it is set up, else the device's own Urdu voice.
 *  If neither exists (for example Chrome on a laptop), a notice is shown instead of silence. */
export async function speakUrdu(text: string) {
  stopSpeaking();
  if (serverVoice !== false) {
    try {
      const res = await fetch(`/api/voice/tts?voice=${getVoiceChoice()}&text=${encodeURIComponent(text)}`);
      if (res.ok) {
        serverVoice = true;
        const blob = await res.blob();
        current = new Audio(URL.createObjectURL(blob));
        await current.play();
        return true;
      }
      if (res.status === 503) serverVoice = false;
    } catch { /* fall through to the device's voice */ }
  }
  if ("speechSynthesis" in window) {
    const voices = await loadVoices();
    const urdu = voices.filter((v) => v.lang.toLowerCase().startsWith("ur"));
    if (urdu.length) {
      const want = getVoiceChoice();
      const pick = urdu.find((v) => (want === "male" ? /asad|male/i : /uzma|female/i).test(v.name)) ?? urdu[0];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = pick.lang;
      u.voice = pick;
      u.rate = 0.9;
      speechSynthesis.speak(u);
      return true;
    }
  }
  window.dispatchEvent(new CustomEvent("zh-no-voice"));
  return false;
}

/** Speaks and resolves when the speech has finished (or after maxMs), so the microphone does not hear it. */
export async function speakUrduAndWait(text: string, maxMs = 8000) {
  const started = await speakUrdu(text);
  if (!started) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, maxMs);
    const done = () => { clearTimeout(t); resolve(); };
    if (current) { current.addEventListener("ended", done, { once: true }); current.addEventListener("pause", done, { once: true }); return; }
    const poll = setInterval(() => { if (!speechSynthesis.speaking) { clearInterval(poll); done(); } }, 200);
  });
}

export function stopSpeaking() {
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
