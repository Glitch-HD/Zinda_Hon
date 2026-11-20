import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSessionUser, ROLE_HOME } from "./auth";

/** For server-rendered pages: sends the visitor to login, or to their own home if their role may not see this page. */
export async function pageUser(roles: Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
