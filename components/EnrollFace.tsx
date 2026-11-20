"use client";
import { useState } from "react";
import FaceCapture from "./FaceCapture";

export default function EnrollFace({ pensioners }: { pensioners: { id: string; label: string; enrolled: boolean }[] }) {
  const [selected, setSelected] = useState(pensioners[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card space-y-3 max-w-xl">
      <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {pensioners.map((p) => <option key={p.id} value={p.id}>{p.label} {p.enrolled ? "✓ enrolled" : ""}</option>)}
      </select>
      <FaceCapture withLiveness={false} onDone={async (r) => {
        const res = await fetch(`/api/pensioners/${selected}/enroll-face`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ descriptor: r.descriptor }) });
        setMsg(res.ok ? `Enrolled (face quality ${(r.quality * 100).toFixed(0)}%).` : "Enrolment failed.");
      }} />
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
