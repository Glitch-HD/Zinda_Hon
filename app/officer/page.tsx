import Link from "next/link";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

const STATUS_BADGE: Record<string, string> = {
  WITH_OFFICER: "badge badge-warn", NEEDS_PROOF: "badge", IN_PROGRESS: "badge", DUE: "badge", VERIFIED: "badge badge-ok", STOPPED: "badge badge-danger",
};

export default async function OfficerQueue() {
  const user = await pageUser(["OFFICER"]);
  // Review queue: highest risk first, then lowest confidence, then oldest.
  const queue = await prisma.case.findMany({
    where: { tenantId: user.tenantId, status: "WITH_OFFICER" },
    include: { pensioner: { select: { name: true, pensionNo: true, area: true } }, assignedOfficer: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { confidence: "asc" }, { updatedAt: "asc" }],
  });
  const others = await prisma.case.findMany({
    where: { tenantId: user.tenantId, status: { not: "WITH_OFFICER" } },
    include: { pensioner: { select: { name: true, pensionNo: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  // Every active pensioner without a face yet: those with their own app account AND those a helper
  // acts for. (The list column can be empty or NULL, so filter here.)
  const notEnrolled = (await prisma.pensioner.findMany({
    where: { tenantId: user.tenantId, status: "active" },
    select: { id: true, name: true, pensionNo: true, enrolledFaceDescriptor: true },
    orderBy: { pensionNo: "asc" },
  })).filter((p) => (p.enrolledFaceDescriptor?.length ?? 0) !== 128);
  const notes = await prisma.notification.findMany({ where: { userId: user.id, read: false }, orderBy: { createdAt: "desc" }, take: 5 });

  return (
    <div>
      <Header user={user} links={[{ href: "/officer/enroll", label: "📷 Enrol faces", info: { en: "Register a pensioner's face once at the office. Only 128 numbers are stored, never the photo.", ur: "دفتر میں ایک بار چہرہ رجسٹر کریں۔" } }, { href: "/officer/pension-books", label: "📖 Pension books", info: { en: "Print pension book QR codes. Each is signed so edits (like a changed amount) are caught.", ur: "پنشن بک کے دستخط شدہ کیو آر پرنٹ کریں۔" } }, { href: "/officer/messages", label: "🛡️ Scam reviews", info: { en: "Messages the AI was unsure about. Your label also makes the accuracy numbers honest.", ur: "وہ پیغام جن پر اے آئی کو یقین نہیں تھا۔" } }]} />
      {notEnrolled.length > 0 && (
        <div className="card mb-5" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-lg font-bold">📷 Faces waiting to be enrolled ({notEnrolled.length})</h2>
            <span className="muted text-sm">They (or their helper) cannot do the face check until you enrol them once.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {notEnrolled.map((p) => <Link key={p.id} href={`/officer/enroll?p=${p.id}`} className="btn btn-accent btn-sm">Enrol {p.name} · {p.pensionNo}</Link>)}
          </div>
        </div>
      )}
      {notes.length > 0 && (
        <div className="card mb-4"><b>🔔 {notes.length} new</b>: {notes.map((n) => n.body).join(" · ")}</div>
      )}
      <h2 className="text-xl font-bold mb-2">Review queue ({queue.length})</h2>
      <p className="muted text-sm mb-2">Sorted by risk (highest first), then by confidence (lowest first). Only you can approve or stop these.</p>
      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Pension no.</th><th>Name</th><th>Risk flags</th><th>Confidence</th><th>Priority</th><th>Assigned</th><th></th></tr></thead>
          <tbody>
            {queue.length === 0 && <tr><td colSpan={7} className="muted">Nothing waiting. 🎉</td></tr>}
            {queue.map((c) => (
              <tr key={c.id}>
                <td>{c.pensioner.pensionNo}</td>
                <td>{c.pensioner.name}</td>
                <td>{c.riskFlags.map((f) => <span key={f} className="badge badge-danger mr-1 mb-1">{f.replaceAll("_", " ")}</span>)}</td>
                <td>{c.confidence === null ? "–" : `${(c.confidence * 100).toFixed(2)}%`}</td>
                <td>{c.priority}</td>
                <td>{c.assignedOfficer?.name ?? "–"}</td>
                <td><Link className="btn" href={`/officer/case/${c.id}`}>Review</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-bold mb-2">All other cases</h2>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Pension no.</th><th>Name</th><th>Status</th><th>Year</th><th></th></tr></thead>
          <tbody>
            {others.map((c) => (
              <tr key={c.id}>
                <td>{c.pensioner.pensionNo}</td><td>{c.pensioner.name}</td>
                <td><span className={STATUS_BADGE[c.status]}>{c.status.replaceAll("_", " ").toLowerCase()}</span></td>
                <td>{c.year}</td>
                <td><Link className="btn btn-ghost" href={`/officer/case/${c.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
