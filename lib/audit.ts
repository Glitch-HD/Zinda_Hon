import type { ActorType, Prisma } from "@prisma/client";
import { prisma } from "./db";

// Append-only audit trail of every user, AI, agent and system action (brief: "Audit log of every user, AI, and agent action").
// There is deliberately no update or delete function for audit rows anywhere in the codebase.
export async function audit(entry: {
  tenantId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({ data: { ...entry, tenantId: entry.tenantId ?? null } });
  } catch (err) {
    // Never let a logging failure crash the user's flow, but make it visible in server logs.
    console.error("[audit] failed to write audit log", entry.action, err);
  }
}
