import Header from "@/components/Header";
import MessageChecker from "@/components/MessageChecker";
import PublicTop from "@/components/PublicTop";
import PageVoice from "@/components/PageVoice";
import { getSessionUser, ROLE_HOME } from "@/lib/auth";

// Open to everyone: a scam check is most useful BEFORE someone has an account (or when a shopkeeper's
// customer walks in). Logged-in users get their usual header; others get a simple top bar.
export default async function CheckMessage() {
  const user = await getSessionUser();
  return (
    <div>
      <PageVoice role={user?.role ?? "PENSIONER"} ur="پیغام یہاں لکھیں یا اس کی تصویر لگائیں، پھر جانچیں کا بٹن دبائیں۔ ہم بتائیں گے کہ یہ دھوکہ ہے یا نہیں۔" en="Type or paste the message here, then press Check. We will tell you if it is a scam." />
      {user ? <Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home", ur: "← واپس" }]} /> : <PublicTop title="Is this message a scam?" titleUr="کیا یہ پیغام دھوکہ ہے؟" />}
      <MessageChecker />
    </div>
  );
}
