"use client";
import { useCallback, useEffect, useState } from "react";
import FaceCapture, { type FaceResult } from "./FaceCapture";
import QrScanner from "./QrScanner";
import { enqueue, flush, newActionId, pendingCount } from "@/lib/client/queue";
import { speakUrdu } from "@/lib/client/voice";

// The one end-to-end task: a yearly proof-of-life, designed for someone who cannot read.
// Every screen has one big action, an icon, and an Urdu voice prompt. Progress is saved after every step.

type Step = "intro" | "face" | "document" | "submit" | "result";
type Result = { status: string; outcome: string; reasonEn: string; reasonUr: string; askFor: string[] };

const SAY = {
  intro: "السلام علیکم۔ اپنی پنشن جاری رکھنے کے لیے تین آسان قدم ہیں۔ پہلے اپنی تصویر، پھر پنشن بک، پھر بھیج دیں۔",
  face: "اب کیمرے کی طرف دیکھیں اور جو کہا جائے وہ کریں۔",
  document: "اب اپنی پنشن بک کا کیو آر کوڈ کیمرے کے سامنے رکھیں۔",
  submit: "شکریہ۔ اب بھیجیں کا بٹن دبائیں۔",
};

export default function CaseFlow({ caseId, pensionerName, enrolled, initialStatus }: { caseId: string; pensionerName: string; enrolled: boolean; initialStatus: string }) {
  const storageKey = `zh_case_step_${caseId}`;
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as Step | null;
      if (saved && saved !== "result") setStep(saved);
    } catch { /* ignore */ }
    const update = () => { setOnline(navigator.onLine); setQueued(pendingCount()); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const t = setInterval(update, 3000);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); clearInterval(t); };
  }, [storageKey]);

  const go = useCallback((s: Step) => {
    setStep(s);
    try { localStorage.setItem(storageKey, s); } catch { /* ignore */ }
    if (s in SAY) void speakUrdu(SAY[s as keyof typeof SAY]);
  }, [storageKey]);

  async function onFace(r: FaceResult) {
    setBusy(true);
    await enqueue(`/api/cases/${caseId}/evidence`, { type: "liveness", clientActionId: newActionId(), passed: r.liveness.passed, challenges: r.liveness.challenges });
    await enqueue(`/api/cases/${caseId}/evidence`, { type: "face_match", clientActionId: newActionId(), descriptor: r.descriptor, quality: r.quality });
    setBusy(false);
    setQueued(pendingCount());
    go("document");
  }

  async function onQr(text: string | null) {
    setBusy(true);
    await enqueue(`/api/cases/${caseId}/evidence`, { type: "document", clientActionId: newActionId(), qrText: text });
    setBusy(false);
    setQueued(pendingCount());
    go("submit");
  }

  async function submit() {
    setBusy(true);
    setNote(null);
    const f = await flush();
    if (f.left > 0) {
      setBusy(false);
      setNote("No internet right now. Your steps are saved on this phone and will be sent automatically. / انٹرنیٹ نہیں ہے، آپ کے قدم محفوظ ہیں۔");
      return;
    }
    try {
      const res = await fetch(`/api/cases/${caseId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data);
      go("result");
      void speakUrdu(data.reasonUr);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function restartFor(askFor: string[]) {
    setResult(null);
    go(askFor.includes("selfie") || askFor.includes("liveness") ? "face" : askFor.includes("document") ? "document" : "submit");
  }

  const stepsDone = { intro: 0, face: 1, document: 2, submit: 3, result: 3 }[step];

  if (initialStatus === "VERIFIED") {
    return <div className="card text-center"><div className="text-6xl">✅</div><p className="ur text-2xl">آپ کا اس سال کا ثبوتِ حیات مکمل ہے۔</p><p>Your proof-of-life for this year is complete.</p></div>;
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="flex justify-between items-center text-sm">
        <span>{online ? "🟢 Online" : "🔴 Offline: steps are saved on this phone"}</span>
        {queued > 0 && <span className="badge badge-warn">{queued} step(s) waiting to send</span>}
      </div>
      <div className="flex gap-2" aria-label={`Step ${stepsDone} of 3`}>
        {["🙂", "📖", "📨"].map((icon, i) => (
          <div key={icon} className="flex-1 text-center rounded-xl py-2 text-2xl" style={{ background: i < stepsDone ? "var(--brand)" : "var(--card)", border: "1px solid var(--line)" }}>{i < stepsDone ? "✔️" : icon}</div>
        ))}
      </div>

      {step === "intro" && (
        <div className="card space-y-4 text-center">
          <div className="text-6xl">👵🏽</div>
          <p className="ur text-2xl">{pensionerName}، اپنی پنشن جاری رکھنے کے لیے ثبوتِ حیات دیں</p>
          <p className="muted">Prove you are alive so your pension continues. 3 short steps.</p>
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(SAY.intro)}>🔊 <span className="ur">سنیں</span> · Listen</button>
          {!enrolled && <p style={{ color: "var(--warn)" }}>Your face is not enrolled yet. Please visit the pension office once (mock), or ask an officer to enrol you.</p>}
          <button className="btn btn-big" disabled={!enrolled} onClick={() => go("face")}><span className="text-3xl">▶️</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">شروع کریں</span><span className="text-sm font-semibold opacity-90">Start</span></span></button>
        </div>
      )}

      {step === "face" && (
        <div className="card space-y-3">
          <p className="ur text-xl text-center">قدم ۱: اپنی تصویر</p>
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(SAY.face)}>🔊 <span className="ur">سنیں</span></button>
          <FaceCapture onDone={onFace} />
          {busy && <p>Saving… <span className="ur">محفوظ ہو رہا ہے</span></p>}
        </div>
      )}

      {step === "document" && (
        <div className="card space-y-3">
          <p className="ur text-xl text-center">قدم ۲: پنشن بک</p>
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(SAY.document)}>🔊 <span className="ur">سنیں</span></button>
          <QrScanner onResult={onQr} />
        </div>
      )}

      {step === "submit" && (
        <div className="card space-y-4 text-center">
          <p className="ur text-xl">قدم ۳: بھیج دیں</p>
          <button className="btn btn-big" disabled={busy} onClick={submit}><span className="text-3xl">📨</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">بھیجیں</span><span className="text-sm font-semibold opacity-90">Send</span></span></button>
          {busy && <p>Checking… <span className="ur">جانچ ہو رہی ہے</span></p>}
          {note && <p role="status" style={{ color: "var(--warn)" }}>{note}</p>}
        </div>
      )}

      {step === "result" && result && (
        <div className="card space-y-4 text-center">
          <div className="text-7xl">{result.outcome === "APPROVE" ? "✅" : result.outcome === "ASK_MORE_PROOF" ? "📷" : "🧑‍💼"}</div>
          <p className="ur text-2xl">{result.reasonUr}</p>
          <p className="muted">{result.reasonEn}</p>
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(result.reasonUr)}>🔊 <span className="ur">دوبارہ سنیں</span> · Listen again</button>
          {result.outcome === "ASK_MORE_PROOF" && <button className="btn btn-big" onClick={() => restartFor(result.askFor)}><span className="text-3xl">🔁</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">دوبارہ کریں</span><span className="text-sm font-semibold opacity-90">Try again</span></span></button>}
        </div>
      )}
    </div>
  );
}
