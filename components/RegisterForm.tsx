"use client";
import { useEffect, useRef, useState } from "react";
import { speakUrdu, stopSpeaking, getVoiceChoice } from "@/lib/client/voice";
import { voiceOn, getLang } from "@/lib/client/prefs";
import { startListening, spokenDigits, LISTEN_ERROR, type Listening } from "@/lib/client/listen";

// Create account for new people. It only sends a REQUEST: a pension officer checks it against the
// (mock) NADRA, death and pension records before the account works. Only mock CNICs and phones.
// Made for people who cannot read: every question can be read aloud and answered by voice, one by one
// ("Fill by voice"), and a helper can fill it for her (and is recorded as having done so).

type Role = "PENSIONER" | "HELPER" | "SHOPKEEPER";
const ROLES: { id: Role; icon: string; en: string; ur: string }[] = [
  { id: "PENSIONER", icon: "👵🏽", en: "I get a pension", ur: "پنشنر" },
  { id: "HELPER", icon: "🤝", en: "I help families", ur: "مددگار" },
  { id: "SHOPKEEPER", icon: "🏪", en: "I run a shop", ur: "دکاندار" },
];

type Form = {
  tenantId: string; role: Role; pensionType: "family" | "self"; name: string; cnic: string; phone: string; dateOfBirth: string; area: string;
  pensionNo: string; password: string; pin: string;
  husbandName: string; husbandCnic: string; husbandDeathDate: string; deathCertNo: string;
  shopName: string; shopAddress: string;
  assisted: boolean; helperName: string; helperPhone: string; helperRelation: string;
};
type Key = keyof Form;
type Kind = "text" | "digits" | "date" | "pension" | "secret";

type Field = { key: Key; en: string; ur: string; askUr: string; askEn: string; kind: Kind; placeholder?: string; required?: boolean; optional?: boolean; voice?: boolean };

/** The questions, in the order they are asked. Which ones show depends on the role and pension type. */
function fieldsFor(f: Form): Field[] {
  const out: Field[] = [
    { key: "name", en: "Full name", ur: "پورا نام", askUr: "اپنا پورا نام بتائیں، جیسا شناختی کارڈ پر ہے۔", askEn: "Say your full name, as on your CNIC.", kind: "text", placeholder: "As on the CNIC", required: true },
    { key: "cnic", en: "Mock CNIC", ur: "شناختی کارڈ نمبر", askUr: "شناختی کارڈ کا نمبر ایک ایک ہندسہ کر کے بولیں۔", askEn: "Say the CNIC number, one digit at a time.", kind: "digits", placeholder: "00000-1234567-1", required: true },
    { key: "phone", en: "Mock phone", ur: "فون نمبر", askUr: "فون نمبر ایک ایک ہندسہ کر کے بولیں۔", askEn: "Say the phone number, one digit at a time.", kind: "digits", placeholder: "03000001234", required: true },
    { key: "dateOfBirth", en: "Date of birth", ur: "تاریخ پیدائش", askUr: "تاریخ پیدائش لکھیں، یا چھوڑ دیں۔", askEn: "Enter the date of birth, or leave it.", kind: "date", optional: true, voice: false },
    { key: "area", en: "Area", ur: "علاقہ", askUr: "آپ کس علاقے میں رہتی ہیں؟", askEn: "Which area do you live in?", kind: "text", placeholder: "e.g. Lyari", optional: true },
  ];
  if (f.role === "PENSIONER") {
    out.push({ key: "pensionNo", en: "Pension number", ur: "پنشن نمبر", askUr: "پنشن بک پر لکھا پنشن نمبر بولیں، صرف ہندسے۔", askEn: "Say the pension number from your pension book, just the digits.", kind: "pension", placeholder: "PEN-K-1002", required: true });
    if (f.pensionType === "family") out.push(
      { key: "husbandName", en: "Late husband's name", ur: "مرحوم شوہر کا نام", askUr: "اپنے مرحوم شوہر کا پورا نام بتائیں۔", askEn: "Say your late husband's full name.", kind: "text", placeholder: "As on his CNIC", required: true },
      { key: "husbandCnic", en: "Husband's mock CNIC", ur: "شوہر کا شناختی کارڈ", askUr: "اگر یاد ہو تو شوہر کا شناختی کارڈ نمبر بولیں۔", askEn: "If you know it, say your husband's CNIC number.", kind: "digits", placeholder: "00000-2000002-6", optional: true },
      { key: "husbandDeathDate", en: "Date he passed away", ur: "وفات کی تاریخ", askUr: "وفات کی تاریخ لکھیں، یا چھوڑ دیں۔", askEn: "Enter the date he passed away, or leave it.", kind: "date", optional: true, voice: false },
      { key: "deathCertNo", en: "Death certificate no.", ur: "ڈیتھ سرٹیفکیٹ نمبر", askUr: "اگر ڈیتھ سرٹیفکیٹ ہے تو اس کا نمبر بولیں۔", askEn: "If you have the death certificate, say its number.", kind: "text", placeholder: "e.g. UC-LYR-2018-0412 (mock)", optional: true },
    );
  }
  if (f.role === "SHOPKEEPER") out.push(
    { key: "shopName", en: "Shop name", ur: "دکان کا نام", askUr: "دکان کا نام بتائیں۔", askEn: "Say the name of your shop.", kind: "text", placeholder: "e.g. Baig General Store", required: true },
    { key: "shopAddress", en: "Shop address", ur: "دکان کا پتہ", askUr: "دکان کا پتہ بتائیں۔", askEn: "Say the shop's address.", kind: "text", placeholder: "Street, area", optional: true },
  );
  if (f.role === "PENSIONER") out.push({ key: "pin", en: "4-digit PIN", ur: "چار ہندسوں کا پن", askUr: "چار ہندسوں کا ایک پن سوچیں اور بولیں۔ یہ کسی کو نہ بتائیں۔", askEn: "Think of a 4-digit PIN and say it. Never tell it to anyone.", kind: "digits", placeholder: "••••", optional: Boolean(f.password) });
  out.push({ key: "password", en: f.role === "PENSIONER" ? "Password (or just the PIN)" : "Password", ur: "پاس ورڈ", askUr: "پاس ورڈ لکھیں۔", askEn: "Type a password.", kind: "secret", placeholder: "8 or more letters", required: f.role !== "PENSIONER", optional: f.role === "PENSIONER", voice: false });
  return out;
}

const HELPER_FIELDS: Field[] = [
  { key: "helperName", en: "Your name (the helper)", ur: "مددگار کا نام", askUr: "مدد کرنے والے کا نام بتائیں۔", askEn: "Say the helper's name.", kind: "text", required: true },
  { key: "helperPhone", en: "Your mock phone", ur: "مددگار کا فون", askUr: "مدد کرنے والے کا فون نمبر بولیں۔", askEn: "Say the helper's phone number.", kind: "digits", placeholder: "03000001234", required: true },
  { key: "helperRelation", en: "Relation to her", ur: "رشتہ", askUr: "آپ کا ان سے کیا رشتہ ہے؟ جیسے بیٹا، بیٹی، پڑوسی۔", askEn: "How are you related to her? For example son, daughter, neighbour.", kind: "text", placeholder: "Son, daughter, neighbour…", required: true },
];

const EMPTY: Form = {
  tenantId: "", role: "PENSIONER", pensionType: "family", name: "", cnic: "", phone: "", dateOfBirth: "", area: "", pensionNo: "", password: "", pin: "",
  husbandName: "", husbandCnic: "", husbandDeathDate: "", deathCertNo: "", shopName: "", shopAddress: "",
  assisted: false, helperName: "", helperPhone: "", helperRelation: "",
};

function fromSpeech(kind: Kind, said: string, karachi: boolean) {
  if (kind === "digits") return spokenDigits(said);
  if (kind === "pension") { const d = spokenDigits(said); return d ? `PEN-${karachi ? "K" : "H"}-${d}` : said.toUpperCase(); }
  return said.replace(/[۔.]+$/, "").trim();
}

/** Says one short line in ONE language (Urdu, or English if English-only is chosen) and waits until it has
 *  really finished, so the microphone never starts while the phone is still talking. */
async function say(ur: string, en: string) {
  const lang = getLang();
  await Promise.race([lang === "both" ? speakUrdu(ur) : speakUrdu(ur, en), new Promise((r) => setTimeout(r, 15000))]);
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Fetches the spoken questions ahead of time so each one starts at once (the browser keeps them cached). */
function warmUp(lines: { ur: string; en: string }[]) {
  const lang = getLang() === "en" ? "en" : "ur";
  for (const l of lines) void fetch(`/api/voice/tts?lang=${lang}&voice=${getVoiceChoice()}&text=${encodeURIComponent(lang === "en" ? l.en : l.ur)}`).catch(() => undefined);
}

export default function RegisterForm({ onDone }: { onDone: () => void }) {
  const [offices, setOffices] = useState<{ id: string; name: string; nameUr: string | null }[]>([]);
  const [f, setF] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listeningKey, setListeningKey] = useState<Key | null>(null);
  const [guided, setGuided] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const live = useRef<Listening | null>(null);
  const stopGuide = useRef(false);
  const formRef = useRef(f);
  formRef.current = f;
  const put = (k: Key, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const karachi = /karachi/i.test(offices.find((o) => o.id === f.tenantId)?.name ?? "Karachi");

  useEffect(() => {
    fetch("/api/auth/register").then((r) => r.json()).then((d) => {
      setOffices(d.offices ?? []);
      const first = d.offices?.find((o: { name: string }) => /karachi/i.test(o.name)) ?? d.offices?.[0];
      if (first) setF((x) => ({ ...x, tenantId: x.tenantId || first.id }));
    }).catch(() => setError("Could not load the pension offices. Check your connection."));
    if (voiceOn()) void speakUrdu(
      "نیا اکاؤنٹ۔ اگر آپ پڑھ نہیں سکتیں تو اوپر والا بٹن، آواز سے فارم بھریں، دبائیں۔ میں ایک ایک سوال پوچھوں گی، آپ جواب بولیں۔ یا کسی مددگار سے بھروا لیں۔",
      "New account. If you cannot read, press Fill by voice at the top. I will ask one question at a time and you answer out loud. Or ask a helper to fill it for you.",
    );
    return () => { stopGuide.current = true; live.current?.stop(); };
  }, []);

  /** Reads one question aloud, listens until she stops talking, and fills the answer in. */
  async function askField(field: Field): Promise<boolean> {
    stopSpeaking();
    setHint(null);
    await say(field.askUr, field.askEn);
    stopSpeaking();
    await pause(200); // let the last sound die away so the mic does not hear the phone
    setListeningKey(field.key);
    const numbers = field.kind === "digits" || field.kind === "pension";
    // Numbers: she may pause between digits, so wait a little longer before deciding she has finished.
    live.current = startListening(numbers ? 25000 : 12000, numbers ? 2200 : 1300);
    const r = await live.current.result;
    live.current = null;
    setListeningKey(null);
    if (!r.text) {
      const p = LISTEN_ERROR[r.error ?? "no_speech"];
      setHint(p.en);
      await say(p.ur, p.en);
      return false;
    }
    const v = fromSpeech(field.kind, r.text, karachi);
    if (!v) { setHint(`Heard "${r.text}" but found no digits. Say the numbers one by one.`); await say("ہندسے سمجھ نہیں آئے۔ ایک ایک ہندسہ بولیں۔", "I did not catch the digits. Say them one by one."); return false; }
    put(field.key, v);
    setHint(null);
    // A short "okay" only: the answer is shown in the box. (A PIN is never read out.)
    await say("ٹھیک ہے۔", "Okay.");
    return true;
  }

  async function micFor(field: Field) {
    if (listeningKey === field.key) { live.current?.stop(); return; }
    if (listeningKey || guided) return;
    await askField(field);
  }

  /** Walks through every empty question that can be answered by voice, one at a time. */
  async function fillByVoice() {
    if (guided) { stopGuide.current = true; live.current?.stop(); stopSpeaking(); setGuided(false); return; }
    stopGuide.current = false;
    setGuided(true);
    const list = [...fieldsFor(formRef.current), ...(formRef.current.assisted ? HELPER_FIELDS : [])].filter((x) => x.voice !== false);
    const todo = list.filter((x) => !formRef.current[x.key]);
    todo.forEach((field, i) => { if (i < 2) warmUp([{ ur: field.askUr, en: field.askEn }]); });
    for (const [i, field] of todo.entries()) {
      if (stopGuide.current) break;
      const next = todo[i + 2];
      if (next) warmUp([{ ur: next.askUr, en: next.askEn }]); // fetch a question ahead so it starts at once
      if (formRef.current[field.key]) continue;
      let ok = await askField(field);
      if (!ok && !stopGuide.current) ok = await askField(field); // one more try, then move on
    }
    if (!stopGuide.current) {
      await say("شکریہ۔ سب لکھ لیا۔ کسی سے چیک کروا لیں، پھر نیچے سبز بٹن دبائیں۔", "Thank you, everything is written. Have someone check it, then press the green Send button at the bottom.");
    }
    setGuided(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = { tenantId: f.tenantId, role: f.role, name: f.name, cnic: f.cnic, phone: f.phone };
      const opt = (k: Key, as: string = k) => { const v = f[k]; if (typeof v === "string" && v.trim()) body[as] = v.trim(); };
      opt("dateOfBirth"); opt("area"); opt("password"); opt("pin");
      if (f.role === "PENSIONER") {
        body.pensionType = f.pensionType; opt("pensionNo");
        if (f.pensionType === "family") { opt("husbandName"); opt("husbandCnic"); opt("husbandDeathDate"); opt("deathCertNo"); }
      }
      if (f.role === "SHOPKEEPER") { opt("shopName"); opt("shopAddress"); }
      if (f.assisted) body.assistedBy = { name: f.helperName, phone: f.helperPhone, relation: f.helperRelation };
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Please check the form and try again.");
      setDone(data.message);
      void speakUrdu("شکریہ۔ آپ کا فارم پنشن آفس کو چلا گیا۔ افسر ریکارڈ سے ملا کر آپ کا اکاؤنٹ کھولے گا۔", "Thank you. Your form has gone to the pension office. An officer will check it against the records and open your account.");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Something went wrong";
      setError(m);
      void speakUrdu("فارم میں کچھ غلط ہے۔ سرخ لکھائی دیکھیں یا کسی سے پڑھوائیں۔", `There is a problem: ${m}`);
    } finally { setBusy(false); }
  }

  if (done) return (
    <div className="space-y-3">
      <div className="bubble">✅ {done}</div>
      <button type="button" className="btn w-full" data-say="واپس شروع پر جائیں" data-say-en="Back to start" onClick={onDone}><span className="en">Back to start</span><span className="ur">واپس</span></button>
    </div>
  );

  const renderField = (field: Field) => {
    const v = f[field.key] as string;
    const isLive = listeningKey === field.key;
    return (
      <label key={field.key} className={`block space-y-1 ${isLive ? "reg-live" : ""}`}>
        <span className="text-sm font-semibold" data-say={field.askUr} data-say-en={field.askEn}>
          {field.en} <span className="ur muted">{field.ur}</span>{field.optional && <span className="muted font-normal"> (optional)</span>}
        </span>
        <span className="reg-input">
          <input
            className="input" value={v} placeholder={field.placeholder} required={field.required}
            type={field.kind === "date" ? "date" : field.kind === "secret" || field.key === "pin" ? "password" : "text"}
            inputMode={field.kind === "digits" ? "numeric" : undefined}
            autoComplete={field.kind === "secret" ? "new-password" : "off"}
            minLength={field.kind === "secret" && v ? 8 : undefined}
            maxLength={field.key === "pin" ? 4 : undefined}
            onChange={(e) => put(field.key, e.target.value)}
          />
          {field.voice !== false && (
            <button type="button" className={`reg-mic ${isLive ? "live" : ""}`} onClick={() => void micFor(field)} aria-label={isLive ? "Stop listening" : `Say ${field.en}`} data-no-voice>
              {isLive ? "⏹️" : "🎤"}
            </button>
          )}
        </span>
      </label>
    );
  };

  const all = fieldsFor(f);
  const pick = (keys: Key[]) => all.filter((x) => keys.includes(x.key));
  const groups: { id: string; icon: string; en: string; ur: string; fields: Field[] }[] = [
    { id: "you", icon: "🪪", en: f.assisted ? "About her" : "About you", ur: "ذاتی معلومات", fields: pick(["name", "cnic", "phone", "dateOfBirth", "area"]) },
    { id: "husband", icon: "🕊️", en: "Late husband", ur: "مرحوم شوہر", fields: pick(["husbandName", "husbandCnic", "husbandDeathDate", "deathCertNo"]) },
    { id: "shop", icon: "🏪", en: "Your shop", ur: "دکان", fields: pick(["shopName", "shopAddress"]) },
    { id: "login", icon: f.role === "PENSIONER" ? "📖" : "🔐", en: f.role === "PENSIONER" ? "Pension book and log in" : "How you will log in", ur: "پنشن بک اور لاگ اِن", fields: pick(["pensionNo", "pin", "password"]) },
  ].filter((g) => g.fields.length);

  return (
    <form className="reg-form" onSubmit={submit}>
      <div className="reg-top">
        <div className="reg-who">
          <p className="reg-label" data-say="آپ کون ہیں؟" data-say-en="Who are you?"><span className="en">Who is signing up?</span> <span className="ur">آپ کون ہیں؟</span></p>
          <div className="choice-row">
            {ROLES.map((r) => (
              <button key={r.id} type="button" className={`choice-pill ${f.role === r.id ? "is-on" : ""}`} aria-pressed={f.role === r.id} data-say={r.ur} data-say-en={r.en} onClick={() => put("role", r.id)}>{r.icon} <span className="en">{r.en}</span><span className="ur">{r.ur}</span></button>
            ))}
          </div>
          {f.role === "PENSIONER" && (
            <div className="choice-row">
              <button type="button" className={`choice-pill ${f.pensionType === "family" ? "is-on" : ""}`} aria-pressed={f.pensionType === "family"} data-say="بیوہ کی پنشن، شوہر کی وفات کے بعد" data-say-en="Widow's pension, after my husband passed away" onClick={() => put("pensionType", "family")}>🕊️ <span className="en">Widow&apos;s pension</span><span className="ur">بیوہ کی پنشن</span></button>
              <button type="button" className={`choice-pill ${f.pensionType === "self" ? "is-on" : ""}`} aria-pressed={f.pensionType === "self"} data-say="میری اپنی پنشن، ریٹائرمنٹ کی" data-say-en="My own pension, from retirement" onClick={() => put("pensionType", "self")}>🧓 <span className="en">My own pension</span><span className="ur">اپنی پنشن</span></button>
            </div>
          )}
          <label className="block space-y-1 reg-office"><span className="text-sm font-semibold" data-say="اپنا پنشن آفس چنیں" data-say-en="Choose your pension office">Pension office <span className="ur muted">پنشن آفس</span></span>
            <select className="input" value={f.tenantId} onChange={(e) => put("tenantId", e.target.value)} required>{offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </label>
        </div>
        <div className="reg-side">
          <button type="button" className={`reg-voice ${guided ? "live" : ""}`} onClick={() => void fillByVoice()} data-no-voice>
            <span className="text-3xl">{guided ? "⏹️" : "🎙️"}</span>
            <span className="flex-1 text-left">
              <b className="block"><span className="ur">{guided ? "روکیں" : "آواز سے فارم بھریں"}</span> <span className="en">{guided ? "Stop" : "Fill the form by voice"}</span></b>
              <span className="text-xs" style={{ opacity: .85 }}>{guided ? "Listening and asking one question at a time…" : "I ask each question out loud, you answer. No reading needed."}</span>
            </span>
          </button>
          <label className="reg-check" data-say="کیا کوئی اور آپ کے لیے یہ فارم بھر رہا ہے؟" data-say-en="Is someone else filling this form for her?">
            <input type="checkbox" checked={f.assisted} onChange={(e) => put("assisted", e.target.checked)} />
            <span><b><span className="en">Someone is filling this for her</span> <span className="ur">کوئی اور بھر رہا ہے</span></b><br /><span className="text-xs muted">For a widow who cannot read or write. The officer sees who helped and checks with her directly.</span></span>
          </label>
          {hint && <p className="text-sm" style={{ color: "var(--warn)" }}>{hint}</p>}
        </div>
      </div>

      {f.assisted && (
        <fieldset className="reg-step reg-helper">
          <legend><span className="reg-num">✋</span> <span className="en">Who is helping</span> <span className="ur">مددگار</span></legend>
          <div className="reg-grid">{HELPER_FIELDS.map(renderField)}</div>
        </fieldset>
      )}
      {groups.map((g, i) => (
        <fieldset key={g.id} className="reg-step">
          <legend><span className="reg-num">{i + 1}</span> {g.icon} <span className="en">{g.en}</span> <span className="ur">{g.ur}</span></legend>
          <div className="reg-grid">{g.fields.map(renderField)}</div>
        </fieldset>
      ))}

      <div className="reg-foot">
        <p className="text-xs muted flex-1">Demo only: use a <b>mock CNIC</b> (00000-…) and <b>mock phones</b> (0300000….). Real numbers are refused. No account opens until a pension officer approves it.</p>
        <button className="btn reg-send" disabled={busy || guided} data-say="چیک کے لیے بھیجیں۔ فارم پنشن آفس کو جائے گا" data-say-en="Send for checking. The form goes to the pension office.">{busy ? "…" : <><span className="en">Send for checking</span><span className="ur">چیک کے لیے بھیجیں</span> →</>}</button>
      </div>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    </form>
  );
}
