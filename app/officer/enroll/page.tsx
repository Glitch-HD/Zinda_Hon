import Header from "@/components/Header";
import EnrollFace from "@/components/EnrollFace";
import { pageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await pageUser(["OFFICER"]);
  const { p } = await searchParams;
  const pensioners = await prisma.pensioner.findMany({ where: { tenantId: user.tenantId }, orderBy: { pensionNo: "asc" }, select: { id: true, name: true, pensionNo: true, enrolledFaceDescriptor: true } });
  return (
    <div className="max-w-3xl mx-auto">
      <Header user={user} links={[{ href: "/officer", label: "← Queue" }]} />
      <h2 className="text-2xl font-bold">📷 Enrol a pensioner&apos;s face</h2>
      <p className="muted mb-1">Fallback only. Most pensioners never come here: with her consent, her face print is taken from her CNIC photo at NADRA (simulated). Use this screen when NADRA has no usable photo, at the office or on a home visit with a helper.</p>
      <p className="muted text-sm mb-4">Prototype rule: use only AI-generated faces or team members who agreed. Only 128 numbers describing the face are stored, never the photo.</p>
      <EnrollFace
        initial={p}
        pensioners={pensioners.map((x) => ({ id: x.id, label: `${x.pensionNo} · ${x.name}`, enrolled: x.enrolledFaceDescriptor.length === 128 }))}
      />
    </div>
  );
}
