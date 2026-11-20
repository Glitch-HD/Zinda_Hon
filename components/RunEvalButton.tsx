"use client";
import { useState } from "react";

// Runs a labelled test set a few items per request (see the API routes), showing progress, so a long
// run never hits the hosting time limit. Waits a little between batches to stay under the free AI rate limit.
export default function RunEvalButton({ endpoint = "/api/admin/run-eval", label = "▶️ Run the labelled test set", pauseMs = 1500 }: { endpoint?: string; label?: string; pauseMs?: number }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ next: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true); setMsg(null); setProgress(null);
    let runId: string | undefined;
    let offset = 0;
    try {
      for (let guard = 0; guard < 500; guard++) {
        const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId, offset }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error ?? "The run stopped.");
        runId = d.runId; offset = d.next;
        setProgress({ next: d.next, total: d.total });
        if (d.done) { setMsg(`Done: ${d.total} items checked.`); location.reload(); return; }
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    } catch (err) {
      setMsg(`${(err as Error).message} ${offset} items were finished and are counted; press the button again for a fresh run.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button className="btn" disabled={busy} onClick={run}>{busy ? "Running…" : label}</button>
      {progress && (
        <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.next}>
          <div style={{ height: 10, borderRadius: 6, background: "var(--line)", overflow: "hidden" }}>
            <div style={{ width: `${(progress.next / progress.total) * 100}%`, height: "100%", background: "var(--brand)", transition: "width .3s" }} />
          </div>
          <p className="text-sm muted mt-1">{progress.next} of {progress.total}</p>
        </div>
      )}
      {msg && <p className="text-sm mt-1" role="status">{msg}</p>}
    </div>
  );
}
