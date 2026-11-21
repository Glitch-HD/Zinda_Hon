"use client";
import { useState } from "react";
import FaceCapture from "./FaceCapture";

export default function EnrollFace({ pensioners, initial }: { pensioners: { id: string; label: string; enrolled: boolean }[]; initial?: string }) {
  const [list, setList] = useState(pensioners);
  const [selected, setSelected] = useState(initial && pensioners.some((p) => p.id === initial) ? initial : pensioners.find((p) => !p.enrolled)?.id ?? pensioners[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(0);
  const [reason, setReason] = useState("");
  const current = list.find((p) => p.id === selected);
  return (
    <div className="card space-y-4" style={{ padding: 22 }}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Pensioner</span>
        <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setMsg(null); setKey((k) => k + 1); }}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.enrolled ? "" : ""} {p.label}</option>)}
        </select>
      </label>
      {current?.enrolled && (
        <div className="space-y-2">
          <p className="badge badge-warn" style={{ whiteSpace: "normal" }}>Already enrolled. Replacing a face is a sensitive step: write why, it is logged, this year&apos;s case goes to an officer, and you cannot approve this person&apos;s proof of life for a year.</p>
          <input className="input" placeholder="Reason for replacing the face (at least 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for replacing the face" />
        </div>
      )}
      <p className="text-sm">Ask the pensioner to look straight at the camera in good light, then press <b>Start camera</b>.</p>
      <FaceCapture key={key} withLiveness={false} onDone={async (r) => {
        const res = await fetch(`/api/pensioners/${selected}/enroll-face`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ descriptor: r.descriptor, reason: current?.enrolled ? reason : undefined }) });
        if (res.ok) {
          setList((l) => l.map((p) => (p.id === selected ? { ...p, enrolled: true } : p)));
          setMsg({ ok: true, text: `Enrolled ${current?.label ?? ""} (face quality ${(r.quality * 100).toFixed(0)}%). She can now do proof-of-life and log in with her face.` });
        } else {
          const d = await res.json().catch(() => ({}));
          setMsg({ ok: false, text: d.error ?? "Enrolment failed. Please try again." });
          setKey((k) => k + 1);
        }
      }} />
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.text}</p>}
    </div>
  );
}
