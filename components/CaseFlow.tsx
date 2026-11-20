"use client";
import { useCallback, useEffect, useState } from "react";
import FaceCapture, { type FaceResult } from "./FaceCapture";
import QrScanner from "./QrScanner";
import { enqueue, flush, newActionId, pendingCount } from "@/lib/client/queue";
import { speakUrdu } from "@/lib/client/voice";
import Info from "./ui/Info";

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
    return <div className="card text-center max-w-2xl mx-auto space-y-2" style={{ padding: 28 }}><div className="text-7xl">✅</div><p className="ur text-2xl">آپ کا اس سال کا ثبوتِ حیات مکمل ہے۔</p><p className="en">Your proof-of-life for this year is complete.</p></div>;
  }

  const STEPS = [
    { icon: "🙂", ur: "تصویر", en: "Photo" },
    { icon: "📖", ur: "پنشن بک", en: "Book" },
    { icon: "📨", ur: "بھیجیں", en: "Send" },
  ];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex justify-between items-center text-sm">
        <span>{online ? <>🟢 <span className="en">Online</span><span className="both-only"> · </span><span className="ur">آن لائن</span></> : <>🔴 <span className="en">Offline: steps are saved on this phone</span><span className="ur">انٹرنیٹ نہیں، قدم محفوظ ہیں</span></>}</span>
        {queued > 0 && <span className="badge badge-warn">{queued} <span className="en">step(s) waiting to send</span><span className="ur">قدم بھیجنے باقی</span></span>}
      </div>
      <div className="grid grid-cols-3 gap-3" aria-label={`Step ${stepsDone} of 3`}>
        {STEPS.map((st, i) => (
          <div key={st.en} className="text-center rounded-2xl py-3" style={{ background: i < stepsDone ? "var(--brand)" : "var(--card)", color: i < stepsDone ? "var(--brand-ink)" : "var(--ink)", border: "1px solid var(--line)" }}>
            <div className="text-3xl">{i < stepsDone ? "✔️" : st.icon}</div>
            <div className="text-xs font-semibold"><span className="ur" style={{ lineHeight: 1.8 }}>{st.ur}</span><span className="both-only"> </span><span className="en">{st.en}</span></div>
          </div>
        ))}
      </div>

      {step === "intro" && (
        <div className="card space-y-5 text-center" style={{ padding: 24 }}>
          <div className="flex justify-end -mb-6"><Info en="Once a year you must show you are alive so your pension continues. Three steps: a photo with a small movement, a scan of your pension book, then send. Your progress is saved after every step, even without internet." ur="سال میں ایک بار ثبوتِ حیات دینا ہوتا ہے۔ تین قدم: تصویر، پنشن بک، بھیجیں۔ ہر قدم کے بعد آپ کا کام محفوظ ہو جاتا ہے، انٹرنیٹ نہ ہو تب بھی۔" /></div>
          <div className="text-7xl">👵🏽</div>
          <p className="ur text-2xl">{pensionerName}، اپنی پنشن جاری رکھنے کے لیے ثبوتِ حیات دیں</p>
          <p className="en muted">Prove you are alive so your pension continues. 3 short steps.</p>
          <button className="btn btn-ghost w-full" data-no-voice onClick={() => speakUrdu(SAY.intro)}>🔊 <span className="ur">سنیں</span><span className="en">Listen</span></button>
          {!enrolled && <p style={{ color: "var(--warn)" }}><span className="en">Your face is not enrolled yet. Please visit the pension office once (mock), or ask an officer to enrol you.</span><span className="ur">آپ کا چہرہ ابھی رجسٹر نہیں۔ ایک بار پنشن آفس جائیں۔</span></p>}
          <button className="btn btn-big" data-no-voice disabled={!enrolled} onClick={() => go("face")}><span className="text-3xl">▶️</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">شروع کریں</span><span className="en text-sm font-semibold opacity-90">Start</span></span></button>
        </div>
      )}

      {step === "face" && (
        <div className="card space-y-4" style={{ padding: 22 }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl"><span className="ur">قدم ۱: اپنی تصویر</span><span className="both-only"> · </span><span className="en font-semibold">Step 1: your photo</span></p>
            <Info en="Look at the camera. You will be asked to blink or turn your head so we know it is really you and not a printed photo. Only 128 numbers about your face are sent, never the photo." ur="کیمرے میں دیکھیں۔ آنکھ جھپکانے یا سر موڑنے کو کہا جائے گا تاکہ پتا چلے یہ آپ ہی ہیں۔ تصویر فون سے باہر نہیں جاتی۔" />
          </div>
          <button className="btn btn-ghost w-full" data-no-voice onClick={() => speakUrdu(SAY.face)}>🔊 <span className="ur">سنیں</span><span className="en">Listen</span></button>
          <FaceCapture onDone={onFace} />
          {busy && <p><span className="en">Saving…</span> <span className="ur">محفوظ ہو رہا ہے</span></p>}
        </div>
      )}

      {step === "document" && (
        <div className="card space-y-4" style={{ padding: 22 }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl"><span className="ur">قدم ۲: پنشن بک</span><span className="both-only"> · </span><span className="en font-semibold">Step 2: pension book</span></p>
            <Info en="Open your pension book and hold its QR code in front of the back camera. The QR is signed by the pension office, so a changed or fake book is caught." ur="پنشن بک کھول کر اس کا کیو آر فون کے پیچھے والے کیمرے کے سامنے رکھیں۔ جعلی یا بدلی ہوئی بک پکڑی جاتی ہے۔" />
          </div>
          <button className="btn btn-ghost w-full" data-no-voice onClick={() => speakUrdu(SAY.document)}>🔊 <span className="ur">سنیں</span><span className="en">Listen</span></button>
          <QrScanner onResult={onQr} />
        </div>
      )}

      {step === "submit" && (
        <div className="card space-y-5 text-center" style={{ padding: 24 }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl"><span className="ur">قدم ۳: بھیج دیں</span><span className="both-only"> · </span><span className="en font-semibold">Step 3: send</span></p>
            <Info en="Sends your steps for checking. If everything is clear, you are approved straight away. If not, we ask for one more photo or a pension officer looks at it. Your pension is never stopped by the computer." ur="آپ کے قدم جانچ کے لیے بھیجے جائیں گے۔ سب ٹھیک ہو تو فوراً منظوری۔ ورنہ دوبارہ تصویر یا افسر دیکھے گا۔ کمپیوٹر کبھی پنشن بند نہیں کرتا۔" />
          </div>
          <button className="btn btn-big" data-no-voice disabled={busy} onClick={submit}><span className="text-3xl">📨</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">بھیجیں</span><span className="en text-sm font-semibold opacity-90">Send</span></span></button>
          {busy && <p><span className="en">Checking…</span> <span className="ur">جانچ ہو رہی ہے</span></p>}
          {note && <p role="status" style={{ color: "var(--warn)" }}>{note}</p>}
        </div>
      )}

      {step === "result" && result && (
        <div className="card space-y-5 text-center" style={{ padding: 24 }}>
          <div className="text-7xl">{result.outcome === "APPROVE" ? "✅" : result.outcome === "ASK_MORE_PROOF" ? "📷" : "🧑‍💼"}</div>
          <p className="ur text-2xl">{result.reasonUr}</p>
          <p className="en muted">{result.reasonEn}</p>
          <button className="btn btn-ghost w-full" data-no-voice onClick={() => speakUrdu(result.reasonUr)}>🔊 <span className="ur">دوبارہ سنیں</span><span className="en">Listen again</span></button>
          {result.outcome === "ASK_MORE_PROOF" && <button className="btn btn-big" data-no-voice onClick={() => restartFor(result.askFor)}><span className="text-3xl">🔁</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">دوبارہ کریں</span><span className="en text-sm font-semibold opacity-90">Try again</span></span></button>}
        </div>
      )}
    </div>
  );
}
