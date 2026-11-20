"use client";
import { useState } from "react";
export default function RunEvalButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        const res = await fetch("/api/admin/run-eval", { method: "POST" });
        const d = await res.json(); setBusy(false);
        setMsg(res.ok ? `Ran ${d.messages} test messages.` : d.error);
        if (res.ok) location.reload();
      }}>{busy ? "Running… (about a minute)" : "▶️ Run the labelled test set"}</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
