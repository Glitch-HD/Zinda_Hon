import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { createApiKey } from "@/lib/apikeys";
import { audit } from "@/lib/audit";

const Body = z.object({ name: z.string().min(2).max(80), scopes: z.array(z.enum(["cases:read", "messages:check", "mock:read"])).min(1) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser(["ADMIN"]);
  const { name, scopes } = Body.parse(await req.json());
  const key = await createApiKey(user.tenantId, name, scopes);
  await audit({ tenantId: user.tenantId, actorType: "USER", actorId: user.id, actorRole: user.role, action: "api_key_created", details: { name, scopes, prefix: key.split(".")[0] } });
  return NextResponse.json({ key, note: "Copy this key now. It will not be shown again." });
});
