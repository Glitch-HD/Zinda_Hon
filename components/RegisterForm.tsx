"use client";
import { useEffect, useState } from "react";
import { speakUrdu } from "@/lib/client/voice";

// Create account for new people. It only sends a REQUEST: a pension officer checks it against the
// (mock) NADRA and pension records before the account works. Only mock CNICs and phones are accepted.

type Role = "PENSIONER" | "HELPER" | "SHOPKEEPER";
const ROLES: { id: Role; icon: string; en: string; ur: string }[] = [
  { id: "PENSIONER", icon: "👵🏽", en: "I get a pension", ur: "پنشنر" },
  { id: "HELPER", icon: "🤝", en: "I help families", ur: "مددگار" },
  { id: "SHOPKEEPER", icon: "🏪", en: "I run a shop", ur: "دکاندار" },
];

export default function RegisterForm({ onDone }: { onDone: () => void }) {
  const [offices, setOffices] = useState<{ id: string; name: string; nameUr: string | null }[]>([]);
  const [f, setF] = useState({ tenantId: "", role: "PENSIONER" as Role, name: "", cnic: "", phone: "", dateOfBirth: "", area: "", pensionNo: "", password: "", pin: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    fetch("/api/auth/register").then((r) => r.json()).then((d) => {
      setOffices(d.offices ?? []);
      const first = d.offices?.find((o: { name: string }) => /karachi/i.test(o.name)) ?? d.offices?.[0];
      if (first) setF((x) => ({ ...x, tenantId: x.tenantId || first.id }));
    }).catch(() => setError("Could not load the pension offices. Check your connection."));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body: Record<string, string> = { tenantId: f.tenantId, role: f.role, name: f.name, cnic: f.cnic, phone: f.phone, password: f.password };
      if (f.dateOfBirth) body.dateOfBirth = f.dateOfBirth;
      if (f.area) body.area = f.area;
      if (f.role === "PENSIONER") body.pensionNo = f.pensionNo;
      if (f.pin) body.pin = f.pin;
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Please check the form and try again.");
      setDone(data.message);
      void speakUrdu("شکریہ۔ پنشن آفس آپ کی معلومات چیک کرے گا، پھر آپ لاگ اِن کر سکیں گے۔", "Thank you. The pension office will check your details, then you can log in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  if (done) return (
    <div className="space-y-3">
      <div className="bubble">✅ {done}</div>
      <button type="button" className="btn w-full" onClick={onDone}><span className="en">Back to start</span><span className="ur">واپس</span></button>
    </div>
  );

  return (
    <form className="space-y-3 reg-form" onSubmit={submit}>
      <div className="bubble text-sm"><span className="en">Fill this once. A pension officer checks it against the records, then your account opens. This is a demo: use a <b>mock CNIC</b> (00000-…) and a <b>mock phone</b> (0300000….).</span> <span className="ur">ایک بار فارم بھریں۔ پنشن افسر ریکارڈ سے ملا کر آپ کا اکاؤنٹ کھولے گا۔</span></div>
      <div className="choice-row">
        {ROLES.map((r) => (
          <button key={r.id} type="button" className={`choice-pill ${f.role === r.id ? "is-on" : ""}`} aria-pressed={f.role === r.id} onClick={() => setF({ ...f, role: r.id })}>{r.icon} <span className="en">{r.en}</span><span className="ur">{r.ur}</span></button>
        ))}
      </div>
      <label className="block space-y-1"><span className="text-sm font-semibold">Pension office <span className="ur muted">پنشن آفس</span></span>
        <select className="input" value={f.tenantId} onChange={set("tenantId")} required>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </label>
      <div className="reg-grid">
        <label className="block space-y-1"><span className="text-sm font-semibold">Full name <span className="ur muted">پورا نام</span></span>
          <input className="input" value={f.name} onChange={set("name")} required minLength={3} placeholder="As on your CNIC" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Mock CNIC <span className="ur muted">شناختی کارڈ</span></span>
          <input className="input" value={f.cnic} onChange={set("cnic")} required placeholder="00000-1234567-1" inputMode="numeric" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Mock phone <span className="ur muted">فون</span></span>
          <input className="input" value={f.phone} onChange={set("phone")} required placeholder="03000001234" inputMode="tel" /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Date of birth <span className="ur muted">تاریخ پیدائش</span></span>
          <input className="input" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">Area <span className="ur muted">علاقہ</span></span>
          <input className="input" value={f.area} onChange={set("area")} placeholder="e.g. Lyari" /></label>
        {f.role === "PENSIONER" && (
          <label className="block space-y-1"><span className="text-sm font-semibold">Pension number <span className="ur muted">پنشن نمبر</span></span>
            <input className="input" value={f.pensionNo} onChange={set("pensionNo")} required placeholder="PEN-K-1002" /></label>
        )}
        <label className="block space-y-1"><span className="text-sm font-semibold">Password <span className="ur muted">پاس ورڈ</span></span>
          <input className="input" type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" placeholder="8 or more letters" /></label>
        {f.role === "PENSIONER" && (
          <label className="block space-y-1"><span className="text-sm font-semibold">4-digit PIN <span className="ur muted">پن</span> <span className="muted font-normal">(optional)</span></span>
            <input className="input" value={f.pin} onChange={set("pin")} inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="••••" /></label>
        )}
      </div>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? "…" : <><span className="en">Send for checking</span><span className="ur">چیک کے لیے بھیجیں</span></>}</button>
      <p className="text-xs muted">No account opens until a pension officer approves it. Real CNIC or phone numbers are refused.</p>
    </form>
  );
}
