import Header from "@/components/Header";
import ConsentManager from "@/components/ConsentManager";
import { pageUser } from "@/lib/page-auth";

export default async function ConsentPage() {
  const user = await pageUser(["PENSIONER"]);
  return (
    <div className="max-w-2xl mx-auto">
      <Header user={user} links={[{ href: "/pensioner", label: "← Home", ur: "← واپس" }]} />
      <ConsentManager />
    </div>
  );
}
