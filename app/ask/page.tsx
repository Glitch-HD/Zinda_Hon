import Header from "@/components/Header";
import AskBox from "@/components/AskBox";
import PublicTop from "@/components/PublicTop";
import PageVoice from "@/components/PageVoice";
import { getSessionUser, ROLE_HOME } from "@/lib/auth";

// Open to everyone: the pension rules are public information, answered only from the rulebook, with sources.
export default async function Ask() {
  const user = await getSessionUser();
  return (
    <div>
      <PageVoice role={user?.role ?? "PENSIONER"} ur="پنشن کے بارے میں اپنا سوال بولیں یا لکھیں۔ جواب سرکاری قواعد سے دیا جائے گا۔" en="Say or type your question about the pension. The answer comes from the official rules." />
      {user ? <Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home", ur: "← واپس" }]} /> : <PublicTop title="Pension rules: ask a question" titleUr="پنشن کے قواعد: سوال پوچھیں" />}
      <AskBox />
    </div>
  );
}
