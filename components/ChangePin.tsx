"use client";
import { useState } from "react";
import FaceCapture, { type FaceResult, type Ticket } from "./FaceCapture";
import SayButton from "./ui/SayButton";
import { speakUrdu } from "@/lib/client/voice";

// Change my PIN. Old PIN + new PIN, then her live face. A son who saw her PIN cannot pass the face step.
export default function ChangePin() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [step, setStep] = useState<"pins" | "face" | "done">("pins");
  const [faceKey, setFaceKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ en: string; ur: string } | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  function toFace() {
    setErr(null);
    if (cur.length !== 4 || next.length !== 4) return setErr({ en: "Each PIN must be 4 numbers.", ur: "ہر پن چار ہندسوں کا ہو۔" });
    if (next !== again) return setErr({ en: "The two new PINs are not the same.", ur: "دونوں نئے پن ایک جیسے نہیں۔" });
    setStep("face");
    void speakUrdu("اب کیمرے میں دیکھیں۔ جو کہا جائے وہ کریں: آنکھ جھپکائیں یا سر موڑیں۔", "Now look at the camera and do what it asks: blink or turn your head.");
  }
  async function getTicket(): Promise<Ticket | null> {
    try { const r = await fetch("/api/account/pin/challenge", { method: "POST" }); return r.ok ? ((await r.json()) as Ticket) : null; } catch { return null; }
  }
  async function onFace(r: FaceResult) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/account/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPin: cur, newPin: next, descriptor: r.descriptor, livenessPassed: r.liveness.passed, ticket: r.ticket ?? undefined, challenges: r.liveness.challenges }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setStep("done"); setCur(""); setNext(""); setAgain("");
        void speakUrdu("آپ کا پن بدل گیا ہے۔ باقی سب فونوں سے لاگ آؤٹ ہو گیا ہے۔", "Your PIN has been changed. Every other phone has been logged out.");
      } else {
        const e = { en: d.error ?? "Could not change the PIN.", ur: d.errorUr ?? "پن نہیں بدلا۔" };
        setErr(e); void speakUrdu(e.ur, e.en);
        if (res.status === 400 || /current PIN/i.test(e.en)) setStep("pins"); else setFaceKey((k) => k + 1);
      }
    } catch { setErr({ en: "No internet. Please try again.", ur: "انٹرنیٹ نہیں ہے۔ دوبارہ کوشش کریں۔" }); }
    setBusy(false);
  }

  if (!open) return (
    <div className="card bubble-say" style={{ padding: 18 }}>
      <div><b><span className="en">Change my PIN</span> <span className="ur">اپنا پن بدلیں</span></b><p className="text-sm muted">Needs your old PIN and your face, so nobody else can change it.</p></div>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} data-say="اپنا پن بدلیں" data-say-en="Change my PIN">Change PIN</button>
    </div>
  );
  return (
    <div className="card space-y-3" style={{ padding: 20 }} data-tour="pin">
      <div className="bubble-say">
        <h2 className="text-xl font-bold"><span className="en">Change my PIN</span> <span className="ur">اپنا پن بدلیں</span></h2>
        <SayButton ur="پرانا پن لکھیں، پھر نیا پن دو بار لکھیں۔ پھر کیمرے میں دیکھیں تاکہ پتا چلے یہ آپ خود ہیں۔ 1234 یا اپنی پیدائش کا سال نہ رکھیں۔" en="Type your old PIN, then the new PIN twice. Then look at the camera so we know it is really you. Do not use 1234 or your birth year." />
      </div>
      {step === "pins" && (
        <>
          <div className="grid grid-cols-3 gap-3 items-end">
            {([["Old PIN", "پرانا پن", cur, setCur], ["New PIN", "نیا پن", next, setNext], ["New again", "نیا دوبارہ", again, setAgain]] as const).map(([en, ur, v, set]) => (
              <label key={en} className="block text-sm font-semibold"><span className="en">{en}</span> <span className="ur">{ur}</span>
                <input className="input mt-1 text-center" style={{ fontSize: "1.6rem", letterSpacing: ".4em" }} type="password" inputMode="numeric" autoComplete="off" value={v} onChange={(e) => set(digits(e.target.value))} maxLength={4} />
              </label>
            ))}
          </div>
          <button type="button" className="btn w-full" onClick={toFace}><span className="en">Next: check my face</span> <span className="ur">آگے: چہرہ جانچیں</span></button>
        </>
      )}
      {step === "face" && (busy ? <p className="muted">Checking…</p> : <FaceCapture key={faceKey} onDone={onFace} getTicket={getTicket} />)}
      {step === "done" && <p role="status" className="field-check ok" style={{ fontSize: "1rem" }}><span className="en">Your PIN has been changed. Every other phone was logged out.</span> <span className="ur">آپ کا پن بدل گیا ہے۔</span></p>}
      {err && <p role="alert" className="field-check bad" style={{ fontSize: ".95rem" }}><span className="en">{err.en}</span> <span className="ur">{err.ur}</span></p>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setStep("pins"); setErr(null); }}>Close</button>
    </div>
  );
}
