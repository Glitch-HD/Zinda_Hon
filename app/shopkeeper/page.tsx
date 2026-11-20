import Header from "@/components/Header";
import MessageChecker from "@/components/MessageChecker";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function Shopkeeper() {
  const user = await pageUser(["SHOPKEEPER"]);
  const mine = await prisma.checkedMessage.findMany({ where: { submittedById: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div>
      <Header user={user} links={[{ href: "/scam-map", label: "🗺️ Scam map" }]} />
      <p className="card mb-3">🏪 Customers show you suspicious &quot;pension&quot; or &quot;relief payment&quot; messages? Check them here before anyone sends money.</p>
      <MessageChecker />
      <div className="card mt-4 max-w-xl mx-auto">
        <h3 className="font-semibold">Your recent checks</h3>
        <ul className="text-sm">{mine.map((m) => <li key={m.id}>{m.createdAt.toISOString().slice(0, 16).replace("T", " ")} · <b>{m.label}</b> ({(m.confidence * 100).toFixed(0)}%) · {m.text.slice(0, 60)}…</li>)}</ul>
      </div>
    </div>
  );
}
