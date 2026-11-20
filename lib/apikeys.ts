import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { HttpError } from "./auth";
import { rateLimit } from "./ratelimit";

// API keys for outside systems (banks, other departments). Only a hash is stored; the full key is shown once.
export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(tenantId: string, name: string, scopes: string[]) {
  const prefix = `zh_${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(24).toString("base64url");
  const full = `${prefix}.${secret}`;
  await prisma.apiKey.create({ data: { tenantId, name, prefix, keyHash: hashKey(full), scopes } });
  return full;
}

export async function requireApiKey(req: Request, scope: string) {
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header || !header.includes(".")) throw new HttpError(401, "Missing API key (send it in the x-api-key header)");
  const prefix = header.split(".")[0];
  const key = await prisma.apiKey.findUnique({ where: { prefix } });
  if (!key || key.revokedAt || key.keyHash !== hashKey(header)) throw new HttpError(401, "Invalid API key");
  if (!key.scopes.includes(scope)) throw new HttpError(403, `This key does not have the "${scope}" scope`);
  await rateLimit(`api:${key.id}`, key.rateLimit, 60);
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}
