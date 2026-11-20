"use client";
import { useState } from "react";
import FaceCapture from "./FaceCapture";

export default function EnrollFace({ pensioners, initial }: { pensioners: { id: string; label: string; enrolled: boolean }[]; initial?: string }) {
  const [list, setList] = useState(pensioners);
  const [selected, setSelected] = useState(initial && pensioners.some((p) => p.id === initial) ? initial : pensioners.find((p) => !p.enrolled)?.id ?? pensioners[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(0);
  const current = list.find((p) => p.id === selected);
  return (
    <div className="card space-y-4" style={{ padding: 22 }}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Pensioner</span>
        <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setMsg(null); setKey((k) => k + 1); }}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.enrolled ? "✅" : "⬜"} {p.label}</option>)}
        </select>
      </label>
      {current?.enrolled && <p className="badge badge-ok">Already enrolled. Capturing again replaces the old face.</p>}
      <p className="text-sm">Ask the pensioner to look straight at the camera in good light, then press <b>Start camera</b>.</p>
      <FaceCapture key={key} withLiveness={false} onDone={async (r) => {
        const res = await fetch(`/api/pensioners/${selected}/enroll-face`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ descriptor: r.descriptor }) });
        if (res.ok) {
          setList((l) => l.map((p) => (p.id === selected ? { ...p, enrolled: true } : p)));
          setMsg({ ok: true, text: `Enrolled ${current?.label ?? ""} (face quality ${(r.quality * 100).toFixed(0)}%). She can now do proof-of-life and log in with her face.` });
        } else setMsg({ ok: false, text: "Enrolment failed. Please try again." });
      }} />
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.text}</p>}
    </div>
  );
}
