import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handle } from "@/lib/api";

// Lets an open page notice that someone else logged in on this browser (cookies are shared by all tabs).
export const GET = handle(async () => {
  const user = await getSessionUser();
  return NextResponse.json(user ? { id: user.id, name: user.name, role: user.role } : { id: null });
});
