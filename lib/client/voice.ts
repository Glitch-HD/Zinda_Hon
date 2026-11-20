"use client";
// Voice for people who cannot read: Urdu text-to-speech (Azure neural voice through our server, with the
// phone's own voice as a fallback) and Urdu speech-to-text (Whisper on Groq through our server).

let current: HTMLAudioElement | null = null;

export async function speakUrdu(text: string) {
  stopSpeaking();
  try {
    const res = await fetch(`/api/voice/tts?text=${encodeURIComponent(text)}`);
    if (res.ok) {
      const blob = await res.blob();
      current = new Audio(URL.createObjectURL(blob));
      await current.play();
      return true;
    }
  } catch { /* fall through to the phone's voice */ }
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ur-PK";
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ur"));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
    return true;
  }
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
