import { prisma } from "./db";
import { faceDistance } from "./case-service";

// "Is this face somebody ELSE we know?" A face can be close enough to the claimed person and still be
// closer to another registered pensioner, for example a sister or a mother and daughter who look alike.
// Comparing against everyone enrolled in the office catches a relative who is registered herself.

export type OtherMatch = { pensionNo: string; distance: number } | null;

export async function closestOtherPensioner(tenantId: string, pensionerId: string, descriptor: number[]): Promise<OtherMatch> {
  const others = await prisma.pensioner.findMany({ where: { tenantId, id: { not: pensionerId } }, select: { pensionNo: true, enrolledFaceDescriptor: true } });
  let best: OtherMatch = null;
  for (const o of others) {
    if (o.enrolledFaceDescriptor.length !== 128) continue;
    const d = faceDistance(o.enrolledFaceDescriptor, descriptor);
    if (d !== null && (!best || d < best.distance)) best = { pensionNo: o.pensionNo, distance: d };
  }
  return best;
}

/** True when the face looks at least as much like another registered person as like the claimed one. */
export function looksLikeSomeoneElse(own: number | null, other: OtherMatch, looseDistance: number) {
  if (!other || other.distance > looseDistance) return false;
  return own === null || other.distance <= own + 0.05;
}
