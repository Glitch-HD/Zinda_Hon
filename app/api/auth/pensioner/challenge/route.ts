import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { issueTicket } from "@/lib/liveness";
import { readPensionerLogin } from "@/lib/pensioner-login";

// Login step 2: the SERVER picks the order of movements (blink, turn left/right) and signs it, exactly
// like the yearly proof-of-life check. Only works after her pension book was scanned (step 1).
export const POST = handle(async () => {
  const { pensioner } = await readPensionerLogin();
  await rateLimit(`plogin:challenge:${pensioner.id}`, 20, 600);
  return NextResponse.json(issueTicket(`login:${pensioner.id}`));
});
