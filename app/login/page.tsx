"use client";
import { useState } from "react";

// Demo accounts are listed so judges can try every role. All are fake.
const DEMO = [
  { phone: "03000000006", label: "Pensioner (widow)", labelUr: "پنشنر", icon: "👵" },
  { phone: "03000000004", label: "Community helper", labelUr: "مددگار", icon: "🤝" },
  { phone: "03000000005", label: "Shopkeeper", labelUr: "دکاندار", icon: "🏪" },
  { phone: "03000000001", label: "Pension officer", labelUr: "پنشن افسر", icon: "🧑‍💼" },
  { phone: "03000000002", label: "Admin", labelUr: "ایڈمن", icon: "⚙️" },
  { phone: "03000000003", label: "Auditor", labelUr: "آڈیٹر", icon: "🔍" },
];

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(p = phone, pw = password) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: p, password: pw }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      window.location.href = data.home;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center pt-4">
        <div className="text-5xl">🫀</div>
        <h1 className="text-3xl font-bold">Zinda Hoon</h1>
        <p className="ur text-xl">زندہ ہوں: سال میں ایک بار، گھر بیٹھے ثبوتِ حیات</p>
        <p className="muted text-sm">Yearly pension proof-of-life from home (prototype)</p>
      </div>
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); login(); }}>
        <label className="block">
          <span className="ur">فون نمبر</span> <span className="muted text-sm">Phone</span>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username" />
        </label>
        <label className="block">
          <span className="ur">پاس ورڈ</span> <span className="muted text-sm">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "…" : "Log in / لاگ اِن"}</button>
      </form>
      <div className="card">
        <p className="font-semibold mb-2">Demo accounts (password: demo1234)</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button key={d.phone} className="btn btn-ghost" disabled={busy} onClick={() => login(d.phone, "demo1234")}>
              <span className="text-2xl">{d.icon}</span>
              <span className="text-left leading-tight"><span className="block text-sm">{d.label}</span><span className="ur block text-sm">{d.labelUr}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
