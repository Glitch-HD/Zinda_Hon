"use client";
import Icon from "@/components/ui/Icon";
import { useRef, useState } from "react";
import QrScanner from "./QrScanner";
import FaceCapture, { type FaceResult } from "./FaceCapture";
import { speakUrdu } from "@/lib/client/voice";
import { startListening, spokenDigits, LISTEN_ERROR, type Listening } from "@/lib/client/listen";
import Info from "./ui/Info";

// No-typing login for a pensioner who cannot read:
//   1. Show the pension book QR to the camera.  2. Look at the camera (with a movement check).
//   If the face check fails, a big 4-digit number pad is the backup. Every step speaks in Urdu.

type Step = "book" | "face" | "pin";
type Who = { name: string; nameUr: string | null; hasFace: boolean; hasPin: boolean };

const SAY = {
  book: "اپنی پنشن بک کھولیں اور اس کا کیو آر کوڈ کیمرے کے سامنے رکھیں۔",
  face: (n: string) => `السلام علیکم ${n}۔ اب کیمرے کی طرف دیکھیں اور جو کہا جائے وہ کریں۔`,
  pin: "اپنا چار ہندسوں کا پن دبائیں۔",
  welcome: "خوش آمدید۔",
};
const SAY_EN = {
  book: "Open your pension book and hold its QR code in front of the camera.",
  face: (n: string) => `Hello ${n}. Now look at the camera and do what it asks.`,
  pin: "Press your four digit PIN.",
  welcome: "Welcome.",
};

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export default function PensionerLogin({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("book");
  const [who, setWho] = useState<Who | null>(null);
  const [error, setError] = useState<{ en: string; ur?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [faceKey, setFaceKey] = useState(0);
  const [listening, setListening] = useState(false);
  const live = useRef<Listening | null>(null);

  function fail(data: { error?: string; errorUr?: string }, fallback: string) {
    const e = { en: data.error ?? fallback, ur: data.errorUr };
    setError(e);
    if (e.ur) void speakUrdu(e.ur, e.en);
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { res, data: await res.json().catch(() => ({})) };
  }

  async function onBook(qrText: string | null) {
    if (!qrText) return;
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post("/api/auth/pensioner/start", { qrText });
      if (!res.ok) return fail(data, "Could not read this pension book.");
      setWho(data);
      const next: Step = data.hasFace ? "face" : "pin";
      setStep(next);
      void speakUrdu(next === "face" ? SAY.face(data.nameUr ?? "") : `السلام علیکم ${data.nameUr ?? ""}۔ آپ کا چہرہ ابھی رجسٹر نہیں ہوا۔ ${SAY.pin}`, next === "face" ? SAY_EN.face(data.name ?? "") : `Hello ${data.name ?? ""}. Your face is not registered yet. ${SAY_EN.pin}`);
    } catch {
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  async function useSampleBook(no: string) {
    setBusy(true);
    const res = await fetch(`/api/auth/pensioner/demo-book?no=${no}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) await onBook(data.qrText);
    else setError({ en: data.error ?? "Sample book not available." });
  }

  async function onFace(r: FaceResult) {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post("/api/auth/pensioner/face", { descriptor: r.descriptor, livenessPassed: r.liveness.passed });
      if (res.ok) { void speakUrdu(SAY.welcome, SAY_EN.welcome); window.location.href = data.home; return; }
      if (data.usePin) { setStep("pin"); void speakUrdu(SAY.pin, SAY_EN.pin); }
      fail(data, "Face check did not pass.");
    } catch {
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  async function submitPin(full: string) {
    setBusy(true);
    try {
      const { res, data } = await post("/api/auth/pensioner/pin", { pin: full });
      if (res.ok) { void speakUrdu(SAY.welcome, SAY_EN.welcome); window.location.href = data.home; return; }
      setPin("");
      fail(data, "Wrong PIN.");
    } catch {
      setPin("");
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError(null);
    if (next.length === 4) void submitPin(next);
  }

  async function sayPin() {
    if (listening) { live.current?.stop(); return; }
    setError(null);
    setPin("");
    setListening(true);
    live.current = startListening(7000);
    const r = await live.current.result;
    live.current = null;
    setListening(false);
    const digits = r.text ? spokenDigits(r.text) : "";
    if (digits.length !== 4) {
      const p = r.error ? LISTEN_ERROR[r.error] : { en: `Heard "${r.text}". Please say exactly four numbers, or tap them.`, ur: "چار ہندسے صاف بولیں، یا نمبر دبائیں۔" };
      setError(p);
      void speakUrdu(p.ur, p.en);
      return;
    }
    setPin(digits);
    void submitPin(digits);
  }

  const stepNo = step === "book" ? 1 : 2;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm" onClick={onBack} data-say="واپس" data-say-en="Back">← <span className="en">Back</span><span className="ur">واپس</span></button>
        <span className="eyebrow">Step {stepNo} of 2</span>
      </div>
      <div className="stepper" aria-hidden="true"><div className="done" /><div className={stepNo >= 2 ? "done" : ""} /></div>

      {step === "book" && (
        <div className="card space-y-5" style={{ padding: 22 }}>
          <div className="text-center space-y-1">
            <div className="text-7xl"></div>
            <p className="ur text-2xl font-semibold">اپنی پنشن بک کا کیو آر دکھائیں</p>
            <p className="en muted">Show the QR code inside your pension book to the camera.</p>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn btn-ghost flex-1" onClick={() => speakUrdu(SAY.book, SAY_EN.book)} data-no-voice><span className="ur">سنیں</span><span className="en">Listen</span></button>
            <Info en="The QR code is printed inside your pension book by the pension office. It proves the book is real. Hold the book open in front of the back camera." ur="پنشن بک کے اندر چھپا ہوا کیو آر کوڈ ثابت کرتا ہے کہ بک اصلی ہے۔ بک کھول کر فون کے پیچھے والے کیمرے کے سامنے رکھیں۔" />
          </div>
          <QrScanner onResult={onBook} />
          {busy && <p className="text-center"><span className="en">Checking the book…</span> <span className="ur">جانچ ہو رہی ہے</span></p>}
          <details className="text-sm">
            <summary className="cursor-pointer muted">No printed pension book with you?</summary>
            <div className="grid gap-2 sm:grid-cols-3 mt-2">
              {[
                { no: "PEN-K-1001", name: "Zainab Bibi" },
                { no: "PEN-K-1011", name: "Sakina Baloch" },
                { no: "PEN-K-1012", name: "Ghulam Rasool" },
              ].map((b) => (
                <button key={b.no} className="btn btn-ghost btn-sm w-full" disabled={busy} onClick={() => useSampleBook(b.no)} data-no-voice>{b.name}</button>
              ))}
            </div>
          </details>
        </div>
      )}

      {step === "face" && who && (
        <div className="card space-y-4" style={{ padding: 22 }}>
          <div className="text-center">
            <p className="ur text-2xl font-semibold" style={{ lineHeight: 2.4 }}>السلام علیکم، {who.nameUr ?? who.name}</p>
            <p className="en muted">Hello {who.name}. Now look at the camera and follow the instructions.</p>
          </div>
          <div className="flex justify-end">
            <Info en="We compare your face with the photo taken once at the pension office. You will be asked to blink or turn your head, so a printed photo cannot be used. The photo never leaves your phone." ur="ہم آپ کا چہرہ پنشن آفس میں لی گئی تصویر سے ملاتے ہیں۔ آنکھ جھپکانے یا سر موڑنے کو کہا جائے گا۔ تصویر آپ کے فون سے باہر نہیں جاتی۔" />
          </div>
          <FaceCapture key={faceKey} onDone={onFace} />
          {busy && <p className="text-center"><span className="en">Checking your face…</span> <span className="ur">چہرہ جانچا جا رہا ہے</span></p>}
          <div className={`grid gap-2 ${error ? "grid-cols-2" : "grid-cols-1"}`}>
            {error && <button className="btn btn-ghost" data-say="دوبارہ کوشش کریں" onClick={() => { setError(null); setFaceKey((k) => k + 1); }}><span className="en">Try again</span><span className="ur">دوبارہ</span></button>}
            {who.hasPin && <button className={error ? "btn" : "btn btn-ghost btn-sm"} data-no-voice onClick={() => { setError(null); setStep("pin"); void speakUrdu(SAY.pin, SAY_EN.pin); }}><span className="en">Use PIN instead</span><span className="ur">پن استعمال کریں</span></button>}
          </div>
        </div>
      )}

      {step === "pin" && who && (
        <div className="card space-y-5" style={{ padding: 22 }}>
          <div className="text-center">
            <p className="ur text-2xl font-semibold">اپنا پن دبائیں یا بولیں</p>
            <p className="en muted">{who.name}: tap or say your 4-digit PIN.</p>
          </div>
          {!who.hasFace && (
            <div className="card-soft text-sm" role="note" style={{ border: "1px solid var(--accent)", borderRadius: 14, padding: "10px 12px" }}>
              <p className="ur" style={{ whiteSpace: "normal" }}>آپ کا چہرہ ابھی رجسٹر نہیں ہوا، اس لیے اس بار پن استعمال کریں۔ پنشن آفس ایک بار آپ کا چہرہ رجسٹر کرے گا، پھر کیمرے سے لاگ اِن ہو گا۔</p>
              <p className="en">Your face is not registered yet, so use your PIN this time. A pension officer registers your face once (Officer → Enrol faces); after that you log in with the camera.</p>
            </div>
          )}
          <div className="flex justify-center gap-4" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`pindot ${i < pin.length ? "on" : ""}`} />)}
          </div>
          <div className="flex items-center gap-3">
            <button className={`mic-btn ${listening ? "live" : ""}`} style={{ width: 64, height: 64 }} disabled={busy} onClick={sayPin} aria-label={listening ? "Stop listening" : "Say your PIN"} data-no-voice>
              <Icon name={listening ? "stop" : "mic"} size={28} />
            </button>
            <div className="flex-1">
              <p className="ur font-semibold">{listening ? "پن بولیں، پھر دوبارہ دبائیں" : "مائیک دبا کر پن بولیں"}</p>
              <p className="en text-sm muted">{listening ? "Say the four numbers, then tap again" : "Tap the mic and say your PIN"}</p>
            </div>
            <Info en="Your PIN is 4 numbers given by the pension office. You can tap them, or tap the microphone and say them in Urdu or English, like 'ek, do, teen, char'." ur="پن چار ہندسوں کا ہے جو پنشن آفس نے دیا۔ نمبر دبائیں یا مائیک دبا کر بولیں، جیسے ایک، دو، تین، چار۔" />
          </div>
          <div className="pinpad" dir="ltr">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="pinkey" disabled={busy} onClick={() => press(d)} aria-label={d} data-no-voice>
                {d}<span className="block text-sm muted ur always" style={{ lineHeight: 1.2 }}>{URDU_DIGITS[Number(d)]}</span>
              </button>
            ))}
            <button className="pinkey" style={{ fontSize: "1.2rem" }} disabled={busy || !pin} onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete" data-say="مٹائیں">⌫</button>
            <button className="pinkey" disabled={busy} onClick={() => press("0")} aria-label="0" data-no-voice>0<span className="block text-sm muted ur always" style={{ lineHeight: 1.2 }}>۰</span></button>
            {who.hasFace ? (
              <button className="pinkey" style={{ fontSize: "1.2rem" }} onClick={() => { setPin(""); setError(null); setStep("face"); }} aria-label="Use face instead" data-say="چہرے سے لاگ اِن"></button>
            ) : <span />}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="card text-center space-y-1" style={{ borderColor: "var(--danger)" }}>
          {error.ur && <p className="ur text-lg" style={{ color: "var(--danger)" }}>{error.ur}</p>}
          <p className="en" style={{ color: "var(--danger)" }}>{error.en}</p>
        </div>
      )}
    </div>
  );
}
