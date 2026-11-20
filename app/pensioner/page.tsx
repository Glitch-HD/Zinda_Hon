import Link from "next/link";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function PensionerHome() {
  const user = await pageUser(["PENSIONER"]);
  const p = await prisma.pensioner.findUnique({ where: { userId: user.id }, include: { cases: { orderBy: { year: "desc" }, take: 1 } } });
  const c = p?.cases[0];
  return (
    <div className="max-w-xl mx-auto">
      <Header user={user} links={[{ href: "/consent", label: "🔐 My data" }, { href: "/ask", label: "❓ Ask" }]} />
      {!p || !c ? (
        <div className="card">No pension record linked to this account.</div>
      ) : (
        <div className="space-y-4">
          <div className="card text-center space-y-2">
            <div className="text-6xl">{c.status === "VERIFIED" ? "✅" : c.status === "WITH_OFFICER" ? "🧑‍💼" : "⏳"}</div>
            <p className="ur text-2xl">
              {c.status === "VERIFIED" ? "اس سال کا ثبوتِ حیات مکمل ہے" : c.status === "WITH_OFFICER" ? "پنشن افسر آپ کا کیس دیکھ رہا ہے" : "اس سال کا ثبوتِ حیات باقی ہے"}
            </p>
            <p className="muted">{c.year} proof-of-life: {c.status.replaceAll("_", " ").toLowerCase()}</p>
          </div>
          {c.status !== "VERIFIED" && c.status !== "WITH_OFFICER" && c.status !== "STOPPED" && (
            <Link href={`/case/${c.id}`} className="btn btn-big"><span className="text-3xl">▶️</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">ابھی شروع کریں</span><span className="text-sm font-semibold opacity-90">Start now</span></span></Link>
          )}
          <Link href="/check-message" className="btn btn-big btn-ghost"><span className="text-3xl">🛡️</span><span className="flex flex-col items-start leading-tight"><span className="ur text-2xl">کیا یہ پیغام اصلی ہے؟</span><span className="text-sm font-semibold opacity-90">Is this message real?</span></span></Link>
        </div>
      )}
    </div>
  );
}
