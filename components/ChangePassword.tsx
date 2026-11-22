"use client";
import { useState } from "react";

// Change my password: old password, new one twice. Every other login of this account ends at once.
export default function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const tooShort = next.length > 0 && next.length < 10;
  const mismatch = again.length > 0 && again !== next;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords are not the same." });
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current: cur, next }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setCur(""); setNext(""); setAgain(""); setMsg({ ok: true, text: "Password changed. Every other login of this account has been signed out." }); }
      else setMsg({ ok: false, text: d.error ?? "Could not change the password." });
    } catch { setMsg({ ok: false, text: "No internet. Please try again." }); }
    setBusy(false);
  }
  return (
    <form className="card space-y-3" onSubmit={submit} style={{ padding: 20 }} data-tour="password">
      <h2 className="text-xl font-bold"><span className="en">Change my password</span> <span className="ur">پاس ورڈ بدلیں</span></h2>
      <p className="text-sm muted">At least 10 characters, with letters and numbers, not your name or phone number. After the change, every other phone or computer logged in to this account is signed out.</p>
      <label className="block text-sm font-semibold">Current password
        <input className="input mt-1" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      </label>
      <label className="block text-sm font-semibold">New password
        <input className="input mt-1" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={tooShort} required />
        {tooShort && <span className="field-check bad">At least 10 characters</span>}
      </label>
      <label className="block text-sm font-semibold">New password again
        <input className="input mt-1" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch} required />
        {mismatch && <span className="field-check bad">Not the same as above</span>}
      </label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`field-check ${msg.ok ? "ok" : "bad"}`} style={{ fontSize: ".95rem" }}>{msg.text}</p>}
      <button className="btn" disabled={busy || !cur || !next || mismatch || tooShort}>{busy ? "Changing…" : "Change password"}</button>
    </form>
  );
}
