"use client";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import PensionerLogin from "@/components/PensionerLogin";
import RegisterForm from "@/components/RegisterForm";
import HeroScene from "@/components/HeroScene";
import VoiceCommand from "@/components/ui/VoiceCommand";
import { speakUrdu } from "@/lib/client/voice";
import { setPrefsRole, voiceOn } from "@/lib/client/prefs";

// Front page. Urdu first, one big picture button per kind of person, each with an ⓘ that explains it.
// Pensioners never type: they log in with their pension book QR + face (or a PIN they can say or tap).
// Helpers, shopkeepers and staff can read, so they use phone + password.

type View = "choose" | "pensioner" | "helper" | "shopkeeper" | "staff" | "register";

const GREETING = "زندہ ہوں میں خوش آمدید۔ اگر آپ پنشن لیتی ہیں تو سب سے بڑا سبز بٹن دبائیں، یا مائیک دبا کر بولیں۔";

const GREETING_EN = "Welcome to Zinda Hon. If you receive a pension, press the big green button, or press the mic and speak.";

const FORM_TITLE: Record<Exclude<View, "choose" | "pensioner" | "register">, { en: string; ur: string; icon: string }> = {
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
  { icon: "🧑‍💼", label: "Uzma Khan", role: "Officer, Karachi (2nd check)", phone: "03000000013", pw: "Uzma@Check2" },
  { icon: "🧑‍💼", label: "Naveed Memon", role: "Officer, Hyderabad", phone: "03003108847", pw: "Naveed!Hyd52" },
  { icon: "⚙️", label: "Kamran Siddiqui", role: "Admin", phone: "03452876104", pw: "Kamran$Admin9" },
  { icon: "⚙️", label: "Hira Farooq", role: "Admin (2nd approver)", phone: "03000000012", pw: "Hira@Rules5" },
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

const HOW_MORE = [
  "Hold the QR code inside your pension book up to the camera. It is signed by the office, so a changed book is caught.",
  "Blink and turn your head when asked. Only 128 numbers about your face leave the phone, never the photo.",
  "If everything matches, you are approved at once. If not, a pension officer looks. The computer never stops a pension.",
];

export default function LoginPage() {
  const [view, setView] = useState<View>("choose");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => { setExpired(new URLSearchParams(window.location.search).has("expired")); }, []);
  // Say hello out loud when the front page opens (or at the first tap, if the browser blocks sound).
  useEffect(() => {
    setPrefsRole("guest");
    if (!voiceOn()) return;
    const t = setTimeout(() => void speakUrdu(GREETING, GREETING_EN), 700);
    return () => clearTimeout(t);
  }, []);

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
    if (v === "helper" || v === "shopkeeper" || v === "staff") void speakUrdu("اپنا فون نمبر اور پاس ورڈ لکھیں، پھر لاگ اِن کا بٹن دبائیں۔", "Enter your phone number and password, then press Log in.");
    if (v === "register") setTimeout(() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    else document.getElementById("start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openPensioner() {
    setPrefsRole("PENSIONER");
    open("pensioner");
    void speakUrdu("اپنی پنشن بک کھولیں اور اس کا کیو آر کوڈ کیمرے کے سامنے رکھیں۔", "Open your pension book and hold its QR code in front of the camera.");
  }

  const groups = [
    { title: "Pensioners", items: TEST_LOGINS.filter((d) => d.role === "Pensioner") },
    { title: "Pension office", items: TEST_LOGINS.filter((d) => /Officer|Admin|Auditor/.test(d.role)) },
    { title: "Helpers and shops", items: TEST_LOGINS.filter((d) => /Helper|Shopkeeper/.test(d.role)) },
  ];

  return (
    <>
      <section className="hero-full">
        <HeroScene />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-inner">
          <nav className="hero-nav" aria-label="Main">
            <span className="flex items-center gap-3">
              <Logo size={38} />
              <span className="leading-tight"><span className="brand-word text-lg block">Zinda Hon</span><span className="ur always text-sm" style={{ lineHeight: 1.5, color: "#f6c66f" }}>زندہ ہوں</span></span>
            </span>
            <span className="hero-links">
              <a href="#how">How it works</a>
              <button type="button" onClick={() => open("helper")}>Helpers</button>
              <button type="button" onClick={() => open("shopkeeper")}>Shops</button>
              <button type="button" onClick={() => open("staff")}>Staff login</button>
            </span>
          </nav>

          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-eyebrow">✦ Pension proof-of-life · Prototype</span>
              <p className="ur hero-ur">سال میں ایک بار، گھر بیٹھے ثبوتِ حیات</p>
              <h1 className="hero-title">Prove you are alive,<br />from <em>your own</em> home.</h1>
              <p className="en hero-sub">Once a year, widows and retired people keep their pension going with a pension book and a smile at the camera. No forms, no queues, no fingerprints.</p>
              <div className="flex flex-wrap gap-3 mt-6">
                <button className="btn btn-accent btn-hero hero-cta-main" data-say="میں پنشنر ہوں۔" data-say-en="I get a pension" onClick={openPensioner}>👵🏽 <span className="en">I get a pension</span><span className="ur">میں پنشنر ہوں</span></button>
                <button className="btn glass-btn btn-hero" data-no-voice onClick={() => speakUrdu(GREETING, GREETING_EN)}>🔊 <span className="en">Listen</span><span className="ur">سنیں</span></button>
              </div>
              <div className="hero-chips">
                <span>📖 Pension book QR</span><span>🙂 Face + blink</span><span>📶 Works offline</span><span>🔊 Urdu voice</span>
              </div>
            </div>

            <div className="hero-card" id="start">
              {expired && (
                <div className="hero-card-alert" role="status">
                  <span className="ur block">حفاظت کے لیے آپ کو لاگ آؤٹ کر دیا گیا۔</span>
                  <span className="en block text-sm">For your safety you were logged out after 10 minutes without activity.</span>
                </div>
              )}
              <div className="hero-card-head">
                <span className="hero-card-avatar"><Logo size={34} /></span>
                <span className="flex-1 min-w-0">
                  <b className="block">{view === "choose" ? <><span className="en">Who are you?</span> <span className="ur">آپ کون ہیں؟</span></> : view === "pensioner" ? <><span className="en">Pensioner login</span> <span className="ur">پنشنر لاگ اِن</span></> : view === "register" ? <><span className="en">Create account</span> <span className="ur">نیا اکاؤنٹ</span></> : <><span className="en">{FORM_TITLE[view].en}</span> <span className="ur">{FORM_TITLE[view].ur}</span></>}</b>
                  <span className="text-xs muted"><span className="live-dot" /> Online · tap or speak</span>
                </span>
                {view !== "choose" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => open("choose")}>← <span className="en">Back</span><span className="ur">واپس</span></button>}
              </div>

              <div className="hero-card-body">
                {view === "pensioner" && <PensionerLogin onBack={() => open("choose")} />}
                {view === "register" && (
                  <div className="space-y-3">
                    <div className="bubble"><span className="en">The sign-up form is open below. Scroll down, or press the button.</span> <span className="ur">فارم نیچے کھل گیا ہے۔</span></div>
                    <button type="button" className="btn w-full" data-say="فارم پر جائیں" data-say-en="Go to the form" onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "start" })}>↓ <span className="en">Go to the form</span><span className="ur">فارم پر جائیں</span></button>
                  </div>
                )}

                {view === "choose" && (
                  <>
                    <div className="bubble"><span className="en">Welcome! Tap who you are, or press the mic and say it.</span> <span className="ur">خوش آمدید! بتائیں آپ کون ہیں، یا مائیک دبا کر بولیں۔</span></div>
                    <button className="choice-main" data-say="میں پنشنر ہوں۔" data-say-en="I get a pension" onClick={openPensioner}>
                      <span className="choice-ic">👵🏽</span>
                      <span className="flex-1 text-left"><span className="ur block text-xl" style={{ lineHeight: 1.8 }}>میں پنشنر ہوں</span><span className="en block font-bold">I get a pension</span><span className="block text-xs" style={{ opacity: .85 }}>No typing. Show your pension book, then your face.</span></span>
                      <span aria-hidden>→</span>
                    </button>
                    <div className="choice-row">
                      <button className="choice-pill" data-say="میں مددگار ہوں" data-say-en="I help families" onClick={() => open("helper")}>🤝 <span className="en">I help families</span><span className="ur">مددگار</span></button>
                      <button className="choice-pill" data-say="میں دکاندار ہوں" data-say-en="I run a shop" onClick={() => open("shopkeeper")}>🏪 <span className="en">I run a shop</span><span className="ur">دکاندار</span></button>
                      <button className="choice-pill" data-say="پنشن آفس عملہ" data-say-en="Pension office staff" onClick={() => open("staff")}>🏛️ <span className="en">Pension office</span><span className="ur">عملہ</span></button>
                    </div>
                    <button type="button" className="reg-link" data-say="نیا اکاؤنٹ بنائیں" data-say-en="Create a new account" onClick={() => open("register")}>✨ <span className="en">New here? <b>Create an account</b></span><span className="ur">نئے ہیں؟ اکاؤنٹ بنائیں</span></button>
                    <div className="hero-card-mic">
                      <VoiceCommand
                        promptUr="بولیں: پنشن، مددگار، یا دکان۔"
                        promptEn='Say "pension", "helper" or "shop".'
                        commands={[
                          { id: "pension", words: ["پنشن", "پینشن", "پنشنر", "بیوہ", "pension", "widow"], confirmUr: "ٹھیک ہے۔", confirmEn: "Okay.", run: openPensioner },
                          { id: "helper", words: ["مددگار", "مدد", "helper", "madadgar"], confirmUr: "مددگار لاگ اِن کھل رہا ہے۔", confirmEn: "Opening helper login.", run: () => open("helper") },
                          { id: "shop", words: ["دکان", "دکاندار", "shop", "dukan", "dukaan"], confirmUr: "دکاندار لاگ اِن کھل رہا ہے۔", confirmEn: "Opening shopkeeper login.", run: () => open("shopkeeper") },
                        ]}
                      />
                    </div>
                    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
                  </>
                )}

                {view !== "choose" && view !== "pensioner" && view !== "register" && (
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login(); }}>
                    <label className="block space-y-1">
                      <span className="text-sm font-semibold" data-say="اپنا فون نمبر لکھیں" data-say-en="Type your phone number"><span className="en">Phone number</span> <span className="ur muted">فون نمبر</span></span>
                      <input className="input" inputMode="tel" placeholder="03XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username" />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-semibold" data-say="اپنا پاس ورڈ لکھیں" data-say-en="Type your password"><span className="en">Password</span> <span className="ur muted">پاس ورڈ</span></span>
                      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                    </label>
                    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
                    <button className="btn w-full" disabled={busy} data-say="لاگ اِن کریں" data-say-en="Log in">{busy ? "…" : <><span className="en">Log in</span><span className="ur">لاگ اِن</span></>}</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {view === "register" && (
        <section id="signup" className="signup-sec">
          <div className="signup-wrap">
            <div className="signup-head">
              <div>
                <p className="eyebrow">✨ <span className="en">New here</span> <span className="ur">نئے ہیں؟</span></p>
                <h2><span className="en">Create your account</span> <span className="ur">اپنا اکاؤنٹ بنائیں</span></h2>
                <p className="muted"><span className="en">Fill this once. A pension officer checks it against the records, then your account opens.</span> <span className="ur">ایک بار فارم بھریں۔ پنشن افسر ریکارڈ سے ملا کر اکاؤنٹ کھولے گا۔</span></p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => open("choose")}>✕ <span className="en">Close</span><span className="ur">بند کریں</span></button>
            </div>
            <RegisterForm onDone={() => open("choose")} />
          </div>
        </section>
      )}

      <section id="how" className="how">
        <p className="eyebrow text-center">How it works · یہ کیسے کام کرتا ہے</p>
        <h2 className="text-center text-3xl md:text-4xl mt-1">Three steps, about two minutes</h2>
        <div className="how-grid">
          {HOW.map((h, i) => (
            <div key={h.en} className="how-step">
              <span className="how-n">{i + 1}</span>
              <div className="text-4xl">{h.icon}</div>
              <div className="ur text-lg font-semibold" style={{ lineHeight: 1.9 }}>{h.ur}</div>
              <div className="en font-semibold">{h.en}</div>
              <p className="text-sm muted">{HOW_MORE[i]}</p>
            </div>
          ))}
        </div>
      </section>

      {SHOW_TEST_LOGINS && view === "choose" && (
        <details className="card tl" data-no-voice>
          <summary className="tl-sum"><span>🧪 Test logins <span className="muted font-normal text-sm">· one tap, for judges and testing</span></span><span className="tl-chev" aria-hidden>▾</span></summary>
          <p className="muted text-xs mt-1">Pensioners here skip the pension book and face steps.</p>
          {groups.map((g) => (
            <div key={g.title} className="mt-4">
              <p className="eyebrow mb-2">{g.title}</p>
              <div className="tl-grid">
                {g.items.map((d) => (
                  <button key={d.phone} type="button" className="tl-btn" disabled={busy} onClick={() => login(d.phone, d.pw)}>
                    <span className="tl-ic">{d.icon}</span>
                    <span className="min-w-0"><span className="tl-name">{d.label}</span><span className="tl-role">{d.role}</span></span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
