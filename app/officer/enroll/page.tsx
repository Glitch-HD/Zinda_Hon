import Header from "@/components/Header";
import EnrollFace from "@/components/EnrollFace";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function EnrollPage() {
  const user = await pageUser(["OFFICER"]);
  const pensioners = await prisma.pensioner.findMany({ where: { tenantId: user.tenantId }, orderBy: { pensionNo: "asc" }, select: { id: true, name: true, pensionNo: true, enrolledFaceDescriptor: true } });
  return (
    <div>
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <h2 className="text-xl font-bold">Enrol a pensioner&apos;s face (done once, at the office)</h2>
      <p className="muted mb-3">Prototype rule: use only AI-generated faces or team members who agreed, as cleared by the organisers. Only the 128-number descriptor is stored.</p>
      <EnrollFace pensioners={pensioners.map((p) => ({ id: p.id, label: `${p.pensionNo} · ${p.name}`, enrolled: p.enrolledFaceDescriptor.length === 128 }))} />
    </div>
  );
}
