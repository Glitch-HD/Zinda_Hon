"use client";
import { useState } from "react";
import { speakUrdu } from "@/lib/client/voice";
import { listen } from "@/lib/client/listen";

type A = { answerUr: string; answerEn: string; sources: { id: string; title: string; text: string }[] };
export default function AskBox() {
  const [q, setQ] = useState("");
  const [a, setA] = useState<A | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask(question = q) {
    setBusy(true); setA(null);
    const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
    const d = await res.json(); setBusy(false);
    if (res.ok) { setA(d); void speakUrdu(d.answerUr); }
  }
  return (
    <div className="max-w-xl mx-auto space-y-3">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">❓ <span className="ur">سوال پوچھیں</span><span className="both-only"> · </span><span className="en">Ask about the rules</span></h2>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What happens if I am late? / اگر دیر ہو جائے تو کیا ہوگا؟" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={async () => { const t = await listen(7000).catch(() => null); if (t) { setQ(t); void ask(t); } }}>🎤 <span className="ur">بولیں</span></button>
          <button className="btn" disabled={busy || q.length < 3} onClick={() => ask()}>{busy ? "…" : "Ask"}</button>
        </div>
      </div>
      {a && (
        <div className="card space-y-2">
          <p className="ur text-xl">{a.answerUr}</p>
          <p className="muted">{a.answerEn}</p>
          <button className="btn btn-ghost" onClick={() => speakUrdu(a.answerUr)}>🔊 <span className="ur">سنیں</span></button>
          {a.sources.length > 0 && <div className="text-sm"><b>Sources (mock rulebook):</b>{a.sources.map((s) => <p key={s.id}><b>[{s.id}] {s.title}:</b> {s.text}</p>)}</div>}
        </div>
      )}
    </div>
  );
}
