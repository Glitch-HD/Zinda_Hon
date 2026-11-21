"use client";
import { useState } from "react";

type Req = { id: string; baseVersion: number; note: string | null; loosened: string[]; proposedBy: string; proposerName: string; createdAt: string; mine: boolean };

// Looser rule changes waiting for a second admin. The proposer can only cancel; another admin approves or rejects.
export default function RuleRequests({ requests }: { requests: Req[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const act = async (id: string, action: "approve" | "reject" | "cancel") => {
    const res = await fetch(`/api/admin/rules/requests/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note: note || undefined }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? (d.version ? `Approved. Version ${d.version} is now active.` : `Change ${d.status}.`) : d.error ?? "Failed");
    if (res.ok) setTimeout(() => location.reload(), 900);
  };
  if (!requests.length) return <p className="text-sm muted">No looser rule changes are waiting.</p>;
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="card card-soft">
          <p className="text-sm"><b>{r.proposerName}</b> proposed on {r.createdAt.slice(0, 16).replace("T", " ")} (against v{r.baseVersion}){r.note ? `: “${r.note}”` : ""}</p>
          <ul className="list-disc ms-5 text-sm mt-1">{r.loosened.map((l) => <li key={l}>{l}</li>)}</ul>
          <div className="flex flex-wrap gap-2 mt-2">
            {r.mine ? (
              <><span className="text-sm muted">Waiting for a second admin.</span><button className="btn btn-ghost btn-sm" onClick={() => act(r.id, "cancel")}>Cancel my change</button></>
            ) : (
              <><input className="input" style={{ maxWidth: 280 }} placeholder="Your reason (saved in the audit log)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-sm" onClick={() => act(r.id, "approve")}>Approve as second admin</button>
                <button className="btn btn-ghost btn-sm" onClick={() => act(r.id, "reject")}>✖ Reject</button></>
            )}
          </div>
        </div>
      ))}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
