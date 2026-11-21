"use client";
import { useState } from "react";
import FaceCapture from "./FaceCapture";

type Rec = { cnic: string; label: string; hasFace: boolean };

// DEMO ONLY. Puts a face print into the simulated NADRA registry so the "no office visit" flow can be shown.
export default function MockNadraLoader({ records }: { records: Rec[] }) {
  const [list, setList] = useState(records);
  const [cnic, setCnic] = useState(records.find((r) => !r.hasFace)?.cnic ?? records[0]?.cnic ?? "");
  const [key, setKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = list.find((r) => r.cnic === cnic);
  async function wipe() {
    const res = await fetch("/api/mock-nadra/face", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "wipe" }) });
    if (res.ok) { setList((l) => l.map((r) => ({ ...r, hasFace: false }))); setMsg({ ok: true, text: "All demo faces deleted from mock NADRA, and every face print that came from it." }); }
  }
  return (
    <div className="card space-y-4" style={{ padding: 22 }}>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Mock NADRA record (fake CNIC)</span>
        <select className="input" value={cnic} onChange={(e) => { setCnic(e.target.value); setMsg(null); setKey((k) => k + 1); }}>
          {list.map((r) => <option key={r.cnic} value={r.cnic}>{r.hasFace ? "" : ""} {r.label}</option>)}
        </select>
      </label>
      <p className="text-sm">The volunteer looks at the camera; press <b>Start camera</b>. This stands in for the CNIC photo NADRA would already hold.</p>
      <FaceCapture key={key} withLiveness={false} onDone={async (r) => {
        const res = await fetch("/api/mock-nadra/face", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "load", cnic, descriptor: r.descriptor }) });
        if (res.ok) {
          setList((l) => l.map((x) => (x.cnic === cnic ? { ...x, hasFace: true } : x)));
          setMsg({ ok: true, text: `Loaded into mock NADRA for ${current?.label ?? cnic}. She can now start proof of life from home and agree to use her CNIC photo.` });
        } else {
          const d = await res.json().catch(() => ({}));
          setMsg({ ok: false, text: d.error ?? "Could not save. Try again." });
          setKey((k) => k + 1);
        }
      }} />
      {msg && <p role="status" className={msg.ok ? "badge badge-ok" : "badge badge-danger"} style={{ whiteSpace: "normal", display: "block", padding: 10 }}>{msg.text}</p>}
      <button className="btn btn-ghost" onClick={wipe}>Delete all demo faces (do this after judging)</button>
    </div>
  );
}
