import Header from "@/components/Header";
import ReviewButtons from "@/components/ReviewButtons";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function MessageReviews() {
  const user = await pageUser(["OFFICER"]);
  const msgs = await prisma.checkedMessage.findMany({ where: { tenantId: user.tenantId, submittedById: { not: null } }, orderBy: [{ reviewedLabel: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 100 });
  return (
    <div>
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <h2 className="text-xl font-bold mb-2">Checked messages: confirm the true label</h2>
      <p className="muted mb-2">Your labels are the ground truth for the evaluation page (accuracy and false alarms).</p>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Message</th><th>AI said</th><th>Route</th><th>True label</th></tr></thead>
          <tbody>{msgs.map((m) => (
            <tr key={m.id}><td className="text-sm" style={{ maxWidth: 380 }}>{m.text}</td><td>{m.label} ({(m.confidence * 100).toFixed(0)}%)</td><td>{m.route.replaceAll("_", " ")}</td><td><ReviewButtons id={m.id} current={m.reviewedLabel} /></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
