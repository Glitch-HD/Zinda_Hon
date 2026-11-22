import { pkt } from "@/lib/time";
import EmptyState from "@/components/ui/EmptyState";
import Header from "@/components/Header";
import MessageChecker from "@/components/MessageChecker";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import Info from "@/components/ui/Info";
import PageVoice from "@/components/PageVoice";

export default async function Shopkeeper() {
  const user = await pageUser(["SHOPKEEPER"]);
  const mine = await prisma.checkedMessage.findMany({ where: { submittedById: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div>
      <PageVoice role="SHOPKEEPER" ur="خوش آمدید۔ گاہک کو پنشن یا امداد کا کوئی پیغام آیا ہو تو پیسے بھیجنے سے پہلے اسے یہاں جانچیں۔" en="Welcome. If a customer got a pension or relief message, check it here before anyone sends money." />
      <Header user={user} links={[{ href: "/scam-map", label: "Scam map", ur: "دھوکے کا نقشہ", info: { en: "See which areas are getting the most fake pension and relief messages right now.", ur: "دیکھیں کن علاقوں میں سب سے زیادہ جعلی پیغام آ رہے ہیں۔" } }]} />
      <div className="card card-soft mb-6 flex items-start gap-3">
        <span className="text-3xl"></span>
        <p className="flex-1"><span className="en">Customers show you suspicious &quot;pension&quot; or &quot;relief payment&quot; messages? Check them here before anyone sends money.</span><span className="ur">گاہک پنشن یا امداد کا مشکوک پیغام دکھائیں؟ پیسے بھیجنے سے پہلے یہاں جانچیں۔</span></p>
        <Info en="Every check also feeds the Scam Map, so officers can warn an area when a new scam starts." ur="ہر جانچ دھوکے کے نقشے میں جاتی ہے تاکہ افسر علاقے کو خبردار کر سکیں۔" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        <MessageChecker />
        <div className="card">
          <h3 className="font-semibold mb-2"><span className="en">Your recent checks</span><span className="ur">آپ کی حالیہ جانچ</span></h3>
          {mine.length === 0 ? <EmptyState icon="search" en="Nothing checked yet" ur="ابھی کوئی پیغام نہیں جانچا" hint="Messages you check will be listed here." /> : (
            <ul className="text-sm space-y-2">{mine.map((m) => (
              <li key={m.id} className="flex gap-2 items-start">
                <span className={`badge ${m.label === "scam" ? "badge-danger" : m.label === "genuine" ? "badge-ok" : "badge-warn"}`}>{m.label}</span>
                <span className="flex-1"><span className="muted">{pkt(m.createdAt)} · {(m.confidence * 100).toFixed(0)}%</span><br />{m.text.slice(0, 80)}…</span>
              </li>
            ))}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
