"use client";
import Icon from "@/components/ui/Icon";
import SayButton from "@/components/ui/SayButton";
import Faq from "@/components/Faq";
import { formatPhone, checkPhone } from "@/lib/client/idcheck";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import PensionerLogin from "@/components/PensionerLogin";
import RegisterForm from "@/components/RegisterForm";
import VoiceCommand from "@/components/ui/VoiceCommand";
import { speakUrdu } from "@/lib/client/voice";
import { setPrefsRole, voiceOn } from "@/lib/client/prefs";

// Front page. Urdu first, one big picture button per kind of person, each with an ⓘ that explains it.
// Pensioners never type: they log in with their pension book QR + face (or a PIN they can say or tap).
// Helpers, shopkeepers and staff can read, so they use phone + password.

type View = "choose" | "pensioner" | "helper" | "shopkeeper" | "staff" | "register";

const GREETING = "زندہ ہوں میں خوش آمدید۔ اگر آپ پنشن لیتی ہیں تو سب سے بڑا نیلا بٹن دبائیں، یا مائیک دبا کر بولیں۔";

const GREETING_EN = "Welcome to Zinda Hon. If you receive a pension, press the big blue button, or press the mic and speak.";

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

const HOW_MORE_UR = [
  "پنشن بک کے اندر والا کیو آر کوڈ کیمرے کے سامنے رکھیں۔ اس پر آفس کی مہر ہے، اس لیے بدلی ہوئی کتاب پکڑی جاتی ہے۔",
  "کہنے پر آنکھ جھپکیں اور سر گھمائیں۔ فون سے صرف چہرے کے نمبر جاتے ہیں، تصویر کبھی نہیں۔",
  "سب ٹھیک ہو تو فوراً منظوری۔ ورنہ پنشن افسر دیکھتا ہے۔ کمپیوٹر کبھی پنشن نہیں روکتا۔",
];

const SIGNUP_FAQ = [
  { q: "Why do you need my CNIC number?", qUr: "شناختی کارڈ نمبر کیوں چاہیے؟", a: "To match you with the NADRA and pension records, so no one else can open an account in your name. A CNIC has 13 digits, written 00000-0000000-0. In this demo only mock CNICs starting with 00000 are accepted.", aUr: "تاکہ آپ کو نادرا اور پنشن ریکارڈ سے ملایا جا سکے اور کوئی اور آپ کے نام پر اکاؤنٹ نہ کھول سکے۔ شناختی کارڈ میں 13 ہندسے ہوتے ہیں۔" },
  { q: "Which phone number should I give?", qUr: "کون سا فون نمبر دوں؟", a: "Your own mobile number: 11 digits, starting with 03. You will log in with it and get messages on it. In this demo only mock numbers starting 0300000 are accepted.", aUr: "اپنا موبائل نمبر: 11 ہندسے، جو 03 سے شروع ہو۔ اسی سے لاگ اِن ہوگا اور اسی پر پیغام آئیں گے۔" },
  { q: "I am a widow. What do I need?", qUr: "میں بیوہ ہوں۔ مجھے کیا چاہیے؟", a: "Your late husband's full name, his CNIC number if you know it, the date he passed away and the death certificate number if you have it. The office checks these against the death registry.", aUr: "مرحوم شوہر کا پورا نام، اگر یاد ہو تو ان کا شناختی کارڈ نمبر، وفات کی تاریخ اور اگر ہو تو ڈیتھ سرٹیفکیٹ نمبر۔ آفس یہ وفات کے ریکارڈ سے ملاتا ہے۔" },
  { q: "I cannot fill the form myself.", qUr: "میں خود فارم نہیں بھر سکتی۔", a: "Press \"Fill the form by voice\" and answer by speaking, or let a family member fill it: tick \"Someone is helping me\" and add their name and phone. An officer then checks the form with extra care.", aUr: "آواز سے فارم بھریں والا بٹن دبائیں اور بول کر جواب دیں، یا گھر کا کوئی فرد بھر دے۔ اس صورت میں مدد کرنے والے کا نام اور فون لکھیں۔ افسر ایسا فارم زیادہ دھیان سے دیکھتا ہے۔" },
  { q: "Do I need a password?", qUr: "کیا پاس ورڈ ضروری ہے؟", a: "Pensioners can choose a 4-digit PIN instead. Never tell your PIN to anyone; the pension office never asks for it.", aUr: "پنشنر پاس ورڈ کی جگہ چار ہندسوں کا پن رکھ سکتے ہیں۔ اپنا پن کبھی کسی کو نہ بتائیں، پنشن آفس کبھی نہیں مانگتا۔" },
  { q: "What happens after I press Send?", qUr: "بھیجنے کے بعد کیا ہوگا؟", a: "A pension officer checks your details against the records. When it is approved your account opens and you can log in. If something does not match, the officer will tell you what to fix.", aUr: "پنشن افسر آپ کی معلومات ریکارڈ سے ملاتا ہے۔ منظوری کے بعد آپ کا اکاؤنٹ کھل جاتا ہے۔ اگر کچھ نہ ملے تو افسر بتائے گا کہ کیا درست کرنا ہے۔" },
];

const WHO = [
  { icon: "user" as const, en: "Pensioners and widows", ur: "پنشنر اور بیوائیں", text: "Prove you are alive once a year from home, by voice in Urdu, without reading or typing.", textUr: "سال میں ایک بار گھر بیٹھے ثبوتِ حیات دیں، اردو میں بول کر، پڑھنے یا لکھنے کے بغیر۔" },
  { icon: "users" as const, en: "Helpers and family", ur: "مددگار اور گھر والے", text: "One phone, many families. Act only for those who gave permission; everything is recorded.", textUr: "ایک فون، کئی خاندان۔ صرف ان کے لیے کام کریں جنہوں نے اجازت دی ہے۔ ہر کام ریکارڈ ہوتا ہے۔" },
  { icon: "store" as const, en: "Local shops", ur: "محلے کی دکان", text: "A trusted shop counter can help an elderly person do the check, with the shop on record.", textUr: "محلے کی بھروسے والی دکان بزرگوں کی جانچ میں مدد کر سکتی ہے، اور دکان کا نام ریکارڈ ہوتا ہے۔" },
  { icon: "building" as const, en: "Pension office", ur: "پنشن آفس", text: "Officers see only the hard cases, sorted by risk, with every check and its reason laid out.", textUr: "افسر صرف مشکل کیس دیکھتے ہیں، خطرے کے حساب سے ترتیب میں، ہر جانچ اور اس کی وجہ کے ساتھ۔" },
];

const TRUST = [
  { icon: "user" as const, en: "An officer decides the hard cases", text: "If anything looks wrong, a trained pension officer checks it. Only an officer can stop a pension, and must write why.", ur: "اگر کچھ غلط لگے تو تربیت یافتہ پنشن افسر خود دیکھتا ہے۔ پنشن صرف افسر روک سکتا ہے، اور اسے وجہ لکھنی ہوتی ہے۔" },
  { icon: "lock" as const, en: "Your data, your permission", text: "See who can see your information and take permission back at any time. Only numbers describing your face are kept, never the photo.", ur: "دیکھیں کون آپ کی معلومات دیکھ سکتا ہے، اور کسی بھی وقت اجازت واپس لیں۔ صرف چہرے کے نمبر رکھے جاتے ہیں، تصویر کبھی نہیں۔" },
  { icon: "wifi" as const, en: "Works without internet", text: "Every step is saved on the phone and sent when the signal returns. Urdu voice guides those who cannot read.", ur: "ہر قدم فون پر محفوظ ہوتا ہے اور سگنل آنے پر بھیج دیا جاتا ہے۔ اردو آواز ان کی رہنمائی کرتی ہے جو پڑھ نہیں سکتے۔" },
];

const FAQ = [
  { q: "What if I cannot read or write?", qUr: "اگر میں پڑھ لکھ نہیں سکتی تو؟", a: "Turn on Voice at the top. Every button speaks in Urdu, and you can answer by speaking. A helper or a local shop can also do it with you.", aUr: "اوپر آواز کا بٹن چالو کریں۔ ہر بٹن اردو میں بولتا ہے، اور آپ بول کر جواب دے سکتی ہیں۔ کوئی مددگار یا محلے کی دکان بھی آپ کے ساتھ یہ کر سکتی ہے۔" },
  { q: "Do I have to go to the pension office?", qUr: "کیا مجھے پنشن آفس جانا ہوگا؟", a: "No. With your permission, your face is matched to your CNIC photo (simulated NADRA in this prototype). Only if that photo is missing does an officer enrol you, at the office or on a home visit.", aUr: "نہیں۔ آپ کی اجازت سے آپ کا چہرہ شناختی کارڈ کی تصویر سے ملایا جاتا ہے۔ اگر تصویر نہ ملے تو افسر آفس میں یا گھر آ کر چہرہ رجسٹر کرتا ہے۔" },
  { q: "Can the computer stop my pension?", qUr: "کیا کمپیوٹر میری پنشن روک سکتا ہے؟", a: "Never. If something looks wrong, a pension officer checks your case. Only an officer can stop a pension, and must write the reason, which you can see.", aUr: "کبھی نہیں۔ کچھ غلط لگے تو پنشن افسر آپ کا کیس دیکھتا ہے۔ پنشن صرف افسر روک سکتا ہے، اور اسے وجہ لکھنی ہوتی ہے جو آپ دیکھ سکتی ہیں۔" },
  { q: "Who can see my information?", qUr: "میری معلومات کون دیکھ سکتا ہے؟", a: "Only the pension office, and helpers you allow. Open \"My data\" to see who has access and take permission back at any time.", aUr: "صرف پنشن آفس، اور وہ مددگار جنہیں آپ اجازت دیں۔ میری معلومات کھول کر دیکھیں اور کسی بھی وقت اجازت واپس لیں۔" },
  { q: "What if there is no internet?", qUr: "اگر انٹرنیٹ نہ ہو تو؟", a: "Each step is saved on the phone and sent automatically when the signal returns.", aUr: "ہر قدم فون پر محفوظ ہو جاتا ہے اور سگنل آنے پر خود بھیج دیا جاتا ہے۔" },
  { q: "Someone called asking for my PIN. Is it real?", qUr: "کسی نے فون کر کے میرا پن مانگا۔ کیا یہ اصلی ہے؟", a: "No. The pension office never asks for a PIN, OTP or fee. Use \"Check a message\" to test any SMS or WhatsApp you receive.", aUr: "نہیں۔ پنشن آفس کبھی پن، کوڈ یا فیس نہیں مانگتا۔ کوئی بھی پیغام آئے تو پیغام جانچیں والا بٹن استعمال کریں۔" },
];


export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("choose");
  const [opening, setOpening] = useState<string | null>(null);
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
    setOpening(p);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: p, password: pw }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      // In-app navigation: no full page reload, the app's code is already loaded.
      router.push(data.home);
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Check your connection.");
    }
    setBusy(false);
    setOpening(null);
  }

  function open(v: View) {
    if (v !== "pensioner") setPrefsRole("guest");
    setError(null);
    setView(v);
    if (v === "helper" || v === "shopkeeper" || v === "staff") void speakUrdu("اپنا فون نمبر اور پاس ورڈ لکھیں، پھر لاگ اِن کا بٹن دبائیں۔", "Enter your phone number and password, then press Log in.");
    if (v === "register") setTimeout(() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    else document.getElementById("start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Footer and menu link "/login#signup" opens the sign-up form directly.
  useEffect(() => {
    if (window.location.hash === "#signup") open("register");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-inner">
          <nav className="hero-nav" aria-label="Main">
            <span className="flex items-center gap-3">
              <Logo size={38} />
              <span className="leading-tight"><span className="brand-word text-lg block">Zinda Hon</span><span className="ur always text-sm" style={{ lineHeight: 1.5, color: "var(--hero-gold)" }}>زندہ ہوں</span></span>
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
              <span className="hero-eyebrow">Pension proof-of-life · Prototype</span>
              <p className="ur hero-ur">سال میں ایک بار، گھر بیٹھے ثبوتِ حیات</p>
              <h1 className="hero-title">Prove you are alive,<br />from <em>your own</em> home.</h1>
              <p className="en hero-sub">Once a year, widows and retired people keep their pension going with a pension book and a smile at the camera. No forms, no queues, no fingerprints.</p>
              <div className="flex flex-wrap gap-3 mt-6">
                <button className="btn btn-accent btn-hero hero-cta-main" data-say="میں پنشنر ہوں۔" data-say-en="I get a pension" onClick={openPensioner}><span className="en">I get a pension</span><span className="ur">میں پنشنر ہوں</span></button>
                <button className="btn glass-btn btn-hero" data-no-voice onClick={() => speakUrdu(GREETING, GREETING_EN)}><span className="en">Listen</span><span className="ur">سنیں</span></button>
              </div>
              <div className="hero-chips">
                <span>Pension book QR</span><span>Face + blink</span><span>Works offline</span><span>Urdu voice</span>
              </div>
            </div>

            <div className="hero-visual">
              <figure className="hero-photo" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hero-couple.jpg" alt="" width={1176} height={700} fetchPriority="high" />
              </figure>
            
            </div>
          </div>
        </div>
      </section>

      <section className="band signin-band" aria-label="Log in">
        <div className="signin-wrap">
          <div className="signin-copy">
            <p className="eyebrow">Start here · یہاں سے شروع کریں</p>
            <h2>Who are you?</h2>
            <p className="ur signin-ur">آپ کون ہیں؟ اپنا بٹن دبائیں یا مائیک دبا کر بولیں۔</p>
            <p className="muted">Pensioners log in with their pension book and face, no typing needed. Helpers, shops and pension office staff log in with their phone number and password.</p>
            <ul className="signin-points">
              <li>No forms for pensioners: show the book, look at the camera</li>
              <li>Urdu voice reads every button out loud</li>
              <li>New here? Create an account in a few minutes</li>
            </ul>
            <div className="signin-listen">
              <SayButton big ur="آپ کون ہیں؟ اگر آپ پنشن لیتی ہیں تو دائیں طرف والا بڑا نیلا بٹن دبائیں: میں پنشنر ہوں۔ کچھ لکھنا نہیں، صرف پنشن بک دکھائیں اور کیمرے میں دیکھیں۔ مددگار، دکاندار اور پنشن آفس کا عملہ اپنے بٹن دبائیں۔ نئے ہیں تو اکاؤنٹ بنائیں دبائیں۔ آپ نیچے مائیک دبا کر بول بھی سکتی ہیں۔" en="Who are you? If you get a pension, press the big blue button on the right: I get a pension. No typing, just show your pension book and look at the camera. Helpers, shopkeepers and pension office staff press their own button. New here? Press Create an account. You can also press the mic and speak." />
              <p className="muted text-sm"><span className="en">Turn on <b>Voice</b> at the top and every button you press will also speak.</span> <span className="ur">اوپر آواز کا بٹن چالو کریں تو ہر بٹن بولے گا۔</span></p>
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
                      <div className="bubble bubble-say"><span><span className="en">Welcome! Tap who you are, or press the mic and say it.</span> <span className="ur">خوش آمدید! بتائیں آپ کون ہیں، یا مائیک دبا کر بولیں۔</span></span><SayButton ur={GREETING} en={GREETING_EN} /></div>
                      <button className="choice-main" data-say="میں پنشنر ہوں۔" data-say-en="I get a pension" onClick={openPensioner}>
                        <span className="choice-ic"><Icon name="user" size={28} /></span>
                        <span className="flex-1 text-left"><span className="ur block text-xl" style={{ lineHeight: 1.8 }}>میں پنشنر ہوں</span><span className="en block font-bold">I get a pension</span><span className="block text-xs" style={{ opacity: .85 }}>No typing. Show your pension book, then your face.</span></span>
                        <span aria-hidden>→</span>
                      </button>
                      <div className="choice-row">
                        <button className="choice-pill" data-say="میں مددگار ہوں" data-say-en="I help families" onClick={() => open("helper")}><span className="en">I help families</span><span className="ur">مددگار</span></button>
                        <button className="choice-pill" data-say="میں دکاندار ہوں" data-say-en="I run a shop" onClick={() => open("shopkeeper")}><span className="en">I run a shop</span><span className="ur">دکاندار</span></button>
                        <button className="choice-pill" data-say="پنشن آفس عملہ" data-say-en="Pension office staff" onClick={() => open("staff")}><span className="en">Pension office</span><span className="ur">عملہ</span></button>
                      </div>
                      <button type="button" className="reg-link" data-say="نیا اکاؤنٹ بنائیں" data-say-en="Create a new account" onClick={() => open("register")}><span className="en">New here? <b>Create an account</b></span><span className="ur">نئے ہیں؟ اکاؤنٹ بنائیں</span></button>
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
                        <input className="input" inputMode="tel" placeholder="03XXXXXXXXX" value={phone} maxLength={11} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="username" aria-describedby="chk-login-phone" />
                        {phone && (() => { const c = checkPhone(phone); return c && <span id="chk-login-phone" className={`field-check ${c.ok ? "ok" : "bad"}`} aria-live="polite"><Icon name={c.ok ? "check" : "alert"} size={15} /> <span className="en">{c.en}</span> <span className="ur">{c.ur}</span></span>; })()}
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
      </section>

      {view === "register" && (
        <section id="signup" className="signup-sec">
          <div className="signup-wrap">
            <div className="signup-head">
              <div>
                <p className="eyebrow"><span className="en">New here</span> <span className="ur">نئے ہیں؟</span></p>
                <h2><span className="en">Create your account</span> <span className="ur">اپنا اکاؤنٹ بنائیں</span></h2>
                <p className="muted"><span className="en">Fill this once. A pension officer checks it against the records, then your account opens.</span> <span className="ur">ایک بار فارم بھریں۔ پنشن افسر ریکارڈ سے ملا کر اکاؤنٹ کھولے گا۔</span></p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => open("choose")}>✕ <span className="en">Close</span><span className="ur">بند کریں</span></button>
            </div>
            <RegisterForm onDone={() => open("choose")} />
            <div className="signup-faq">
              <h3><span className="en">Questions about signing up</span> <span className="ur">اکاؤنٹ بنانے کے بارے میں سوالات</span></h3>
              <p className="muted text-sm"><span className="en">Press Listen to hear a question and its answer.</span> <span className="ur">سوال اور جواب سننے کے لیے سنیں دبائیں۔</span></p>
              <Faq items={SIGNUP_FAQ} />
            </div>
          </div>
        </section>
      )}

      <section className="gov-figures band-top" aria-label="At a glance">
        <div><b>3</b><span className="en">steps a year</span><span className="ur">قدم، سال میں ایک بار</span></div>
        <div><b>~2 min</b><span className="en">from your own home</span><span className="ur">گھر بیٹھے</span></div>
        <div><b>0</b><span className="en">office visits needed</span><span className="ur">آفس جانے کی ضرورت نہیں</span></div>
        <div><b>اردو</b><span className="en">voice on every page</span><span className="ur">ہر صفحے پر آواز</span></div>
      </section>

      <section id="services" className="gov-services band band-tint">
        <p className="eyebrow">Online services · آن لائن خدمات</p>
        <h2>What would you like to do?</h2>
        <div className="gov-svc-grid">
          {[
            { icon: "user" as const, en: "Prove I am alive", ur: "ثبوتِ حیات دیں", hint: "Face check and pension book, from home", hintUr: "چہرے کی جانچ اور پنشن بک، گھر بیٹھے", go: openPensioner },
            { icon: "doc" as const, en: "Create an account", ur: "اکاؤنٹ بنائیں", hint: "For widows, helpers and shops", hintUr: "بیواؤں، مددگاروں اور دکانداروں کے لیے", go: () => open("register") },
            { icon: "users" as const, en: "Helper log in", ur: "مددگار لاگ اِن", hint: "Act for families who gave permission", hintUr: "ان خاندانوں کے لیے کام کریں جنہوں نے اجازت دی", go: () => open("helper") },
            { icon: "store" as const, en: "Shop counter", ur: "دکان", hint: "Assisted proof of life at a local shop", hintUr: "محلے کی دکان پر مدد کے ساتھ ثبوتِ حیات", go: () => open("shopkeeper") },
            { icon: "shield" as const, en: "Is this message a scam?", ur: "کیا یہ پیغام دھوکہ ہے؟", hint: "Check an SMS or WhatsApp before you reply", hintUr: "جواب دینے سے پہلے پیغام جانچیں", go: () => router.push("/check-message") },
            { icon: "building" as const, en: "Staff log in", ur: "عملہ لاگ اِن", hint: "Officers, administrators and auditors", hintUr: "افسر، ایڈمن اور آڈیٹر", go: () => open("staff") },
          ].map((c) => (
            <div key={c.en} className="card-wrap">
              <button type="button" className="gov-svc" data-say={c.ur} data-say-en={c.en} onClick={c.go}>
                <span className="gov-svc-ic"><Icon name={c.icon} size={26} /></span>
                <b className="en">{c.en}</b><span className="ur">{c.ur}</span>
                <small className="en">{c.hint}</small><small className="ur">{c.hintUr}</small>
              </button>
              <SayButton ur={`${c.ur}۔ ${c.hintUr}۔`} en={`${c.en}. ${c.hint}.`} />
            </div>
          ))}
        </div>
      </section>

      <section className="band" aria-label="Who it is for">
        <p className="eyebrow">Who it is for · کس کے لیے</p>
        <h2>One service, four kinds of people</h2>
        <div className="who-grid">
          {WHO.map((w) => (
            <div key={w.en} className="who-card">
              <Icon name={w.icon} size={30} />
              <h3 className="en">{w.en}</h3><p className="ur who-ur">{w.ur}</p>
              <p className="en">{w.text}</p><p className="ur who-text-ur">{w.textUr}</p>
              <SayButton ur={`${w.ur}۔ ${w.textUr}`} en={`${w.en}. ${w.text}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="band band-green" aria-label="Why it is safe">
        <p className="eyebrow">Safe and fair · محفوظ اور منصفانہ</p>
        <h2>A computer never stops a pension</h2>
        <div className="trust-grid">
          {TRUST.map((t) => (
            <div key={t.en}>
              <Icon name={t.icon} size={34} />
              <h3 className="en">{t.en}</h3>
              <p className="en">{t.text}</p><p className="ur">{t.ur}</p>
              <SayButton light ur={t.ur} en={`${t.en}. ${t.text}`} />
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="how band">
        <p className="eyebrow text-center">How it works · یہ کیسے کام کرتا ہے</p>
        <h2 className="text-center text-3xl md:text-4xl mt-1">Three steps, about two minutes</h2>
        <div className="how-grid">
          {HOW.map((h, i) => (
            <div key={h.en} className="how-step">
              <span className="how-n">{i + 1}</span>
              <div className="how-ic"><Icon e={h.icon} size={30} /></div>
              <div className="ur text-lg font-semibold" style={{ lineHeight: 1.9 }}>{h.ur}</div>
              <div className="en font-semibold">{h.en}</div>
              <p className="text-sm muted en">{HOW_MORE[i]}</p>
              <p className="ur muted how-more-ur">{HOW_MORE_UR[i]}</p>
              <SayButton ur={`قدم ${i + 1}۔ ${h.ur}۔ ${HOW_MORE_UR[i]}`} en={`Step ${i + 1}. ${h.en}. ${HOW_MORE[i]}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="band band-tint" aria-label="Common questions">
        <p className="eyebrow">Common questions · عام سوالات</p>
        <h2>Questions people ask</h2>
        <Faq items={FAQ} />
      </section>

      {SHOW_TEST_LOGINS && view === "choose" && (
        <details className="card tl" data-no-voice>
          <summary className="tl-sum"><span>Test logins <span className="muted font-normal text-sm">· one tap, for judges and testing</span></span><span className="tl-chev" aria-hidden>▾</span></summary>
          <p className="muted text-xs mt-1">Pensioners here skip the pension book and face steps.</p>
          {groups.map((g) => (
            <div key={g.title} className="mt-4">
              <p className="eyebrow mb-2">{g.title}</p>
              <div className="tl-grid">
                {g.items.map((d) => (
                  <button key={d.phone} type="button" className="tl-btn" disabled={busy} onClick={() => login(d.phone, d.pw)}>
                    <span className="tl-ic"><Icon e={d.icon} size={18} /></span>
                    <span className="min-w-0"><span className="tl-name">{d.label}</span><span className="tl-role">{opening === d.phone ? "Opening…" : d.role}</span></span>
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
