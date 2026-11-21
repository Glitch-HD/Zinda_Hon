import { notFound } from "next/navigation";
import Header from "@/components/Header";
import CaseFlow from "@/components/CaseFlow";
import { pageUser } from "@/lib/page-auth";
import { loadCaseFor } from "@/lib/case-access";
import { HttpError } from "@/lib/auth";
import { issueTicket } from "@/lib/liveness";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(["PENSIONER", "HELPER"]);
  const { id } = await params;
  let c;
  try {
    c = await loadCaseFor(user, id, "face");
  } catch (e) {
    if (e instanceof HttpError) {
      return (
        <div><Header user={user} /><div className="card">{e.status === 403 ? "This person has not given you permission, or has withdrawn it. / اجازت نہیں ہے۔" : "Case not found."}</div></div>
      );
    }
    throw e;
  }
  if (!c) notFound();
  return (
    <div>
      <Header user={user} links={[{ href: user.role === "HELPER" ? "/helper" : "/pensioner", label: "← Back", ur: "← واپس" }]} />
      {user.role === "HELPER" && <div className="card mb-3">Helper Mode: acting for <b>{c.pensioner.name}</b> <span className="ur">{c.pensioner.nameUr}</span>. Hand the phone to them for the photo.</div>}
      <CaseFlow caseId={c.id} pensionerId={c.pensioner.id} pensionerName={c.pensioner.nameUr ?? c.pensioner.name} enrolled={c.pensioner.enrolledFaceDescriptor.length === 128} initialStatus={c.status} initialTicket={["VERIFIED", "STOPPED", "WITH_OFFICER"].includes(c.status) ? null : issueTicket(c.id)} />
    </div>
  );
}
