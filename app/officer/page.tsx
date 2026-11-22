import EmptyState from "@/components/ui/EmptyState";
import OfficeCharts from "@/components/OfficeCharts";
import SayButton from "@/components/ui/SayButton";
import Link from "next/link";
import Header from "@/components/Header";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { cnicsWithNadraPhoto } from "@/lib/nadra-face";
import { normalizeCnic } from "@/lib/names";
import SignupReview, { type SignupRow } from "@/components/SignupReview";
import { PageTitle, SectionHead, Stat, greeting, initials } from "@/components/ui/Dash";

type Row = { id: string; year: number; status: string; pensioner: { name: string; pensionNo: string } };

function CaseTable({ rows }: { rows: Row[] }) {
  return (
    <div className="card overflow-x-auto" style={{ padding: 8 }}>
      <table className="data">
        <thead><tr><th>Name</th><th>Pension no.</th><th>Status</th><th>Year</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><span className="inline-flex items-center gap-2"><span className="avatar" style={{ width: 30, height: 30, borderRadius: 9, fontSize: ".72rem" }}>{initials(c.pensioner.name)}</span>{c.pensioner.name}</span></td>
              <td className="muted">{c.pensioner.pensionNo}</td>
              <td><span className={STATUS_BADGE[c.status]}>{c.status.replaceAll("_", " ").toLowerCase()}</span></td>
              <td>{c.year}</td>
              <td style={{ textAlign: "right" }}>{c.status === "VERIFIED" || c.status === "STOPPED" ? <Link className="btn btn-ghost btn-sm" href={`/officer/case/${c.id}#reopen`}>View / reopen</Link> : <Link className="btn btn-ghost btn-sm" href={`/officer/case/${c.id}`}>Open</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnrolLink({ p }: { p: { id: string; name: string; pensionNo: string } }) {
  return (
    <Link href={`/officer/enroll?p=${p.id}`} className="mini">
      <span className="avatar">{initials(p.name)}</span>
      <span className="min-w-0"><b className="text-sm">{p.name}</b><small>{p.pensionNo} · tap to enrol</small></span>
    </Link>
  );
}

const STATUS_BADGE: Record<string, string> = {
  WITH_OFFICER: "badge badge-warn", NEEDS_PROOF: "badge", IN_PROGRESS: "badge", DUE: "badge", VERIFIED: "badge badge-ok", STOPPED: "badge badge-danger",
};

export default async function OfficerQueue() {
  const user = await pageUser(["OFFICER"]);
  // All lookups at once (each database round trip costs time on the hosted database).
  const [queue, others, signups, allActive, notes] = await Promise.all([
    // Review queue: highest risk first, then lowest confidence, then oldest.
    prisma.case.findMany({
      where: { tenantId: user.tenantId, status: "WITH_OFFICER" },
      include: { pensioner: { select: { name: true, pensionNo: true, area: true } }, assignedOfficer: { select: { name: true } } },
      orderBy: [{ priority: "desc" }, { confidence: "asc" }, { updatedAt: "asc" }],
    }),
    prisma.case.findMany({
      where: { tenantId: user.tenantId, status: { not: "WITH_OFFICER" } },
      include: { pensioner: { select: { name: true, pensionNo: true } } },
      orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
      take: 120,
    }),
    prisma.registration.findMany({ where: { tenantId: user.tenantId, status: "pending" }, orderBy: { createdAt: "asc" }, take: 30 }),
    // Every active pensioner without a face yet: those with their own app account AND those a helper
    // acts for. (The list column can be empty or NULL, so filter below.)
    prisma.pensioner.findMany({
      where: { tenantId: user.tenantId, status: "active" },
      select: { id: true, name: true, pensionNo: true, cnicMock: true, enrolledFaceDescriptor: true },
      orderBy: { pensionNo: "asc" },
    }),
    prisma.notification.findMany({ where: { userId: user.id, read: false }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  // Only people with NO usable NADRA photo need an office or home visit; the rest give consent in the app.
  const nadra = await cnicsWithNadraPhoto();
  const noFace = allActive.filter((p) => (p.enrolledFaceDescriptor?.length ?? 0) !== 128);
  const notEnrolled = noFace.filter((p) => !nadra.has(normalizeCnic(p.cnicMock) ?? ""));
  const viaNadra = noFace.length - notEnrolled.length;
  const year = new Date().getFullYear();
  const thisYear = others.filter((c) => c.year === year);
  const earlier = others.filter((c) => c.year !== year);
  // Stopped first (most likely to need a second look), then the newest.
  const closedCases = others.filter((c) => c.status === "VERIFIED" || c.status === "STOPPED").sort((a, b) => (a.status === "STOPPED" ? 0 : 1) - (b.status === "STOPPED" ? 0 : 1) || b.year - a.year);
  const dueThisYear = thisYear.filter((c) => c.status !== "VERIFIED" && c.status !== "STOPPED").length;
  const verifiedThisYear = thisYear.filter((c) => c.status === "VERIFIED").length;

  return (
    <div>
      <Header user={user} links={[{ href: "/officer/enroll", label: "Enrol faces", info: { en: "Register a pensioner's face once at the office. Only 128 numbers are stored, never the photo.", ur: "دفتر میں ایک بار چہرہ رجسٹر کریں۔" } }, { href: "/officer/families", label: "Families & helpers", info: { en: "Open this year's cases, link helpers to families with their permission, and accept or reject data corrections.", ur: "کیس کھولیں، مددگار جوڑیں، اور معلومات کی درستی دیکھیں۔" } }, { href: "/officer/pension-books", label: "Pension books", info: { en: "Print pension book QR codes. Each is signed so edits (like a changed amount) are caught.", ur: "پنشن بک کے دستخط شدہ کیو آر پرنٹ کریں۔" } }, { href: "/officer/messages", label: "Scam reviews", info: { en: "Messages the AI was unsure about. Your label also makes the accuracy numbers honest.", ur: "وہ پیغام جن پر اے آئی کو یقین نہیں تھا۔" } }]} />
      <PageTitle
        title={<>{greeting()}, {user.name.split(" ")[0]}</>}
        sub={queue.length ? `${queue.length} case${queue.length > 1 ? "s" : ""} need your decision. Highest risk first.` : "Nothing is waiting for you right now."}
      />
      <div className="stats">
        <Stat n={queue.length} label="Waiting for your review" icon="🧑‍💼" tone={queue.length ? "danger" : "ok"} />
        <Stat n={dueThisYear} label={`Still due in ${year}`} icon="⏳" tone="warn" />
        <Stat n={verifiedThisYear} label={`Verified in ${year}`} icon="✅" tone="ok" />
        <Stat n={notEnrolled.length} label="Need a face visit" icon="📷" tone={notEnrolled.length ? "warn" : "ok"} />
      </div>

      <OfficeCharts tenantId={user.tenantId} />

      {notes.length > 0 && (
        <div className="card card-soft mb-4 text-sm bubble-say"><div><b>{notes.length} new:</b> {notes.map((n) => n.body).join(" · ")}</div><SayButton ur="" en={notes.map((n) => `${n.title}. ${n.body}`).join(" ")} /></div>
      )}

      <SectionHead title="Review queue" count={queue.length} sub="Sorted by risk, then lowest confidence. Only an officer can approve or stop these." />
      {queue.length === 0 && <EmptyState icon="check" en="Nothing waiting" ur="کوئی کیس انتظار میں نہیں" hint="Cases the AI is not sure about will appear here." />}
      {queue.map((c) => (
        <div key={c.id} className="qcard" style={{ borderInlineStartColor: c.priority >= 10 ? "var(--danger)" : "var(--accent)" }}>
          <div className="avatar">{initials(c.pensioner.name)}</div>
          <div className="qcard-main">
            <div className="font-semibold">{c.pensioner.name} <span className="muted text-sm">· {c.pensioner.pensionNo}{c.pensioner.area ? ` · ${c.pensioner.area}` : ""}</span></div>
            <div className="mt-1 flex flex-wrap gap-1">{c.riskFlags.length ? c.riskFlags.map((f) => <span key={f} className="badge badge-danger">{f.replaceAll("_", " ")}</span>) : <span className="badge badge-warn">low confidence</span>}</div>
            <div className="qcard-meta mt-2">
              <span className="inline-flex items-center gap-2">Confidence <span className="meter" aria-hidden><span style={{ width: `${Math.max(3, (c.confidence ?? 0) * 100)}%` }} /></span> {c.confidence === null ? "–" : `${(c.confidence * 100).toFixed(1)}%`}</span>
              <span>Assigned: {c.assignedOfficer?.name ?? "nobody yet"}</span>
            </div>
          </div>
          <Link className="btn" href={`/officer/case/${c.id}`}>Review →</Link>
        </div>
      ))}

      {signups.length > 0 && (
        <>
          <SectionHead title="New sign-ups to check" count={signups.length} sub="People who made an account. Check the records below, then approve or reject. No account works until you do." />
          <SignupReview rows={signups.map((r) => ({ id: r.id, role: r.role, name: r.name, cnic: r.cnic, phone: r.phone, area: r.area, pensionNo: r.pensionNo, createdAt: r.createdAt.toISOString(), checks: r.checks as SignupRow["checks"], details: r.details as SignupRow["details"], assistedBy: r.assistedBy as SignupRow["assistedBy"] }))} />
        </>
      )}

      {notEnrolled.length > 0 && (
        <>
          <SectionHead title="Need an office or home face enrolment" count={notEnrolled.length} sub={`NADRA (simulated) has no usable CNIC photo for these people, so an officer must enrol their face once.${viaNadra ? ` ${viaNadra} other pensioner(s) without a face yet will use their NADRA photo with consent: no visit needed.` : ""}`} />
          <div className="card">
            <div className="mini-grid">
              {notEnrolled.slice(0, 8).map((p) => <EnrolLink key={p.id} p={p} />)}
            </div>
            {notEnrolled.length > 8 && (
              <details className="more mt-2">
                <summary>Show {notEnrolled.length - 8} more</summary>
                <div className="mini-grid mt-2">{notEnrolled.slice(8).map((p) => <EnrolLink key={p.id} p={p} />)}</div>
              </details>
            )}
          </div>
        </>
      )}

      {closedCases.length > 0 && (
        <>
          <SectionHead title="Closed cases (approved or stopped): open one to reopen it" count={closedCases.length} />
          <CaseTable rows={closedCases.slice(0, 12)} />
          {closedCases.length > 12 && (
            <details className="more mt-3">
              <summary>Show {closedCases.length - 12} more closed cases</summary>
              <div className="mt-2"><CaseTable rows={closedCases.slice(12)} /></div>
            </details>
          )}
        </>
      )}

      <SectionHead title={`All cases in ${year}`} count={thisYear.length} />
      <CaseTable rows={thisYear} />
      {earlier.length > 0 && (
        <details className="more mt-3">
          <summary>Earlier years ({earlier.length} closed cases)</summary>
          <div className="mt-2"><CaseTable rows={earlier} /></div>
        </details>
      )}
    </div>
  );
}
