// Collaboration-request rules. Kept as a thin wrapper over the shared request module (lib/requests.ts).
import { canSend, canTransition as sharedTransition, isExpired, MAX_REQUESTS_PER_DAY, MESSAGE_LIMITS, parseRequestMessage as parseShared, REQUEST_EXPIRY_DAYS } from "@/lib/requests";

export { isExpired, MAX_REQUESTS_PER_DAY, MESSAGE_LIMITS, REQUEST_EXPIRY_DAYS };

export const parseRequestMessage = (fd: FormData) => parseShared(fd, "collab");

export type RequestCheck =
  | { ok: true }
  | { ok: false; reason: "not_member" | "own_idea" | "not_visible" | "rate_limited" | "already_open" };

/** Can this viewer send a request for this idea right now? */
export function canRequest(input: {
  viewerGated: boolean; viewerId: string | null; ownerId: string | null; ideaVisible: boolean;
  sentLast24h: number; hasOpenRequest: boolean;
}): RequestCheck {
  if (input.viewerGated && input.viewerId && !input.ownerId) return { ok: false, reason: "own_idea" };
  const r = canSend({ viewerGated: input.viewerGated, viewerId: input.viewerId, responderIds: [input.ownerId], targetOpen: input.ideaVisible,
    sentLast24h: input.sentLast24h, hasOpenRequest: input.hasOpenRequest });
  if (r.ok) return r;
  return { ok: false, reason: r.reason === "own" ? "own_idea" : (r.reason as Exclude<typeof r.reason, "own" | "not_eligible">) };
}

/** Who may move a request to which status. */
export function canTransition(req: { status: string; owner_user_id: string; requester_user_id: string; created_at: Date | string },
  actor: string, to: "accepted" | "declined" | "withdrawn", now = new Date()): boolean {
  return sharedTransition({ status: req.status, requester: req.requester_user_id, responders: [req.owner_user_id], created_at: req.created_at },
    { id: actor }, to, { now });
}
