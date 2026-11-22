import { getViewer } from "@/lib/members";
import { participantCohorts } from "@/lib/partners-repo";
import type { OfferViewer } from "@/lib/partners";

/** Who is looking at offers: a member who passed the gate, and the cohorts they actively take part in. */
export async function offerViewer(): Promise<OfferViewer & { signedIn: boolean }> {
  const v = await getViewer().catch(() => null);
  const member = v?.status === "ok";
  const cohorts = member && v?.userId ? await participantCohorts(v.userId).catch(() => []) : [];
  return { member, participantCohorts: cohorts, signedIn: !!v?.userId };
}
