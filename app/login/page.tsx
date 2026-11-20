"use client";
import { useState } from "react";
import Logo from "@/components/Logo";
import PensionerLogin from "@/components/PensionerLogin";
import { speakUrdu } from "@/lib/client/voice";

// Front page. Urdu first, one big picture button per kind of person.
// Pensioners never type: they log in with their pension book QR + face (or a 4-digit PIN).
// Helpers, shopkeepers and staff can read, so they use phone + password.

type View = "choose" | "pensioner" | "helper" | "shopkeeper" | "staff";

const GREETING = "زندہ ہوں میں خوش آمدید۔ اگر آپ پنشن لیتے ہیں تو سب سے اوپر والا بڑا بٹن دبائیں۔";

const FORM_TITLE: Record<Exclude<View, "choose" | "pensioner">, { en: string; ur: string; icon: string }> = {
  helper: { en: "Helper login", ur: "مددگار لاگ اِن", icon: "🤝" },
  shopkeeper: { en: "Shopkeeper login", ur: "دکاندار لاگ اِن", icon: "🏪" },
  staff: { en: "Pension office staff", ur: "پنشن آفس عملہ", icon: "🏛️" },
};

// Demo accounts are listed so judges can try every role. All are fake.
const DEMO = [
  { phone: "03000000006", label: "Pensioner (widow)", icon: "👵🏽" },
  { phone: "03000000004", label: "Community helper", icon: "🤝" },
  { phone: "03000000005", label: "Shopkeeper", icon: "🏪" },
  { phone: "03000000001", label: "Pension officer", icon: "🧑‍💼" },
  { phone: "03000000002", label: "Admin", icon: "⚙️" },
  { phone: "03000000003", label: "Auditor", icon: "🔍" },
];

export default function LoginPage() {
  const [view, setView] = useState<View>("choose");
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

  function open(v: View) {
    setError(null);
    setView(v);
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center pt-2 space-y-2">
        <div className="flex justify-center"><Logo size={68} /></div>
        <h1 className="ur text-5xl font-bold" style={{ lineHeight: 1.9 }}>زندہ ہوں</h1>
        <p className="text-sm font-extrabold tracking-[.2em] uppercase" style={{ color: "var(--brand)" }}>Zinda Hon</p>
        <p className="ur text-lg">سال میں ایک بار، گھر بیٹھے ثبوتِ حیات</p>
        <p className="muted text-sm">Yearly pension proof-of-life from home. No forms, no queues.</p>
      </div>

      {view === "pensioner" && <PensionerLogin onBack={() => open("choose")} />}

      {view === "choose" && (
        <div className="space-y-3">
          <button className="btn btn-ghost w-full" onClick={() => speakUrdu(GREETING)}>🔊 <span className="ur">سنیں</span> · Listen</button>

          <button className="tile tile-hero" onClick={() => { open("pensioner"); void speakUrdu("اپنی پنشن بک کھولیں اور اس کا کیو آر کوڈ کیمرے کے سامنے رکھیں۔"); }}>
            <span className="tile-icon">👵🏽</span>
            <span className="flex-1">
              <span className="ur block text-2xl font-bold" style={{ lineHeight: 1.8 }}>میں پنشنر ہوں</span>
              <span className="block font-bold">I get a pension</span>
              <span className="block text-sm muted">No typing. Show your pension book, then your face.</span>
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button className="tile flex-col text-center" onClick={() => open("helper")}>
              <span className="tile-icon">🤝</span>
              <span>
                <span className="ur block text-lg font-semibold" style={{ lineHeight: 1.8 }}>میں مددگار ہوں</span>
                <span className="block text-sm font-semibold">I help families</span>
              </span>
            </button>
            <button className="tile flex-col text-center" onClick={() => open("shopkeeper")}>
              <span className="tile-icon">🏪</span>
              <span>
                <span className="ur block text-lg font-semibold" style={{ lineHeight: 1.8 }}>میں دکاندار ہوں</span>
                <span className="block text-sm font-semibold">I run a shop</span>
              </span>
            </button>
          </div>

          <button className="tile" style={{ padding: 12 }} onClick={() => open("staff")}>
            <span className="tile-icon" style={{ width: 44, height: 44, fontSize: "1.4rem", borderRadius: 12 }}>🏛️</span>
            <span className="flex-1">
              <span className="block font-semibold">Pension office staff</span>
              <span className="block text-xs muted">Officer, admin, auditor</span>
            </span>
            <span className="muted">→</span>
          </button>
        </div>
      )}

      {view !== "choose" && view !== "pensioner" && (
        <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); login(); }}>
          <div className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => open("choose")}>← Back</button>
            <span className="text-3xl">{FORM_TITLE[view].icon}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold">{FORM_TITLE[view].en}</h2>
            <p className="ur muted">{FORM_TITLE[view].ur}</p>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Phone number <span className="ur muted">فون نمبر</span></span>
            <input className="input" inputMode="tel" placeholder="03XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Password <span className="ur muted">پاس ورڈ</span></span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "…" : "Log in"}</button>
        </form>
      )}

      <details className="card card-soft">
        <summary className="cursor-pointer font-semibold">🧪 For judges: one-tap demo accounts</summary>
        <p className="muted text-sm mt-2">All accounts are fake. Password for all: <b>demo1234</b>. To try the no-typing pensioner login, tap “I get a pension”, then “Use the sample pension book”, then PIN <b>1234</b>.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {DEMO.map((d) => (
            <button key={d.phone} className="btn btn-ghost btn-sm justify-start" disabled={busy} onClick={() => login(d.phone, "demo1234")}>
              <span className="text-lg">{d.icon}</span>
              <span className="text-left text-sm">{d.label}</span>
            </button>
          ))}
        </div>
        {error && view === "choose" && <p role="alert" className="mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
      </details>
    </div>
  );
}
