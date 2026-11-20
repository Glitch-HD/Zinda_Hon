"use client";
import { useState } from "react";
import { listenUrdu, speakUrdu } from "@/lib/client/voice";

type R = { label: string; confidence: number; route: string; explanationUr: string; explanationEn: string; signs: { id: string; en: string; ur: string }[] };

export default function MessageChecker() {
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");
  const [r, setR] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function check() {
    setBusy(true); setErr(null); setR(null);
    try {
      const res = await fetch("/api/messages/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, sender: sender || undefined }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setR(d);
      void speakUrdu(d.explanationUr);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  const look = r?.route === "warn_user" ? { icon: "🚫", color: "var(--danger)", ur: "خبردار! یہ دھوکہ ہے", en: "Warning: scam" }
    : r?.route === "reassure_user" ? { icon: "✅", color: "var(--ok)", ur: "یہ پیغام اصلی لگتا ہے", en: "Looks genuine" }
    : { icon: "🧑‍💼", color: "var(--warn)", ur: "ہمیں یقین نہیں، افسر دیکھے گا", en: "Not sure: sent to an officer" };

  return (
    <div className="space-y-3 max-w-xl mx-auto">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">🛡️ <span className="ur">کیا یہ پیغام اصلی ہے؟</span> Is this message real?</h2>
        <textarea className="input" style={{ minHeight: 120, paddingTop: 8 }} placeholder="Paste or speak the message here / پیغام یہاں لکھیں" value={text} onChange={(e) => setText(e.target.value)} />
        <input className="input" placeholder="Sender number (optional)" value={sender} onChange={(e) => setSender(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); const t = await listenUrdu().catch(() => null); setBusy(false); if (t) setText(t); else setErr("Could not hear clearly. Please type it."); }}>🎤 <span className="ur">بول کر بتائیں</span></button>
          <button className="btn" disabled={busy || text.trim().length < 3} onClick={check}>{busy ? "…" : "Check / جانچیں"}</button>
        </div>
        {err && <p role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
      {r && (
        <div className="card text-center space-y-2" style={{ borderColor: look.color, borderWidth: 2 }}>
          <div className="text-6xl">{look.icon}</div>
          <p className="ur text-2xl" style={{ color: look.color }}>{look.ur}</p>
          <p className="font-semibold">{look.en} · {(r.confidence * 100).toFixed(0)}% sure</p>
          <p className="ur text-lg">{r.explanationUr}</p>
          <p className="muted text-sm">{r.explanationEn}</p>
          {r.signs.length > 0 && <ul className="text-sm text-left">{r.signs.map((s) => <li key={s.id}>⚠️ {s.en} · <span className="ur">{s.ur}</span></li>)}</ul>}
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(r.explanationUr)}>🔊 <span className="ur">سنیں</span></button>
        </div>
      )}
    </div>
  );
}
