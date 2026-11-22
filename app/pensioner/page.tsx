import AppealButton from "@/components/AppealButton";
import TrafficLight from "@/components/TrafficLight";
import SayButton from "@/components/ui/SayButton";
import Header from "@/components/Header";
import Option from "@/components/ui/Option";
import PensionerVoice from "@/components/PensionerVoice";
import FacePrep from "@/components/FacePrep";
import PageVoice from "@/components/PageVoice";
import AreaWarning from "@/components/AreaWarning";
import { areaScamWarning } from "@/lib/area-warning";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function PensionerHome() {
  const user = await pageUser(["PENSIONER"]);
  const p = await prisma.pensioner.findUnique({ where: { userId: user.id }, include: { cases: { orderBy: { year: "desc" }, take: 1, include: { decisions: { orderBy: { createdAt: "desc" }, take: 1, select: { reasonEn: true, reasonUr: true } } } } } });
  const c = p?.cases[0];
  const warning = await areaScamWarning(user.tenantId, p?.area);
  const canStart = c && c.status !== "VERIFIED" && c.status !== "WITH_OFFICER" && c.status !== "STOPPED";
  const statusUr = c?.status === "VERIFIED" ? "اس سال کا ثبوتِ حیات مکمل ہے۔ کیس بند ہو گیا" : c?.status === "STOPPED" ? "آپ کی پنشن روک دی گئی ہے۔ کیس بند ہے" : c?.status === "WITH_OFFICER" ? "پنشن افسر آپ کا کیس دیکھ رہا ہے" : c?.status === "NEEDS_PROOF" ? "پنشن افسر کو آپ سے مزید ثبوت چاہیے" : "اس سال کا ثبوتِ حیات باقی ہے";
  const statusEn = c?.status === "VERIFIED" ? "This year's proof-of-life is done. Case closed." : c?.status === "STOPPED" ? "Your pension has been stopped. Case closed." : c?.status === "WITH_OFFICER" ? "A pension officer is looking at your case." : c?.status === "NEEDS_PROOF" ? "A pension officer needs more proof from you." : "This year's proof-of-life is still due.";
  const last = c?.decisions[0];
  const notes = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 });
  return (
    <div className="max-w-4xl mx-auto">
      <Header user={user} />
      <PageVoice role="PENSIONER" ur={`${statusUr}۔ ${canStart ? "شروع کرنے کے لیے سبز بٹن دبائیں۔" : ""}`} en={`${statusEn} ${canStart ? "Press the green button to start." : ""}`} />
      {!p || !c ? (
        <div className="card">No pension record linked to this account.</div>
      ) : (
        <div className="space-y-6">
          <TrafficLight status={c.status} ur={statusUr} en={`${c.year}: ${statusEn}`}>
            {(c.status === "VERIFIED" || c.status === "STOPPED") && c.closedAt && <p className="text-sm muted">Closed on {c.closedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>}
          </TrafficLight>
          {c.status === "STOPPED" && (
            <div className="card p-3" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}>
              {last && <div className="bubble-say"><div><p className="ur" style={{ whiteSpace: "normal" }}>{last.reasonUr}</p><p className="en text-sm">{last.reasonEn}</p></div><SayButton ur={last.reasonUr} en={last.reasonEn} /></div>}
              <p className="ur mt-2" style={{ whiteSpace: "normal" }}>اگر یہ غلط ہے تو پنشن آفس جائیں یا اپنے مددگار سے کہیں۔ افسر کیس دوبارہ کھول سکتا ہے۔</p>
              <p className="en text-sm">If this is wrong, press the button below, visit the pension office, or ask your helper. A different officer will check it again.</p>
              <AppealButton caseId={c.id} already={c.riskFlags.includes("appeal_requested")} />
            </div>
          )}

          {canStart && (
            <Option
              variant="hero"
              icon="▶️"
              ur="ابھی شروع کریں"
              en="Start proof-of-life now"
              hintUr="تین آسان قدم: تصویر، پنشن بک، بھیجیں"
              hintEn="3 easy steps: photo, pension book, send"
              info={{ en: "Once a year you must prove you are alive so your pension continues. This takes about 2 minutes: a photo with a small movement, a scan of your pension book, then send.", ur: "سال میں ایک بار ثبوتِ حیات دینا ہوتا ہے تاکہ پنشن جاری رہے۔ دو منٹ لگتے ہیں: تصویر، پنشن بک، پھر بھیجیں۔" }}
              say="ابھی شروع کریں۔ ثبوتِ حیات کے تین آسان قدم۔"
              sayEn="Start now. Three easy steps for proof of life."
              href={`/case/${c.id}`}
            />
          )}

          {notes.length > 0 && (
            <div className="card space-y-3" style={{ padding: 18 }}>
              <h3 className="font-semibold"><span className="en">Messages for you</span> <span className="ur">آپ کے لیے پیغام</span></h3>
              {notes.map((n) => {
                const ur = NOTE_UR[n.title];
                return (
                  <div key={n.id} className="bubble-say" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                    <div>{ur && <p className="ur" style={{ whiteSpace: "normal" }}>{ur}</p>}<p className="en text-sm"><b>{n.title}.</b> {n.body}</p></div>
                    <SayButton ur={ur ?? ""} en={`${n.title}. ${n.body}`} />
                  </div>
                );
              })}
            </div>
          )}

          {warning && <AreaWarning w={warning} />}

          {canStart && <FacePrep />}

          <PensionerVoice caseHref={canStart ? `/case/${c.id}` : null} />

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <Option
              icon="🛡️"
              tone="rose"
              ur="کیا یہ پیغام اصلی ہے؟"
              en="Is this message real?"
              info={{ en: "Got an SMS or WhatsApp about your pension or a relief payment? Check it here before you call anyone or share a code.", ur: "پنشن یا امداد کا کوئی پیغام آیا ہے؟ کسی کو فون کرنے یا کوڈ بتانے سے پہلے یہاں جانچیں۔" }}
              href="/check-message"
            />
            <Option
              icon="❓"
              tone="indigo"
              ur="سوال پوچھیں"
              en="Ask a question"
              info={{ en: "Ask about pension rules by speaking or typing. Answers come only from the official rulebook; if it is not there, an officer will help.", ur: "پنشن کے قوانین کے بارے میں بول کر سوال پوچھیں۔ جواب صرف سرکاری قواعد سے ملے گا۔" }}
              href="/ask"
            />
            <Option
              icon="🔐"
              tone="teal"
              ur="میری معلومات"
              en="My data"
              info={{ en: "See who can see your information, take back permission at any time, or ask to correct a mistake.", ur: "دیکھیں کون آپ کی معلومات دیکھ سکتا ہے، اجازت واپس لیں، یا غلطی درست کروائیں۔" }}
              href="/consent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Urdu for the messages the system sends to pensioners (their English text is in the notification).
const NOTE_UR: Record<string, string> = {
  "Proof of life is due": "اس سال کا ثبوتِ حیات باقی ہے۔ ایپ کھولیں اور کیمرے میں دیکھیں، دو منٹ لگتے ہیں۔",
  "Your case is being checked again": "پنشن افسر نے آپ کا کیس دوبارہ جانچ کے لیے کھولا ہے۔",
  "A helper can now help you": "ایک مددگار اب آپ کی مدد کر سکتا ہے۔ آپ 'میری معلومات' میں جا کر یہ اجازت کبھی بھی واپس لے سکتی ہیں۔",
  "Your PIN was changed": "چہرے کی جانچ کے بعد آپ کا پن بدل دیا گیا، اور باقی سب فونوں سے لاگ آؤٹ ہو گیا۔ اگر یہ آپ نے نہیں کیا تو فوراً پنشن آفس کو بتائیں۔",
  "Your details were corrected": "افسر نے آپ کی درخواست پر آپ کی معلومات درست کر دی ہیں۔ اگر آپ نے یہ نہیں مانگا تھا تو فوراً پنشن آفس کو بتائیں۔",
};
