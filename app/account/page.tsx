import Header from "@/components/Header";
import ChangePassword from "@/components/ChangePassword";
import { pageUser } from "@/lib/page-auth";
import { ROLE_HOME } from "@/lib/auth";

export default async function AccountPage() {
  const user = await pageUser(["HELPER", "SHOPKEEPER", "OFFICER", "ADMIN", "AUDITOR"]);
  return (
    <div className="max-w-xl mx-auto">
      <Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home", ur: "← واپس" }]} />
      <ChangePassword />
    </div>
  );
}
