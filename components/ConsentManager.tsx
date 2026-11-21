"use client";
import { useEffect, useState } from "react";
import { speakUrdu } from "@/lib/client/voice";

type Consent = { id: string; granteeType: string; granteeName: string; fields: string[]; grantedAt: string; withdrawnAt: string | null };
type Log = { id: string; action: string; actorRole: string | null; createdAt: string };
const FIELD_LABEL: Record<string, string> = { name: "Name · نام", cnic: "CNIC · شناختی کارڈ", face: "Face · چہرہ", bank_account: "Bank account · بینک اکاؤنٹ", case_status: "Case status · کیس کی صورتحال" };

export default function ConsentManager() {
  const [data, setData] = useState<{ consents: Consent[]; accessLog: Log[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch("/api/consents").then((r) => r.json()).then(setData);
  useEffect(() => { void load(); }, []);

  async function act(id: string, body: object) {
    setMsg(null);
    const res = await fetch(`/api/consents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) setMsg(d.error);
    await load();
  }
  async function correction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field: f.get("field"), newValue: f.get("newValue") }) });
    setMsg(res.ok ? "Sent to the pension office. / درخواست بھیج دی گئی۔" : "Could not send.");
  }

  if (!data) return <p>Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-xl font-bold">🔐 Who can see my data <span className="ur">میرا ڈیٹا کون دیکھ سکتا ہے</span></h2>
        <button className="btn btn-ghost mt-2" onClick={() => speakUrdu("یہاں آپ دیکھ سکتے ہیں کہ آپ کا ڈیٹا کس کے پاس ہے۔ آپ اجازت واپس لے سکتے ہیں۔", "Here you can see who has your data. You can take back permission.")}>🔊 <span className="ur">سنیں</span></button>
      </div>
      {data.consents.map((c) => (
        <div key={c.id} className="card space-y-2">
          <div className="flex justify-between items-center gap-2">
            <div><b>{c.granteeName}</b> <span className="badge">{c.granteeType}</span></div>
            {c.withdrawnAt ? <span className="badge badge-danger">Withdrawn {c.withdrawnAt.slice(0, 10)}</span> : <span className="badge badge-ok">Active</span>}
          </div>
          {c.granteeType !== "nadra" && <div className="flex flex-wrap gap-2">
            {Object.keys(FIELD_LABEL).map((f) => (
              <label key={f} className="badge" style={{ cursor: c.withdrawnAt ? "default" : "pointer", opacity: c.withdrawnAt ? 0.5 : 1 }}>
                <input type="checkbox" disabled={Boolean(c.withdrawnAt)} checked={c.fields.includes(f)} onChange={(e) => act(c.id, { action: "update_fields", fields: e.target.checked ? [...c.fields, f] : c.fields.filter((x) => x !== f) })} /> {FIELD_LABEL[f]}
              </label>
            ))}
          </div>}
          {c.granteeType === "nadra" && <p className="text-sm muted">🪪 <span className="en">Your face print was copied from your CNIC photo at NADRA (simulated) so you did not have to visit the office. Withdrawing deletes it at once; next year you can agree again or enrol at the office.</span><span className="ur">آپ کے شناختی کارڈ کی تصویر سے چہرے کی پہچان لی گئی تاکہ آفس نہ جانا پڑے۔ اجازت واپس لینے پر یہ فوراً مٹ جائے گی۔</span></p>}
          {c.granteeType === "nadra" && c.withdrawnAt ? null : c.granteeType === "department" && !c.withdrawnAt
            ? <p className="text-sm muted">🏛️ <span className="en">The pension office needs your bank account to pay you, so this one cannot be withdrawn here. Talk to an officer to stop the pension.</span><span className="ur">پنشن آفس کو پنشن بھیجنے کے لیے بینک اکاؤنٹ چاہیے، اس لیے یہ اجازت یہاں واپس نہیں ہو سکتی۔</span></p>
            : c.withdrawnAt
            ? <button className="btn btn-ghost" onClick={() => act(c.id, { action: "restore" })}>↩️ Give permission again</button>
            : <button className="btn" style={{ background: "var(--danger)" }} onClick={() => act(c.id, { action: "withdraw" })}>⛔ <span className="ur">اجازت واپس لیں</span> · Withdraw</button>}
        </div>
      ))}
      {msg && <p role="status" className="card">{msg}</p>}
      <form className="card space-y-2" onSubmit={correction}>
        <h3 className="font-semibold">✏️ My data is wrong <span className="ur">میرا ڈیٹا غلط ہے</span></h3>
        <select name="field" className="input">
          <option value="name">Name</option><option value="fatherOrHusbandName">Husband or father&apos;s name</option><option value="dateOfBirth">Date of birth</option><option value="cnicMock">CNIC</option><option value="bankAccountNo">Bank account</option>
        </select>
        <input name="newValue" className="input" placeholder="Correct value" required />
        <button className="btn">Send to pension office</button>
      </form>
      <div className="card">
        <h3 className="font-semibold">Recent access to my data</h3>
        <ul className="text-sm">{data.accessLog.map((l) => <li key={l.id}>{l.createdAt.slice(0, 16).replace("T", " ")} · {l.action.replaceAll("_", " ")} {l.actorRole ? `(${l.actorRole.toLowerCase()})` : ""}</li>)}</ul>
      </div>
    </div>
  );
}
