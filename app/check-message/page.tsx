import Header from "@/components/Header";
import MessageChecker from "@/components/MessageChecker";
import { pageUser } from "@/lib/page-auth";
import { ROLE_HOME } from "@/lib/auth";

export default async function CheckMessage() {
  const user = await pageUser(["PENSIONER", "HELPER", "SHOPKEEPER", "OFFICER"]);
  return (<div><Header user={user} links={[{ href: ROLE_HOME[user.role], label: "← Home" }]} /><MessageChecker /></div>);
}
