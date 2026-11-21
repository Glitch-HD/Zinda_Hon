"use client";
import { useEffect, useState } from "react";

export default function OfficerActions({ caseId, closed, aiSaysInvestigate = false, secondOfficerNeeded = false }: { caseId: string; closed: boolean; aiSaysInvestigate?: boolean; secondOfficerNeeded?: boolean }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The AI case assistant can paste its report here as a starting point. The officer edits and decides.
  useEffect(() => {
    const onNotes = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === "string") setNote((old) => (old.trim() ? `${old.trim()}\n\n${text}` : text).slice(0, 2000));
    };
    window.addEventListener("zh:agent-notes", onNotes);
    return () => window.removeEventListener("zh:agent-notes", onNotes);
  }, []);

  async function act(action: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/cases/${caseId}/officer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "Failed"); return; }
    if (data.pending) { setMsg(data.message); setTimeout(() => window.location.reload(), 3500); return; }
    window.location.reload();
  }

  if (closed) return <p className="mt-4 muted">This case is closed.</p>;
  return (
    <div className="mt-4 space-y-2">
      <textarea id="officer-notes" aria-label="Officer notes" className="input" style={{ minHeight: 80, paddingTop: 8 }} placeholder="Your notes (required to stop a pension)" value={note} onChange={(e) => setNote(e.target.value)} />
      {aiSaysInvestigate && <p className="text-sm" style={{ color: "var(--danger)" }}>⛔ The AI assistant advised investigating before paying. Approving needs your own written check (not the pasted AI notes) and a second officer to confirm.</p>}
      {secondOfficerNeeded && <p className="text-sm" style={{ color: "var(--warn)" }}>👥 Another officer has proposed approving this case. If you have checked it yourself, you can confirm (Approve) or refuse (Stop / Ask for more proof).</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn" style={aiSaysInvestigate ? { background: "var(--card)", color: "var(--ink)", border: "1.5px solid var(--danger)", boxShadow: "none" } : undefined} disabled={busy} onClick={() => act("approve")}>{secondOfficerNeeded ? "✅ Confirm approval as 2nd officer" : aiSaysInvestigate ? "⚠️ Approve anyway (needs a 2nd officer)" : "✅ Approve, pension continues"}</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => act("ask_more_proof")}>📷 Ask for more proof</button>
        <button className="btn" style={{ background: "var(--danger)" }} disabled={busy} onClick={() => act("stop")}>⛔ Stop pension</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => act("assign_to_me")}>Assign to me</button>
      </div>
      {msg && <p role="alert" style={{ color: msg.startsWith("Not approved yet") ? "var(--warn)" : "var(--danger)" }}>{msg}</p>}
    </div>
  );
}
