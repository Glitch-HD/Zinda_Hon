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
      <Header user={user} links={[{ href: "/check-message", label: "🛡️ Check a message", ur: "پیغام جانچیں", info: { en: "Check if an SMS or WhatsApp message a family received is a scam.", ur: "جانچیں کہ کسی خاندان کو آیا پیغام دھوکہ تو نہیں۔" } }]} />
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold"><span className="en">Families you help ({links.length})</span></h2><p className="ur text-xl">جن خاندانوں کی آپ مدد کرتے ہیں ({links.length})</p>
          <p className="muted"><span className="en block">Tap &quot;Act for&quot; to switch to a family. Each family controls their own permission.</span><span className="ur block" style={{ whiteSpace: "normal" }}>کسی خاندان کے لیے کام کرنے کو بٹن دبائیں۔ ہر خاندان اپنی اجازت خود دیتا ہے۔</span></p>
        </div>
        <Info en="Helper Mode: one phone, many families. You only see a family while their permission is active. Everything you do is recorded under that family's name, and they can withdraw permission at any time." ur="ایک فون، کئی خاندان۔ آپ صرف وہ خاندان دیکھ سکتے ہیں جنہوں نے اجازت دی ہے۔ ہر کام ریکارڈ ہوتا ہے اور خاندان کسی بھی وقت اجازت واپس لے سکتا ہے۔" />
      </div>
      {warning && <div className="mb-4"><AreaWarning w={warning} /></div>}
      <div className="mb-4"><FacePrep who="families" /></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map(({ pensioner: p }) => {
          const consent = p.consents[0];
          const c = p.cases[0];
          const canAct = consent?.fields.includes("face") && consent.fields.includes("case_status");
          return (
            <div key={p.id} className="card flex flex-col gap-3" style={{ padding: 18 }}>
              <div className="flex items-start gap-3">
                <div className="text-4xl">{c?.status === "VERIFIED" ? "✅" : c?.status === "WITH_OFFICER" ? "🧑‍💼" : "⏳"}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg">{p.name}</div>
                  {p.nameUr && <div className="ur text-lg" style={{ lineHeight: 1.8 }}>{p.nameUr}</div>}
                  <div className="text-sm muted">{p.pensionNo} · {c ? c.status.replaceAll("_", " ").toLowerCase() : "no case"}</div>
                  <div className="text-xs muted mt-1">{consent ? `Permission: ${consent.fields.join(", ")}` : "⛔ Permission withdrawn"}</div>
                </div>
              </div>
              {canAct && c && c.status !== "VERIFIED"
                ? <Link className="btn w-full" href={`/case/${c.id}`} data-say={`${p.nameUr ?? p.name} کے لیے کام کریں`}><span className="en">Act for {p.name.split(" ")[0]}</span><span className="ur">ان کے لیے کام کریں</span></Link>
                : <span className="badge self-start">{canAct ? "done" : "no permission"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
