// Pure collaboration-request rules (unit-tested).
import { containsContactInfo } from "@/lib/profile-input";

export const REQUEST_EXPIRY_DAYS = 30;
export const MAX_REQUESTS_PER_DAY = 10;
export const MESSAGE_LIMITS = [20, 1000] as const;

export function parseRequestMessage(fd: FormData): { ok: true; message: string } | { ok: false; error: string } {
  const message = String(fd.get("message") ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (message.length < MESSAGE_LIMITS[0] || message.length > MESSAGE_LIMITS[1])
    return { ok: false, error: `Write ${MESSAGE_LIMITS[0]}–${MESSAGE_LIMITS[1]} characters about what you can offer.` };
  if (containsContactInfo(message))
    return { ok: false, error: "Please don't include email addresses or phone numbers. If the owner accepts, PANA introduces you both by email." };
  return { ok: true, message };
}

export function isExpired(createdAt: Date | string, now = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > REQUEST_EXPIRY_DAYS * 24 * 3600 * 1000;
}

export type RequestCheck =
  | { ok: true }
  | { ok: false; reason: "not_member" | "own_idea" | "not_visible" | "rate_limited" | "already_open" };

/** Can this viewer send a request for this idea right now? */
export function canRequest(input: {
  viewerGated: boolean; viewerId: string | null; ownerId: string | null; ideaVisible: boolean;
  sentLast24h: number; hasOpenRequest: boolean;
}): RequestCheck {
  if (!input.viewerGated || !input.viewerId) return { ok: false, reason: "not_member" };
  if (!input.ownerId || input.ownerId === input.viewerId) return { ok: false, reason: "own_idea" };
  if (!input.ideaVisible) return { ok: false, reason: "not_visible" };
  if (input.hasOpenRequest) return { ok: false, reason: "already_open" };
  if (input.sentLast24h >= MAX_REQUESTS_PER_DAY) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}

/** Who may move a request to which status. */
export function canTransition(req: { status: string; owner_user_id: string; requester_user_id: string; created_at: Date | string },
  actor: string, to: "accepted" | "declined" | "withdrawn", now = new Date()): boolean {
  if (req.status !== "pending" || isExpired(req.created_at, now)) return false;
  if (to === "withdrawn") return actor === req.requester_user_id;
  return actor === req.owner_user_id;
}
