import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import SayButton from "@/components/ui/SayButton";
import { TrafficDot } from "@/components/TrafficLight";
import Link from "next/link";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import Info from "@/components/ui/Info";
import FacePrep from "@/components/FacePrep";
import PageVoice from "@/components/PageVoice";
import AreaWarning from "@/components/AreaWarning";
import { areaScamWarning } from "@/lib/area-warning";

// Helper Mode: one shared phone, many families. Each family has its own consent; the helper sees
// only families whose consent is active, and every action is logged against that family.
export default async function HelperHome() {
  const user = await pageUser(["HELPER"]);
  const links = await prisma.helperLink.findMany({
    where: { helperId: user.id, active: true },
    include: { pensioner: { include: { cases: { orderBy: { year: "desc" }, take: 1 }, consents: { where: { granteeId: user.id, withdrawnAt: null } } } } },
    orderBy: { createdAt: "asc" },
  });
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { area: true } });
  const warning = await areaScamWarning(user.tenantId, me?.area);
  return (
    <div>
      <PageVoice role="HELPER" ur={`خوش آمدید۔ آپ ${links.length} خاندانوں کی مدد کرتے ہیں۔ کسی خاندان کے لیے کام کرنے کو اس کا بٹن دبائیں۔`} en={`Welcome. You help ${links.length} families. Press a family's button to act for them.`} />
      <Header user={user} links={[{ href: "/check-message", label: "Check a message", ur: "پیغام جانچیں", info: { en: "Check if an SMS or WhatsApp message a family received is a scam.", ur: "جانچیں کہ کسی خاندان کو آیا پیغام دھوکہ تو نہیں۔" } }]} />
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold"><span className="en">Families you help ({links.length})</span></h2><p className="ur text-xl">جن خاندانوں کی آپ مدد کرتے ہیں ({links.length})</p>
          <p className="muted"><span className="en block">Tap &quot;Act for&quot; to switch to a family. Each family controls their own permission.</span><span className="ur block" style={{ whiteSpace: "normal" }}>کسی خاندان کے لیے کام کرنے کو بٹن دبائیں۔ ہر خاندان اپنی اجازت خود دیتا ہے۔</span></p>
        </div>
        <Info en="Helper Mode: one phone, many families. You only see a family while their permission is active. Everything you do is recorded under that family's name, and they can withdraw permission at any time." ur="ایک فون، کئی خاندان۔ آپ صرف وہ خاندان دیکھ سکتے ہیں جنہوں نے اجازت دی ہے۔ ہر کام ریکارڈ ہوتا ہے اور خاندان کسی بھی وقت اجازت واپس لے سکتا ہے۔" />
      </div>
      {warning && <div className="mb-4"><AreaWarning w={warning} /></div>}
      <div className="mb-4"><FacePrep who="families" /></div>
      {links.length === 0 && <EmptyState icon="users" en="No families linked yet" ur="ابھی کوئی خاندان نہیں جڑا" hint="A pension officer links you to a family, with the family's permission." />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="families">
        {links.map(({ pensioner: p }) => {
          const consent = p.consents[0];
          const c = p.cases[0];
          const canAct = consent?.fields.includes("face") && consent.fields.includes("case_status");
          return (
            <div key={p.id} className="card flex flex-col gap-3" style={{ padding: 18 }}>
              <div className="flex items-start gap-3">
                <div className="status-ic status-ic-sm" data-status={c?.status ?? "none"}><Icon name={c?.status === "VERIFIED" ? "check" : c?.status === "STOPPED" ? "alert" : c?.status === "WITH_OFFICER" ? "user" : c?.status === "NEEDS_PROOF" ? "camera" : "clock"} size={26} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg">{p.name}</div>
                  {p.nameUr && <div className="ur text-lg" style={{ lineHeight: 1.8 }}>{p.nameUr}</div>}
                  <div className="text-sm muted">{p.pensionNo} · {c ? (c.status === "VERIFIED" ? "approved, case closed" : c.status === "STOPPED" ? "pension stopped, case closed" : c.status.replaceAll("_", " ").toLowerCase()) : "no case"}</div>
                  <div className="text-xs muted mt-1">{consent ? `Permission: ${consent.fields.join(", ")}` : "Permission withdrawn"}</div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap"><TrafficDot status={c?.status} /><SayButton ur={sayUr(p.nameUr ?? p.name, c?.status)} en={sayEn(p.name, c?.status)} /></div>
                </div>
              </div>
              {canAct && c && c.status !== "VERIFIED" && c.status !== "STOPPED"
                ? <Link className="btn w-full" href={`/case/${c.id}`} data-say={`${p.nameUr ?? p.name} کے لیے کام کریں`}><span className="en">Act for {p.name.split(" ")[0]}</span><span className="ur">ان کے لیے کام کریں</span></Link>
                : <span className={`badge self-start ${c?.status === "STOPPED" ? "badge-danger" : ""}`}>{!canAct ? "no permission" : c?.status === "STOPPED" ? "stopped: ask the office to reopen" : "done for this year"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function sayUr(name: string, status?: string) {
  const t = status === "VERIFIED" ? "اس سال کا ثبوتِ حیات مکمل ہے" : status === "STOPPED" ? "پنشن رکی ہوئی ہے، دفتر سے دوبارہ کھلوائیں" : status === "WITH_OFFICER" ? "افسر کیس دیکھ رہا ہے" : status === "NEEDS_PROOF" ? "افسر کو مزید ثبوت چاہیے" : status ? "ثبوتِ حیات باقی ہے" : "کوئی کیس نہیں";
  return `${name}: ${t}۔`;
}
function sayEn(name: string, status?: string) {
  const t = status === "VERIFIED" ? "this year's proof of life is done" : status === "STOPPED" ? "pension stopped, ask the office to reopen" : status === "WITH_OFFICER" ? "an officer is checking the case" : status === "NEEDS_PROOF" ? "the officer needs more proof" : status ? "proof of life is still due" : "no case";
  return `${name}: ${t}.`;
}
