import Link from "next/link";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

// Helper Mode: one shared phone, many families. Each family has its own consent; the helper sees
// only families whose consent is active, and every action is logged against that family.
export default async function HelperHome() {
  const user = await pageUser(["HELPER"]);
  const links = await prisma.helperLink.findMany({
    where: { helperId: user.id, active: true },
    include: { pensioner: { include: { cases: { orderBy: { year: "desc" }, take: 1 }, consents: { where: { granteeId: user.id, withdrawnAt: null } } } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div>
      <Header user={user} links={[{ href: "/check-message", label: "🛡️ Check a message" }]} />
      <h2 className="text-xl font-bold">Families you help ({links.length})</h2>
      <p className="muted mb-3">Tap a family to switch to them. Each family controls their own permission.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ pensioner: p }) => {
          const consent = p.consents[0];
          const c = p.cases[0];
          const canAct = consent?.fields.includes("face") && consent.fields.includes("case_status");
          return (
            <div key={p.id} className="card flex items-center gap-3">
              <div className="text-4xl">{c?.status === "VERIFIED" ? "✅" : c?.status === "WITH_OFFICER" ? "🧑‍💼" : "⏳"}</div>
              <div className="flex-1">
                <div className="font-semibold">{p.name} <span className="ur">{p.nameUr}</span></div>
                <div className="text-sm muted">{p.pensionNo} · {c ? c.status.replaceAll("_", " ").toLowerCase() : "no case"}</div>
                <div className="text-xs">{consent ? `Permission: ${consent.fields.join(", ")}` : "⛔ Permission withdrawn"}</div>
              </div>
              {canAct && c && c.status !== "VERIFIED" ? <Link className="btn" href={`/case/${c.id}`}>Act for</Link> : <span className="badge">{canAct ? "done" : "no permission"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
