import { NextResponse } from "next/server";
import { requireUser, setSessionCookie, SESSION_MINUTES } from "@/lib/auth";
import { handle } from "@/lib/api";

// Called by the page while the person is active, so the 10-minute timeout only counts idle time.
export const POST = handle(async () => {
  const user = await requireUser();
  await setSessionCookie(user);
  return NextResponse.json({ ok: true, minutes: SESSION_MINUTES });
});
