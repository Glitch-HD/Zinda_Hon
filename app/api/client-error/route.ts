import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { recordError } from "@/lib/monitor";

const Body = z.object({ message: z.string().max(2000), stack: z.string().max(8000).optional(), page: z.string().max(300).optional() });

// Phones report their own crashes here (a page that broke, a failed script), so we see problems that
// never reach the server. Anyone can report (crashes happen on the login page too), but it is rate
// limited per address and every field is cut short and scrubbed of numbers.
export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(`clienterr:${ip}`, 20, 3600);
  const body = Body.parse(await req.json().catch(() => ({})));
  const user = await getSessionUser().catch(() => null);
  let page: string | null = null;
  try { page = body.page ? new URL(body.page, "http://x").pathname : null; } catch { /* ignore */ }
  await recordError({ source: "client", route: page, message: body.message, stack: body.stack ?? null, userId: user?.id ?? null, tenantId: user?.tenantId ?? null });
  return NextResponse.json({ ok: true });
});
