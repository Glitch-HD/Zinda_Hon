"use client";
import { useState } from "react";
import FaceCapture from "./FaceCapture";

export default function EnrollFace({ pensioners, initial }: { pensioners: { id: string; label: string; enrolled: boolean; nadraPhoto: boolean }[]; initial?: string }) {
  const [list, setList] = useState(pensioners);
  const [selected, setSelected] = useState(initial && pensioners.some((p) => p.id === initial) ? initial : (pensioners.find((p) => !p.enrolled && !p.nadraPhoto) ?? pensioners.find((p) => !p.enrolled))?.id ?? pensioners[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(0);
  const [reason, setReason] = useState("");
  const [anyway, setAnyway] = useState(false);
  const current = list.find((p) => p.id === selected);
  // She has a usable CNIC photo at NADRA: she does not need to come in. The camera only opens on purpose.
  const useNadra = Boolean(current && !current.enrolled && current.nadraPhoto && !anyway);
  return (
    <div className="card space-y-4" style={{ padding: 22 }}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Pensioner</span>
        <select className="input" value={selected} onChange={(e) => { setSelected(e.target.value); setMsg(null); setAnyway(false); setKey((k) => k + 1); }}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.label}{p.enrolled ? " (face on file)" : p.nadraPhoto ? " (NADRA photo: no visit needed)" : " (needs enrolment)"}</option>)}
        </select>
      </label>
      {current?.enrolled && (
        <div className="space-y-2">
          <p className="badge badge-warn" style={{ whiteSpace: "normal" }}>Already enrolled. Replacing a face is a sensitive step: write why, it is logged, this year&apos;s case goes to an officer, and you cannot approve this person&apos;s proof of life for a year.</p>
          <input className="input" placeholder="Reason for replacing the face (at least 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for replacing the face" />
        </div>
      )}
      {useNadra ? (
        <div className="card card-soft space-y-2">
          <p className="font-semibold">No visit needed for this pensioner</p>
          <p className="text-sm">NADRA (simulated) has a usable CNIC photo for her. During her proof of life she (or her helper) presses <b>&ldquo;Yes, use my NADRA photo&rdquo;</b>, and her face print is copied with her consent. Enrol here only if she asks you to, or if the NADRA photo does not work for her (for example it is very old).</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnyway(true)}>Enrol here anyway</button>
        </div>
      ) : <>
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
      </>}
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.text}</p>}
    </div>
  );
}
