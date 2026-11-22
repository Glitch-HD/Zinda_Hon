"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { speakUrdu, stopSpeaking } from "@/lib/client/voice";

// Guided tour for judges: 20 stops across all six roles (widow, helper, shopkeeper, officer, admin,
// auditor). Each stop logs in as the right demo account (all fake, mock data only), opens the right
// screen, outlines the part being explained, and reads it out. The tour only looks: it never presses
// approve, stop, reset or anything else that changes data.

type Who = "guest" | "widow" | "helper" | "shop" | "officer" | "admin" | "auditor";
type Stop = { who: Who; path: string; match: RegExp; findFrom?: string; sel?: string; title: string; en: string; tryIt?: string; ur: string };

const ACCOUNTS: Record<Exclude<Who, "guest">, { phone: string; password: string; name: string }> = {
  widow: { phone: "03026619470", password: "Zainab786", name: "Zainab Bibi" },
  helper: { phone: "03012654398", password: "Rubina@Lyari8", name: "Rubina (helper)" },
  shop: { phone: "03225501987", password: "Imran*Shop4", name: "Imran (shopkeeper)" },
  officer: { phone: "03214417832", password: "Sana@Pension24", name: "Sana (officer)" },
  admin: { phone: "03452876104", password: "Kamran$Admin9", name: "Kamran (admin)" },
  auditor: { phone: "03127739025", password: "Nadia&Audit3", name: "Nadia (auditor)" },
};
const ROLE_LABEL: [Who[], string][] = [[["guest", "widow"], "Widow"], [["helper"], "Helper"], [["shop"], "Shopkeeper"], [["officer"], "Officer"], [["admin"], "Admin"], [["auditor"], "Auditor"]];

const STOPS: Stop[] = [
  { who: "guest", path: "/login", match: /^\/login/, sel: "#start", title: "The problem we solve",
    en: "Every year, a pensioner must prove she is alive, or her pension stops. Today that means a trip to an office or bank, a queue, and forms she cannot read. Zinda Hon lets her do it from home in about two minutes: look at the phone camera, show her pension book, done. Hard or unclear cases always go to a person.",
    tryIt: "Press the Listen button on this page: the whole front page talks in Urdu.",
    ur: "ہر سال پنشنر کو ثابت کرنا ہوتا ہے کہ وہ زندہ ہیں۔ زندہ ہوں سے وہ یہ کام گھر بیٹھے دو منٹ میں کر سکتی ہیں۔" },
  { who: "guest", path: "/login", match: /^\/login/, sel: ".who-grid", title: "Six kinds of users, one platform",
    en: "The widow (pensioner), the helper who serves many families from one phone, the shopkeeper who keeps getting fake relief messages, the pension officer, the admin who changes rules, and the auditor who checks everyone. Each role sees only its own pages; the server checks this on every request, not just the screen.",
    ur: "ایک پلیٹ فارم، چھ قسم کے لوگ۔ ہر ایک صرف اپنا حصہ دیکھ سکتا ہے۔" },

  { who: "widow", path: "/pensioner", match: /^\/pensioner/, sel: ".traffic", title: "Zainab's home: one glance",
    en: "We are now logged in as Zainab Bibi, a widow in Lyari. She cannot read, so her status is a traffic light: green means done, amber means something to do or an officer is checking, red means stopped. The light, its position and a spoken sentence all say the same thing, so colour-blind users are covered too.",
    tryIt: "Use the A+ / A++ buttons at the top for bigger text, or Lite for a 2G phone.",
    ur: "زینب بی بی پڑھ نہیں سکتیں، اس لیے ان کا حال ایک ٹریفک لائٹ بتاتی ہے: سبز، پیلا یا لال۔" },
  { who: "widow", path: "/pensioner", match: /^\/pensioner/, sel: ".tile-hero", title: "Proof of life in four pictures",
    en: "The big button starts proof of life. Step 1, look at the camera: the phone turns her face into 128 numbers; the photo never leaves the phone. Step 2, blink and turn in an order the server chose, so a printed photo or a video replay fails. Step 3, show the signed QR on her pension book; the app also reads the printed name (OCR) to catch a swapped book. Step 4, send. Each step is saved on the phone, so a dropped signal loses nothing.",
    tryIt: "You can press it to see the camera steps, then come back to the tour with the Tour button.",
    ur: "بڑا بٹن ثبوتِ حیات شروع کرتا ہے: کیمرے میں دیکھیں، آنکھ جھپکائیں اور سر موڑیں، پنشن بک دکھائیں، بھیجیں۔" },
  { who: "widow", path: "/consent", match: /^\/consent/, sel: '[data-tour="consent"]', title: "She controls her data",
    en: "Here Zainab sees exactly who can see her information: the pension office and her helper, item by item. One button takes permission back, and it stops access at once (the server checks consent live on every request). She can also ask to correct a wrong name, birth date, CNIC or bank account. A bank or CNIC change needs two different officers, so one dishonest officer cannot redirect her money.",
    ur: "زینب دیکھ سکتی ہیں کہ ان کا ڈیٹا کس کے پاس ہے، اور ایک بٹن سے اجازت واپس لے سکتی ہیں۔" },

  { who: "helper", path: "/helper", match: /^\/helper/, sel: '[data-tour="families"]', title: "Helper mode: one phone, many families",
    en: "Rubina helps elderly families in her area from one shared phone. Each family card has its own permission, its own traffic light dot and a Listen button. She can only act for a family that allowed it, and an officer must link her with a written reason. One helper can serve at most 40 families.",
    ur: "روبینہ ایک فون سے کئی خاندانوں کی مدد کرتی ہیں۔ ہر خاندان کی اپنی اجازت ہے۔" },
  { who: "helper", path: "/helper", match: /^\/helper/, sel: '[data-tour="families"] a.btn, [data-tour="families"]', title: "Why a helper cannot cheat",
    en: "When Rubina acts for a family, the camera still needs that pensioner's own live face; her face, or a relative's look-alike face, is refused. Every helper action is logged, and the admin sees a trust score for each helper: too many failed faces or cases for people who later turned out dead lowers it and warns the officer.",
    ur: "مددگار کام کرے تب بھی چہرہ پنشنر کا اپنا اور زندہ ہونا چاہیے۔ ہر کام کا ریکارڈ رہتا ہے۔" },

  { who: "shop", path: "/shopkeeper", match: /^\/shopkeeper/, sel: '[data-tour="checker"]', title: "Shopkeeper: check before paying",
    en: "Imran runs a mobile-wallet shop. Customers often show him fake 'relief payment' messages. He pastes or speaks the message here; the AI says Scam, Genuine or Not sure, with a confidence score and the reasons (fake link, asks for PIN, fee demanded). When it is not sure, it says so and an officer labels it later.",
    tryIt: "Paste: 'Mubarak! BISP relief Rs 25,000 approved. Send Rs 500 fee and your PIN to 0300-0000000.'",
    ur: "امران دکاندار ہیں۔ کوئی پیغام آئے تو پیسے بھیجنے سے پہلے یہاں جانچتے ہیں۔" },
  { who: "shop", path: "/scam-map", match: /^\/scam-map/, sel: "main", title: "The scam map",
    en: "Every checked message becomes a dot on this map, by area and type, so officers can warn the right neighbourhood. Zainab's home page already showed a warning for Lyari, which comes from here. Anonymous checks from the public are not counted, so nobody can flood the map.",
    ur: "ہر جانچا گیا پیغام نقشے پر آتا ہے، تاکہ افسر صحیح علاقے کو خبردار کر سکیں۔" },

  { who: "officer", path: "/officer", match: /^\/officer$/, sel: ".mini-charts", title: "Officer: the overview",
    en: "Sana is a pension officer. These charts show this year's cases by status, who decided them (the AI or an officer), how many were handled each week, and how many checked messages were scams.",
    ur: "ثنا پنشن افسر ہیں۔ یہ چارٹ اس سال کے کیس اور فیصلے دکھاتے ہیں۔" },
  { who: "officer", path: "/officer", match: /^\/officer$/, sel: ".qcard, .empty-state", title: "Only the hard cases reach a person",
    en: "The AI approves a case alone only when every check is strong and the expected cost of a wrong approval is lower than the cost of a delay. Anything unclear comes here, riskiest first, with the AI's notes. The AI can never stop a pension by itself: only an officer can, with a written reason the widow can hear.",
    ur: "صاف کیس اے آئی منظور کرتا ہے۔ مشکل کیس یہاں آتے ہیں، سب سے خطرناک پہلے۔ پنشن صرف افسر روک سکتا ہے۔" },
  { who: "officer", path: "/officer", match: /^\/officer\/case\//, findFrom: "/officer", sel: "table, main", title: "Inside one case",
    en: "The officer sees the records side by side (pension list, NADRA, death register, bank), each AI check with its score, the rule version used, and every decision with its reason in English and Urdu. Serious risks, such as a face that matches another pensioner, need a second officer to approve.",
    ur: "افسر ہر ریکارڈ اور ہر جانچ ساتھ ساتھ دیکھتا ہے، اور ہر فیصلے کی وجہ لکھی ہوتی ہے۔" },
  { who: "officer", path: "/officer", match: /^\/officer\/case\//, findFrom: "/officer", sel: '[data-tour="agent"], [data-tour="decide"]', title: "The AI case assistant",
    en: "The assistant plans its own steps and calls tools (NADRA lookup, death register, bank check, history) to prepare a recommendation. It can only read and advise; it cannot approve or stop. Each tool call is written to the audit log.",
    ur: "اے آئی معاون خود ریکارڈ جانچ کر مشورہ دیتا ہے، مگر فیصلہ صرف افسر کرتا ہے۔" },
  { who: "officer", path: "/officer/families", match: /^\/officer\/families/, sel: "main", title: "Families desk",
    en: "Here officers open this year's cases, link a helper to a family (with a note and a consent record), and accept or reject correction requests. A bank account or CNIC change is proposed by one officer and applied only by a different one.",
    ur: "یہاں افسر کیس کھولتے ہیں، مددگار جوڑتے ہیں اور درستی کی درخواستیں دیکھتے ہیں۔" },
  { who: "officer", path: "/officer/messages", match: /^\/officer\/messages/, sel: "main", title: "Honest accuracy",
    en: "Messages the AI was unsure about land here. The officer marks what each one really was. These labels feed the evaluation page, so our false alarm numbers are measured, not claimed. Blocking a real person is counted as a cost too.",
    ur: "جن پیغاموں پر اے آئی کو یقین نہیں تھا، افسر بتاتا ہے کہ وہ اصل میں کیا تھے۔" },

  { who: "admin", path: "/admin", match: /^\/admin$/, sel: "#rules", title: "Rules change without code",
    en: "Kamran, the admin, can change the checking rules here (for example how close a face must match) with no code change and no redeploy. 'Test on past cases first' is a Digital Twin: it replays last year's cases with the new rule and shows what would change. Making rules looser needs a second admin, and every old decision keeps the rule version it used.",
    ur: "ایڈمن قواعد بغیر کوڈ کے بدل سکتا ہے، پہلے پرانے کیسوں پر آزما کر۔ نرم کرنے کے لیے دوسرا ایڈمن چاہیے۔" },
  { who: "admin", path: "/admin", match: /^\/admin$/, sel: "#keys, #health", title: "API keys and health",
    en: "Banks and departments connect through a public REST API with their own keys, scopes and rate limits (see API docs). The health box shows server errors and phone crashes from the last 24 hours.",
    ur: "بینک اپنی چابی سے اے پی آئی کے ذریعے جڑتے ہیں۔ یہاں نظام کی صحت بھی نظر آتی ہے۔" },
  { who: "admin", path: "/evaluation", match: /^\/evaluation/, sel: "main", title: "Evaluation dashboard",
    en: "How often the face check and scam check were right on labelled test data, how often they raised a false alarm, how long they took and what they cost, with error margins. Judges can see our weak spots here, not just our strengths.",
    ur: "یہ صفحہ دکھاتا ہے کہ اے آئی کتنی بار صحیح تھا اور کتنی بار غلط خبردار کیا۔" },

  { who: "auditor", path: "/auditor", match: /^\/auditor/, sel: "main", title: "The auditor sees everything, changes nothing",
    en: "Nadia can only read. Every AI decision shows its full trace: the inputs, rule version, scores, confidence and result. The audit log records every person, AI and agent action, and the database refuses to edit or delete it. Consent grants and withdrawals are listed too.",
    ur: "آڈیٹر صرف دیکھ سکتا ہے۔ ہر فیصلے کا پورا ریکارڈ یہاں ہے، جسے کوئی مٹا نہیں سکتا۔" },
  { who: "guest", path: "/docs", match: /^\/docs/, sel: "main", title: "End: the API for banks",
    en: "Finally, the public API: a bank asks 'is this pensioner verified this year?' with its key and gets a yes or no, never her face or CNIC. That is the end of the tour. Everything you saw is a prototype with fake people and fake records.",
    ur: "آخر میں بینکوں کے لیے اے پی آئی۔ یہ ٹور یہاں ختم ہوتا ہے۔ سب لوگ اور ریکارڈ نقلی ہیں۔" },
];

const KEY = "zh_tour";
const AS = "zh_tour_as";
function read(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } }

export function startTour() { window.dispatchEvent(new Event("zh-tour-start")); }

export default function GuidedTour() {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  const [small, setSmall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lit = useRef<Element | null>(null);

  useEffect(() => {
    const v = read(KEY);
    if (v !== null && !isNaN(+v)) setStep(Math.min(+v, STOPS.length - 1));
    const start = () => { void go(0, true); };
    window.addEventListener("zh-tour-start", start);
    if (new URLSearchParams(window.location.search).get("tour") === "1") void go(0, true);
    return () => window.removeEventListener("zh-tour-start", start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(async (i: number, force = false) => {
    const s = STOPS[i];
    setErr(null); setBusy(true); setSmall(false); stopSpeaking();
    try {
      if (force || read(AS) !== s.who) {
        if (s.who === "guest") await fetch("/api/auth/logout", { method: "POST" });
        else {
          const a = ACCOUNTS[s.who];
          const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: a.phone, password: a.password }) });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not log in");
        }
        write(AS, s.who);
      }
      write(KEY, String(i));
      setStep(i);
      if (s.match.test(window.location.pathname)) { /* already on the right screen */ }
      else if (s.findFrom) { write("zh_tour_find", "1"); router.push(s.findFrom); }
      else if (!s.match.test(window.location.pathname)) router.push(s.path);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
  }, [router]);

  // A stop inside one case: open the first case on the officer's page.
  useEffect(() => {
    if (step === null || !STOPS[step].findFrom || read("zh_tour_find") !== "1") return;
    if (STOPS[step].match.test(path)) { write("zh_tour_find", null); return; }
    if (path !== STOPS[step].findFrom) return;
    let n = 0;
    const t = setInterval(() => {
      const a = document.querySelector<HTMLAnchorElement>('.qcard a[href^="/officer/case/"], a[href^="/officer/case/"]');
      if (a || ++n > 20) { clearInterval(t); write("zh_tour_find", null); if (a) router.push(a.getAttribute("href")!); }
    }, 250);
    return () => clearInterval(t);
  }, [step, path, router]);

  // Outline the part being explained.
  useEffect(() => {
    lit.current?.classList.remove("tour-target");
    lit.current = null;
    if (step === null) return;
    const s = STOPS[step];
    if (!s.sel || !s.match.test(path)) return;
    let n = 0;
    const t = setInterval(() => {
      const el = document.querySelector(s.sel!);
      if (el || ++n > 20) {
        clearInterval(t);
        if (el) { el.classList.add("tour-target"); lit.current = el; el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      }
    }, 200);
    return () => { clearInterval(t); lit.current?.classList.remove("tour-target"); };
  }, [step, path]);

  function end() {
    stopSpeaking(); write(KEY, null); write(AS, null); setStep(null);
    lit.current?.classList.remove("tour-target");
  }

  if (step === null) {
    if (!/^\/login/.test(path)) return null;
    return (
      <button type="button" className="tour-fab" onClick={() => void go(0, true)} data-no-voice>
        <span aria-hidden="true">▶</span>
        <span><b>Guided tour for judges</b><small>{STOPS.length} stops · widow, helper, shopkeeper, officer, admin, auditor</small></span>
      </button>
    );
  }

  const s = STOPS[step];
  const here = s.match.test(path);
  if (small) return (
    <button type="button" className="tour-fab" onClick={() => setSmall(false)} data-no-voice>
      <span aria-hidden="true">▶</span><span><b>Tour {step + 1}/{STOPS.length}</b><small>{s.title}</small></span>
    </button>
  );
  return (
    <aside className="tour-card" aria-label="Guided tour" data-no-voice>
      <div className="tour-top">
        <span className="tour-k">Guided tour · stop {step + 1} of {STOPS.length}</span>
        <span className="flex gap-1">
          <button type="button" className="tour-x" onClick={() => setSmall(true)} aria-label="Make the tour card small">–</button>
          <button type="button" className="tour-x" onClick={end} aria-label="End the tour">×</button>
        </span>
      </div>
      <div className="tour-who">
        {ROLE_LABEL.map(([ws, l]) => <span key={l} className={ws.includes(s.who) ? "on" : ""}>{l}</span>)}
      </div>
      <h3>{s.title}</h3>
      {s.who !== "guest" && <p className="tour-as">Logged in as {ACCOUNTS[s.who].name} (demo account)</p>}
      <p>{s.en}</p>
      {s.tryIt && <p className="tour-try"><b>Try this:</b> {s.tryIt}</p>}
      <p className="ur tour-ur">{s.ur}</p>
      {!here && !busy && <button type="button" className="btn btn-ghost w-full" onClick={() => void go(step, true)}>Take me to this screen</button>}
      {err && <p className="tour-err" role="alert">{err}</p>}
      <div className="tour-bar" aria-hidden="true"><span style={{ width: `${((step + 1) / STOPS.length) * 100}%` }} /></div>
      <div className="tour-row">
        <button type="button" disabled={busy || step === 0} onClick={() => void go(step - 1)}>◀ Back</button>
        <button type="button" onClick={() => void speakUrdu(s.ur, `${s.title}. ${s.en}`)}>🔊 Listen</button>
        {step < STOPS.length - 1
          ? <button type="button" className="p" disabled={busy} onClick={() => void go(step + 1)}>{busy ? "Opening…" : "Next ▶"}</button>
          : <button type="button" className="p" onClick={() => { end(); router.push("/login"); }}>Finish ✓</button>}
      </div>
    </aside>
  );
}
