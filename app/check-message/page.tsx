import Header from "@/components/Header";
import MessageChecker from "@/components/MessageChecker";
import { pageUser } from "@/lib/page-auth";
import PageVoice from "@/components/PageVoice";
import { ROLE_HOME } from "@/lib/auth";

export default async function CheckMessage() {
  const user = await pageUser(["PENSIONER", "HELPER", "SHOPKEEPER", "OFFICER"]);
  return (<div><PageVoice role={user.role} ur="پیغام یہاں لکھیں یا اس کی تصویر لگائیں، پھر جانچیں کا بٹن دبائیں۔ ہم بتائیں گے کہ یہ دھوکہ ہے یا نہیں۔" en="Type or paste the message here, then press Check. We will tell you if it is a scam." /><Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home", ur: "← واپس" }]} /><MessageChecker /></div>);
}
