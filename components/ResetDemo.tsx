"use client";
import { useState } from "react";

// DEMO ONLY: wipe everything and start the demo from the beginning (e.g. on the morning of judging).
export default function ResetDemo() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function reset() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/reset-demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: text }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `Done in ${d.seconds ?? "a few"} seconds. Everything is back to a fresh start. Taking you to the log-in page…` });
      setTimeout(() => { window.location.href = "/login"; }, 2500);
    } else setMsg({ ok: false, text: d.error ?? "Reset failed. Nothing was changed if this happened before the wipe; try again." });
  }
  return (
    <div className="card space-y-3" style={{ borderLeft: "5px solid var(--danger)" }} id="reset">
      <h2 className="text-xl font-bold">Reset demo data</h2>
      <p>Starts the whole demo from the beginning: <b>every enrolled face, mock NADRA face, proof of life, decision, AI run, sign-up, scam report and notification is deleted</b>. The demo accounts and passwords stay the same, with fresh cases for this year. Everyone is logged out.</p>
      <p className="muted text-sm">Use it before judging or between judges. This cannot be undone. The audit log is append-only, so even a reset cannot delete it: old entries are kept in the database but no longer show, and the new log starts with this reset.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input className="input" style={{ maxWidth: 220 }} placeholder="Type RESET" aria-label="Type RESET to confirm" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-danger" disabled={busy || text !== "RESET"} onClick={reset}>{busy ? "Resetting… (up to a minute)" : "Reset everything"}</button>
      </div>
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.text}</p>}
    </div>
  );
}
