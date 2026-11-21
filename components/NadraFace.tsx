"use client";
import { useState } from "react";
import { speakUrdu } from "@/lib/client/voice";

// Asked once, before the first proof of life: instead of an office visit, may we take your face print
// from your CNIC photo at NADRA (simulated)? Nothing happens without a clear "yes".
export default function NadraFace({ pensionerId, onDone }: { pensionerId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; en: string; ur?: string } | null>(null);
  const SAY_UR = "آفس جانے کی ضرورت نہیں۔ کیا ہم نادرا سے آپ کے شناختی کارڈ کی تصویر لے لیں؟ اگر ہاں، تو سبز بٹن دبائیں۔";
  const SAY_EN = "No need to visit the office. May we get your CNIC photo from NADRA? If yes, press the green button.";
  async function agree() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/pensioners/${pensionerId}/nadra-face`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: true }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, en: d.oldPhoto ? `Done. Your CNIC photo is ${d.photoAgeYears} years old, so if the match is weak an officer will check by hand. You can start now.` : "Done. Your face print was taken from your CNIC photo. You can start now.", ur: "ہو گیا۔ اب آپ شروع کر سکتے ہیں۔" });
      speakUrdu("ہو گیا۔ اب شروع کریں۔", "Done. You can start now.");
      setTimeout(onDone, 1200);
    } else {
      setMsg({ ok: false, en: d.error ?? "Could not reach NADRA. Please try again.", ur: res.status === 404 ? "نادرا کے پاس آپ کی تصویر نہیں ملی۔ افسر آفس میں یا گھر آ کر چہرہ رجسٹر کر سکتا ہے۔" : undefined });
    }
  }
  return (
    <div className="rounded-2xl p-4 space-y-3 text-left" style={{ background: "color-mix(in srgb, var(--brand) 8%, transparent)", border: "1px solid var(--line)" }}>
      <p className="ur text-xl" style={{ whiteSpace: "normal" }}>آفس جانے کی ضرورت نہیں۔ کیا ہم نادرا سے آپ کے شناختی کارڈ کی تصویر لے لیں؟</p>
      <p className="en"><b>No office visit needed.</b> May we take your face print from your CNIC photo at NADRA? Your live photo will be matched against it.</p>
      <ul className="text-sm muted list-disc pl-5">
        <li>Only 128 numbers describing the face are kept, never the photo.</li>
        <li>Used only for this proof-of-life check. You can take it back any time in &quot;My data&quot;, and it is deleted at once.</li>
        <li>Prototype: NADRA here is <b>simulated</b>. No real NADRA data is used.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <button className="btn" data-no-voice disabled={busy} onClick={agree}>{busy ? "Asking NADRA…" : <><span className="ur">ہاں، تصویر لے لیں</span><span className="en"> · Yes, get my CNIC photo</span></>}</button>
        <button className="btn btn-ghost" data-no-voice onClick={() => speakUrdu(SAY_UR, SAY_EN)}><span className="ur">سنیں</span><span className="en">Listen</span></button>
      </div>
      <p className="text-xs muted">Prefer not to? An officer can enrol your face at the office or on a home visit instead.</p>
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.en}{msg.ur && <span className="ur block">{msg.ur}</span>}</p>}
    </div>
  );
}
