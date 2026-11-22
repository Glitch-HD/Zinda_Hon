import Header from "@/components/Header";
import ConsentManager from "@/components/ConsentManager";
import ChangePin from "@/components/ChangePin";
import { pageUser } from "@/lib/page-auth";
import PageVoice from "@/components/PageVoice";

export default async function ConsentPage() {
  const user = await pageUser(["PENSIONER"]);
  return (
    <div className="max-w-2xl mx-auto">
      <PageVoice role="PENSIONER" ur="یہاں دیکھیں کون آپ کی معلومات دیکھ سکتا ہے۔ آپ کسی بھی وقت اجازت واپس لے سکتی ہیں۔" en="Here you can see who can see your information, and take back permission at any time." />
      <Header user={user} links={[{ href: "/pensioner", label: "← Home", ur: "← واپس" }]} />
      <ConsentManager />
      <div className="mt-4"><ChangePin /></div>
    </div>
  );
}
