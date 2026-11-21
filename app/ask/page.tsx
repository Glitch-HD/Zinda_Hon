import Header from "@/components/Header";
import AskBox from "@/components/AskBox";
import { pageUser } from "@/lib/page-auth";
import PageVoice from "@/components/PageVoice";
import { ROLE_HOME } from "@/lib/auth";

export default async function Ask() {
  const user = await pageUser(["PENSIONER", "HELPER", "SHOPKEEPER", "OFFICER"]);
  return (<div><PageVoice role={user.role} ur="پنشن کے بارے میں اپنا سوال بولیں یا لکھیں۔ جواب سرکاری قواعد سے دیا جائے گا۔" en="Say or type your question about the pension. The answer comes from the official rules." /><Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home", ur: "← واپس" }]} /><AskBox /></div>);
}
