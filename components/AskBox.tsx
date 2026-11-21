"use client";
import Icon from "@/components/ui/Icon";
import { useState } from "react";
import { speakUrdu } from "@/lib/client/voice";
import { listen } from "@/lib/client/listen";
import SayButton from "@/components/ui/SayButton";

type A = { answerUr: string; answerEn: string; sources: { id: string; title: string; text: string }[] };
export default function AskBox() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<A | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask(question = q) {
    setBusy(true); setA(null);
    const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setA(d); void speakUrdu(d.answerUr, d.answerEn); }
  }
  return (
    <div className="max-w-xl mx-auto space-y-3">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold"><span className="ur">سوال پوچھیں</span><span className="both-only"> · </span><span className="en">Ask about the rules</span></h2>
        <SayButton big ur="یہاں آپ پنشن کے قواعد کے بارے میں کوئی بھی سوال پوچھ سکتی ہیں۔ مائیک کا بٹن دبا کر اپنا سوال بولیں، یا لکھ کر پوچھیں کا بٹن دبائیں۔ جواب صرف سرکاری قواعد سے دیا جائے گا، اور جواب آپ کو سنایا بھی جائے گا۔ مثال کے طور پر پوچھیں: اگر میں وقت پر ثبوت نہ دے سکوں تو کیا ہوگا؟" en="Here you can ask any question about the pension rules. Press the microphone and say your question, or type it and press Ask. The answer comes only from the official rules, and it is read out to you. For example, ask: what happens if I am late?" />
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { en: "What happens if I am late?", ur: "اگر دیر ہو جائے تو کیا ہوگا؟" },
            { en: "Who can help me with proof of life?", ur: "ثبوتِ حیات میں میری مدد کون کر سکتا ہے؟" },
            { en: "Will anyone ask me for my PIN?", ur: "کیا کوئی مجھ سے پن مانگے گا؟" },
          ].map((x) => (
            <button key={x.en} type="button" className="badge" style={{ cursor: "pointer" }} disabled={busy} onClick={() => { setQ(x.en); void ask(x.en); }}><span className="en">{x.en}</span> <span className="ur">{x.ur}</span></button>
          ))}
        </div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What happens if I am late? / اگر دیر ہو جائے تو کیا ہوگا؟" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={async () => { const t = await listen(7000).catch(() => null); if (t) { setQ(t); void ask(t); } }}><Icon name="mic" size={20} /> <span className="en">Speak</span> <span className="ur">بولیں</span></button>
          <button className="btn" disabled={busy || q.length < 3} onClick={() => ask()}>{busy ? "…" : "Ask"}</button>
        </div>
      </div>
      {a && (
        <div className="card space-y-2">
          <p className="ur text-xl">{a.answerUr}</p>
          <p className="muted">{a.answerEn}</p>
          <SayButton ur={a.answerUr} en={a.answerEn} />
          {a.sources.length > 0 && <div className="text-sm"><b>Sources (mock rulebook):</b>{a.sources.map((s) => <p key={s.id}><b>[{s.id}] {s.title}:</b> {s.text} <SayButton ur={s.text} en={`${s.title}. ${s.text}`} /></p>)}</div>}
        </div>
      )}
    </div>
  );
}
