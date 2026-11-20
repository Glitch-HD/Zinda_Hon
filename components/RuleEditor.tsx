"use client";
import { useState } from "react";
import type { RuleConfig } from "@/lib/decision";

type Sim = { total: number; changed: number; summary: Record<string, { before: number; after: number }>; officerWorkloadPkr: { before: number; after: number }; changes: { pensionNo: string; name: string; before: string; after: string }[] };

const FIELDS: { path: string[]; label: string; step: number }[] = [
  { path: ["costs", "wrongApprovalPkr"], label: "Cost of a wrong approval (Rs)", step: 1000 },
  { path: ["costs", "humanReviewPkr"], label: "Cost of one officer review (Rs)", step: 100 },
  { path: ["face", "strictDistance"], label: "Face distance for auto-approve (lower = stricter)", step: 0.01 },
  { path: ["face", "looseDistance"], label: "Face distance above which it is a mismatch", step: 0.01 },
  { path: ["identity", "autoMinSimilarity"], label: "Name similarity needed to auto-approve", step: 0.01 },
  { path: ["identity", "askMinSimilarity"], label: "Name similarity below which it goes to an officer", step: 0.01 },
  { path: ["anomaly", "maxAgeYears"], label: "Flag pensioners older than (years)", step: 1 },
  { path: ["maxAttempts"], label: "Retakes allowed before an officer takes over", step: 1 },
];

function get(o: Record<string, unknown>, path: string[]): number {
  return path.reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o) as number;
}
function set(o: RuleConfig, path: string[], v: number): RuleConfig {
  const copy = structuredClone(o) as unknown as Record<string, unknown>;
  let cur = copy;
  for (const k of path.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[path.at(-1)!] = v;
  return copy as unknown as RuleConfig;
}

export default function RuleEditor({ initial }: { initial: RuleConfig }) {
  const [cfg, setCfg] = useState(initial);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json() };
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.path.join(".")} className="block text-sm">{f.label}
            <input className="input" type="number" step={f.step} value={get(cfg as unknown as Record<string, unknown>, f.path)} onChange={(e) => setCfg(set(cfg, f.path, Number(e.target.value)))} />
          </label>
        ))}
      </div>
      <p className="text-sm muted">Stricter changes apply at once. A change that makes any check looser needs a second admin to approve it.</p>
      <input className="input" placeholder="Why are you changing this? (saved in the audit log)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" onClick={async () => { const r = await post("/api/admin/simulate", { config: cfg }); if (r.ok) setSim(r.data); else setMsg(r.data.error); }}>🧪 Test on past cases first (Digital Twin)</button>
        <button className="btn" onClick={async () => { const r = await post("/api/admin/rules", { config: cfg, note }); setMsg(!r.ok ? r.data.error : r.data.pending ? `This makes the checks looser (${r.data.loosened.join("; ")}). It now waits for a second admin to approve it.` : `Published version ${r.data.version}. It applies to the next decision.`); if (r.ok) setTimeout(() => location.reload(), r.data.pending ? 2500 : 800); }}>Publish new version</button>
      </div>
      {msg && <p role="status">{msg}</p>}
      {sim && (
        <div className="card">
          <p><b>{sim.changed}</b> of {sim.total} past decisions would change.</p>
          <table className="data"><thead><tr><th>Outcome</th><th>Now</th><th>With this rule</th></tr></thead>
            <tbody>{Object.entries(sim.summary).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.before}</td><td>{v.after}</td></tr>)}</tbody></table>
          <p className="text-sm">Officer review cost: Rs {sim.officerWorkloadPkr.before.toLocaleString()} → Rs {sim.officerWorkloadPkr.after.toLocaleString()}</p>
          {sim.changes.length > 0 && <ul className="text-sm">{sim.changes.map((c, i) => <li key={i}>{c.pensionNo} {c.name}: {c.before} → {c.after}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
