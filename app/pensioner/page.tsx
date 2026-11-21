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
  return (
    <div className="max-w-4xl mx-auto">
      <Header user={user} />
      <PageVoice role="PENSIONER" ur={`${statusUr}۔ ${canStart ? "شروع کرنے کے لیے سبز بٹن دبائیں۔" : ""}`} en={`${statusEn} ${canStart ? "Press the green button to start." : ""}`} />
      {!p || !c ? (
        <div className="card">No pension record linked to this account.</div>
      ) : (
        <div className="space-y-6">
          <div className="card status-arch text-center space-y-2 md:pb-8" data-say={statusUr}>
            <div className="text-7xl">{c.status === "VERIFIED" ? "✅" : c.status === "STOPPED" ? "⛔" : c.status === "WITH_OFFICER" ? "🧑‍💼" : c.status === "NEEDS_PROOF" ? "📷" : "⏳"}</div>
            <p className="ur text-2xl md:text-3xl">{statusUr}</p>
            <p className="en muted">{c.year}: {statusEn}</p>
            {(c.status === "VERIFIED" || c.status === "STOPPED") && c.closedAt && <p className="text-sm muted">Closed on {c.closedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>}
            {c.status === "STOPPED" && (
              <div className="text-left mt-3 p-3 rounded-xl" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}>
                {last && <><p className="ur" style={{ whiteSpace: "normal" }}>{last.reasonUr}</p><p className="en text-sm">{last.reasonEn}</p></>}
                <p className="ur mt-2" style={{ whiteSpace: "normal" }}>اگر یہ غلط ہے تو پنشن آفس جائیں یا اپنے مددگار سے کہیں۔ افسر کیس دوبارہ کھول سکتا ہے۔</p>
                <p className="en text-sm">If this is wrong, visit the pension office or ask your helper. An officer can reopen the case.</p>
              </div>
            )}
          </div>

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
