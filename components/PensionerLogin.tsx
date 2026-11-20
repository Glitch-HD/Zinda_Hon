"use client";
import { useState } from "react";
import QrScanner from "./QrScanner";
import FaceCapture, { type FaceResult } from "./FaceCapture";
import { speakUrdu } from "@/lib/client/voice";

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

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export default function PensionerLogin({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("book");
  const [who, setWho] = useState<Who | null>(null);
  const [error, setError] = useState<{ en: string; ur?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [faceKey, setFaceKey] = useState(0);

  function fail(data: { error?: string; errorUr?: string }, fallback: string) {
    const e = { en: data.error ?? fallback, ur: data.errorUr };
    setError(e);
    if (e.ur) void speakUrdu(e.ur);
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
      void speakUrdu(next === "face" ? SAY.face(data.nameUr ?? "") : `السلام علیکم ${data.nameUr ?? ""}۔ ${SAY.pin}`);
    } catch {
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  async function useSampleBook() {
    setBusy(true);
    const res = await fetch("/api/auth/pensioner/demo-book");
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
      if (res.ok) { void speakUrdu(SAY.welcome); window.location.href = data.home; return; }
      if (data.usePin) { setStep("pin"); void speakUrdu(SAY.pin); }
      fail(data, "Face check did not pass.");
    } catch {
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  async function press(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError(null);
    if (next.length < 4) return;
    setBusy(true);
    try {
      const { res, data } = await post("/api/auth/pensioner/pin", { pin: next });
      if (res.ok) { void speakUrdu(SAY.welcome); window.location.href = data.home; return; }
      setPin("");
      fail(data, "Wrong PIN.");
    } catch {
      setPin("");
      setError({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" });
    } finally {
      setBusy(false);
    }
  }

  const stepNo = step === "book" ? 1 : 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back · <span className="ur">واپس</span></button>
        <span className="eyebrow">Step {stepNo} of 2</span>
      </div>
      <div className="stepper" aria-hidden="true"><div className="done" /><div className={stepNo >= 2 ? "done" : ""} /></div>

      {step === "book" && (
        <div className="card space-y-4">
          <div className="text-center space-y-1">
            <div className="text-6xl">📖</div>
            <p className="ur text-2xl font-semibold">اپنی پنشن بک کا کیو آر دکھائیں</p>
            <p className="muted">Show the QR code inside your pension book to the camera.</p>
          </div>
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(SAY.book)}>🔊 <span className="ur">سنیں</span> · Listen</button>
          <QrScanner onResult={onBook} />
          {busy && <p className="text-center">Checking the book… <span className="ur">جانچ ہو رہی ہے</span></p>}
          <div className="card card-soft text-sm space-y-2">
            <p><b>For the demo:</b> no printed book? Use the sample book of Zainab Bibi (fake person).</p>
            <button className="btn btn-accent btn-sm w-full" disabled={busy} onClick={useSampleBook}>📘 Use the sample pension book</button>
          </div>
        </div>
      )}

      {step === "face" && who && (
        <div className="card space-y-3">
          <div className="text-center">
            <p className="ur text-2xl font-semibold" style={{ lineHeight: 2.4 }}>السلام علیکم، {who.nameUr ?? who.name}</p>
            <p className="muted">Hello {who.name}. Now look at the camera and follow the instructions.</p>
          </div>
          <FaceCapture key={faceKey} onDone={onFace} />
          {busy && <p className="text-center">Checking your face… <span className="ur">چہرہ جانچا جا رہا ہے</span></p>}
          <div className={`grid gap-2 ${error ? "grid-cols-2" : "grid-cols-1"}`}>
            {error && <button className="btn btn-ghost" onClick={() => { setError(null); setFaceKey((k) => k + 1); }}>🔁 Try again</button>}
            {who.hasPin && <button className={error ? "btn" : "btn btn-ghost btn-sm"} onClick={() => { setError(null); setStep("pin"); void speakUrdu(SAY.pin); }}>🔢 Use PIN instead</button>}
          </div>
        </div>
      )}

      {step === "pin" && who && (
        <div className="card space-y-4">
          <div className="text-center">
            <p className="ur text-2xl font-semibold">اپنا پن دبائیں</p>
            <p className="muted">{who.name}: press your 4-digit PIN.</p>
          </div>
          <div className="flex justify-center gap-4" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`pindot ${i < pin.length ? "on" : ""}`} />)}
          </div>
          <div className="pinpad" dir="ltr">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} className="pinkey" disabled={busy} onClick={() => press(d)} aria-label={d}>
                {d}<span className="block text-sm muted ur" style={{ lineHeight: 1.2 }}>{URDU_DIGITS[Number(d)]}</span>
              </button>
            ))}
            <button className="pinkey" style={{ fontSize: "1.2rem" }} disabled={busy || !pin} onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">⌫</button>
            <button className="pinkey" disabled={busy} onClick={() => press("0")} aria-label="0">0<span className="block text-sm muted ur" style={{ lineHeight: 1.2 }}>۰</span></button>
            {who.hasFace ? (
              <button className="pinkey" style={{ fontSize: "1.2rem" }} onClick={() => { setPin(""); setError(null); setStep("face"); }} aria-label="Use face instead">🙂</button>
            ) : <span />}
          </div>
          <p className="muted text-sm text-center">Demo PIN for Zainab Bibi: 1234</p>
        </div>
      )}

      {error && (
        <div role="alert" className="card text-center space-y-1" style={{ borderColor: "var(--danger)" }}>
          {error.ur && <p className="ur text-lg" style={{ color: "var(--danger)" }}>{error.ur}</p>}
          <p style={{ color: "var(--danger)" }}>{error.en}</p>
        </div>
      )}
    </div>
  );
}
