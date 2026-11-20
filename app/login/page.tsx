"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import PensionerLogin from "@/components/PensionerLogin";
import Option from "@/components/ui/Option";
import VoiceCommand from "@/components/ui/VoiceCommand";
import { speakUrdu } from "@/lib/client/voice";
import { setPrefsRole } from "@/lib/client/prefs";

// Front page. Urdu first, one big picture button per kind of person, each with an ⓘ that explains it.
// Pensioners never type: they log in with their pension book QR + face (or a PIN they can say or tap).
// Helpers, shopkeepers and staff can read, so they use phone + password.

type View = "choose" | "pensioner" | "helper" | "shopkeeper" | "staff";

const GREETING = "زندہ ہوں میں خوش آمدید۔ اگر آپ پنشن لیتی ہیں تو سب سے بڑا سبز بٹن دبائیں، یا مائیک دبا کر بولیں۔";

const GREETING_EN = "Welcome to Zinda Hon. If you receive a pension, press the big green button, or press the mic and speak.";

const FORM_TITLE: Record<Exclude<View, "choose" | "pensioner">, { en: string; ur: string; icon: string }> = {
  helper: { en: "Helper login", ur: "مددگار لاگ اِن", icon: "🤝" },
  shopkeeper: { en: "Shopkeeper login", ur: "دکاندار لاگ اِن", icon: "🏪" },
  staff: { en: "Pension office staff", ur: "پنشن آفس عملہ", icon: "🏛️" },
};



// One-tap logins for testing. Hide them before judging by setting NEXT_PUBLIC_HIDE_TEST_LOGINS=1 in Vercel and redeploying.
const SHOW_TEST_LOGINS = process.env.NEXT_PUBLIC_HIDE_TEST_LOGINS !== "1";
const TEST_LOGINS = [
  { icon: "👵🏽", label: "Zainab Bibi", role: "Pensioner", phone: "03026619470", pw: "Zainab786" },
  { icon: "👵🏽", label: "Sakina Baloch", role: "Pensioner", phone: "03154407218", pw: "Sakina4321" },
  { icon: "👴🏽", label: "Ghulam Rasool", role: "Pensioner", phone: "03317065529", pw: "Rasool1949" },
  { icon: "🧑‍💼", label: "Sana Qureshi", role: "Officer, Karachi", phone: "03214417832", pw: "Sana@Pension24" },
  { icon: "🧑‍💼", label: "Bilal Ahmed", role: "Officer, Karachi", phone: "03332290615", pw: "Bilal#Korangi7" },
  { icon: "🧑‍💼", label: "Naveed Memon", role: "Officer, Hyderabad", phone: "03003108847", pw: "Naveed!Hyd52" },
  { icon: "⚙️", label: "Kamran Siddiqui", role: "Admin", phone: "03452876104", pw: "Kamran$Admin9" },
  { icon: "🔎", label: "Nadia Hussain", role: "Auditor", phone: "03127739025", pw: "Nadia&Audit3" },
  { icon: "🤝", label: "Rubina Shaikh", role: "Helper, Lyari", phone: "03012654398", pw: "Rubina@Lyari8" },
  { icon: "🤝", label: "Farhan Ali", role: "Helper, Korangi", phone: "03349182746", pw: "Farhan%Help6" },
  { icon: "🏪", label: "Imran Baig", role: "Shopkeeper, Lyari", phone: "03225501987", pw: "Imran*Shop4" },
  { icon: "🏪", label: "Saleem Jokhio", role: "Shopkeeper, Malir", phone: "03468820431", pw: "Saleem+Mart2" },
];

const HOW = [
  { icon: "📖", ur: "پنشن بک دکھائیں", en: "Show your pension book" },
  { icon: "🙂", ur: "کیمرے میں دیکھیں", en: "Look at the camera" },
  { icon: "✅", ur: "پنشن جاری رہے گی", en: "Your pension continues" },
];

export default function LoginPage() {
  const [view, setView] = useState<View>("choose");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => { setExpired(new URLSearchParams(window.location.search).has("expired")); }, []);

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
    if (v !== "pensioner") setPrefsRole("guest");
    setError(null);
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openPensioner() {
    setPrefsRole("PENSIONER");
    open("pensioner");
    void speakUrdu("اپنی پنشن بک کھولیں اور اس کا کیو آر کوڈ کیمرے کے سامنے رکھیں۔", "Open your pension book and hold its QR code in front of the camera.");
  }

  return (
    <div className="grid gap-8 lg:gap-14 md:grid-cols-[1fr_1.05fr] md:items-start">
      {/* Left on big screens, top on phones: an arch (mehrab) shaped welcome panel */}
      <section className="hero-panel text-center space-y-4 md:sticky md:top-8">
        <div className="sun" aria-hidden="true" />
        <div className="relative flex justify-center"><div className="rounded-[22px] p-1.5" style={{ background: "rgba(255,255,255,.18)" }}><Logo size={70} /></div></div>
        <div className="relative">
          <h1 className="ur always text-5xl md:text-6xl font-bold" style={{ lineHeight: 1.9, fontFamily: "var(--font-ur, 'Noto Nastaliq Urdu')" }}>زندہ ہوں</h1>
          <p className="text-xs font-extrabold tracking-[.35em] uppercase" style={{ color: "#f6c66f" }}>Zinda Hon</p>
        </div>
        <p className="ur text-xl md:text-2xl relative">سال میں ایک بار، گھر بیٹھے ثبوتِ حیات</p>
        <p className="en muted md:text-lg relative" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Yearly pension proof-of-life from home. No forms, no queues, no fingerprints.</p>
        <button className="btn relative" style={{ background: "rgba(255,255,255,.95)", color: "#0b5446" }} onClick={() => speakUrdu(GREETING, GREETING_EN)} data-no-voice>🔊 <span className="ur">سنیں</span><span className="en">Listen</span></button>
        <div className="hero-steps ornament relative" style={{ color: "#f6c66f" }}>✦</div>
        <div className="hero-steps relative grid grid-cols-3 gap-2 sm:gap-3">
          {HOW.map((h, i) => (
            <div key={h.en} className="hero-step space-y-1">
              <div className="eyebrow">{i + 1}</div>
              <div className="text-3xl">{h.icon}</div>
              <div className="ur text-sm font-semibold" style={{ whiteSpace: "normal", lineHeight: 1.9 }}>{h.ur}</div>
              <div className="en text-xs">{h.en}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {expired && (
          <div className="card card-soft text-center" role="status">
            <span className="ur block">حفاظت کے لیے آپ کو لاگ آؤٹ کر دیا گیا۔ دوبارہ لاگ اِن کریں۔</span>
            <span className="en block text-sm">For your safety you were logged out after 10 minutes without activity. Please log in again.</span>
          </div>
        )}
        {view === "pensioner" && <PensionerLogin onBack={() => open("choose")} />}

        {view === "choose" && (
          <>
            <Option
              variant="hero"
              icon="👵🏽"
              ur="میں پنشنر ہوں"
              en="I get a pension"
              hintUr="کچھ لکھنا نہیں۔ پنشن بک اور چہرہ دکھائیں۔"
              hintEn="No typing. Show your pension book, then your face."
              info={{ en: "For widows and retired people who receive a pension. You log in by showing the QR in your pension book and looking at the camera. Nothing to read or type.", ur: "پنشن لینے والوں کے لیے۔ پنشن بک کا کیو آر دکھائیں اور کیمرے میں دیکھیں، بس۔ کچھ پڑھنا یا لکھنا نہیں۔" }}
              say="میں پنشنر ہوں۔"
              onClick={openPensioner}
            />

            <VoiceCommand
              promptUr="بولیں: پنشن، مددگار، یا دکان۔"
              promptEn='Say "pension", "helper" or "shop".'
              commands={[
                { id: "pension", words: ["پنشن", "پینشن", "پنشنر", "بیوہ", "pension", "widow"], confirmUr: "ٹھیک ہے۔", confirmEn: "Okay.", run: openPensioner },
                { id: "helper", words: ["مددگار", "مدد", "helper", "madadgar"], confirmUr: "مددگار لاگ اِن کھل رہا ہے۔", confirmEn: "Opening helper login.", run: () => open("helper") },
                { id: "shop", words: ["دکان", "دکاندار", "shop", "dukan", "dukaan"], confirmUr: "دکاندار لاگ اِن کھل رہا ہے۔", confirmEn: "Opening shopkeeper login.", run: () => open("shopkeeper") },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Option
                icon="🤝"
                tone="indigo"
                ur="میں مددگار ہوں"
                en="I help families"
                info={{ en: "For social workers and relatives who help several pensioners from one phone. Each family must give permission first.", ur: "سماجی کارکن یا رشتہ دار جو ایک فون سے کئی خاندانوں کی مدد کرتے ہیں۔ ہر خاندان کی اجازت ضروری ہے۔" }}
                onClick={() => open("helper")}
              />
              <Option
                icon="🏪"
                tone="marigold"
                ur="میں دکاندار ہوں"
                en="I run a shop"
                info={{ en: "For shopkeepers and mobile-wallet agents. Check if a 'pension' or 'relief payment' message is a scam before anyone pays.", ur: "دکاندار اور موبائل والیٹ ایجنٹ۔ پیسے دینے سے پہلے جانچیں کہ پنشن یا امداد کا پیغام دھوکہ تو نہیں۔" }}
                onClick={() => open("shopkeeper")}
              />
            </div>

            <Option
              variant="compact"
              icon="🏛️"
              tone="slate"
              ur="پنشن آفس عملہ"
              en="Pension office staff"
              info={{ en: "For pension officers, admins and auditors. Officers review difficult cases; admins change rules; auditors read the full log.", ur: "پنشن افسر، ایڈمن اور آڈیٹر کے لیے۔" }}
              onClick={() => open("staff")}
            />
          </>
        )}

        {view !== "choose" && view !== "pensioner" && (
          <form className="card space-y-5" style={{ padding: 22 }} onSubmit={(e) => { e.preventDefault(); login(); }}>
            <div className="flex items-center justify-between">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => open("choose")}>← <span className="en">Back</span><span className="ur">واپس</span></button>
              <span className="text-4xl">{FORM_TITLE[view].icon}</span>
            </div>
            <div>
              <h2 className="en text-2xl font-bold">{FORM_TITLE[view].en}</h2>
              <p className="ur text-xl">{FORM_TITLE[view].ur}</p>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-semibold"><span className="en">Phone number</span> <span className="ur muted">فون نمبر</span></span>
              <input className="input" inputMode="tel" placeholder="03XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold"><span className="en">Password</span> <span className="ur muted">پاس ورڈ</span></span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="btn w-full" disabled={busy}>{busy ? "…" : <><span className="en">Log in</span><span className="ur">لاگ اِن</span></>}</button>
          </form>
        )}

        {SHOW_TEST_LOGINS && view === "choose" && (
          <details className="card card-soft" data-no-voice>
            <summary className="cursor-pointer font-semibold">🧪 Test logins (one tap)</summary>
            <p className="muted text-sm mt-2">For testing only. Pensioners here skip the pension book and face steps.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {TEST_LOGINS.map((d) => (
                <button key={d.phone} type="button" className="btn btn-ghost btn-sm justify-start" disabled={busy} onClick={() => login(d.phone, d.pw)}>
                  <span className="text-lg">{d.icon}</span>
                  <span className="text-left text-sm leading-tight"><b>{d.label}</b><br /><span className="muted text-xs">{d.role}</span></span>
                </button>
              ))}
            </div>
          </details>
        )}

        {error && view === "choose" && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>
    </div>
  );
}
