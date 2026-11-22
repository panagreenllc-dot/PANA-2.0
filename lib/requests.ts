// Shared request + introduction rules for every brokered request on PANA (unit-tested, pure).
// Kinds: collaboration requests on ideas, help offers on needs, and "Request through PANA" offer requests.
// plus (P3-3) mentorship requests to approved mentors and investor interest on ideas open to it. The flow is always the same:
//   someone sends a short note (no contact details) → the responder accepts or declines →
//   only on accept does PANA send ONE introduction email that shares both addresses. Nothing is shown on the site.
import { containsContactInfo } from "@/lib/profile-input";

export const REQUEST_KINDS = ["collab", "help", "offer", "mentorship", "investor"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_EXPIRY_DAYS = 30;
export const MAX_REQUESTS_PER_DAY = 10;
export const MESSAGE_LIMITS = [20, 1000] as const;

export const KIND_INFO: Record<RequestKind, { label: string; plural: string; path: (id: string) => string; prompt: string }> = {
  collab: { label: "Collaboration request", plural: "Collaboration", path: (id) => `/me/requests/${id}`, prompt: "what you can offer" },
  help: { label: "Help offer", plural: "Help offers", path: (id) => `/me/requests/help/${id}`, prompt: "how you can help" },
  offer: { label: "Offer request", plural: "Offer requests", path: (id) => `/me/requests/offers/${id}`, prompt: "what you'd like to use and when" },
  mentorship: { label: "Mentorship request", plural: "Mentorship", path: (id) => `/me/requests/mentorship/${id}`, prompt: "what you'd like help with" },
  investor: { label: "Investor interest", plural: "Investor interest", path: (id) => `/me/requests/investor/${id}`, prompt: "why this idea interests you" },
};

export const isRequestKind = (v: unknown): v is RequestKind => typeof v === "string" && (REQUEST_KINDS as readonly string[]).includes(v);

export function parseRequestMessage(fd: FormData, kind: RequestKind = "collab"): { ok: true; message: string } | { ok: false; error: string } {
  const message = String(fd.get("message") ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (message.length < MESSAGE_LIMITS[0] || message.length > MESSAGE_LIMITS[1])
    return { ok: false, error: `Write ${MESSAGE_LIMITS[0]}–${MESSAGE_LIMITS[1]} characters about ${KIND_INFO[kind].prompt}.` };
  if (containsContactInfo(message))
    return { ok: false, error: "Please don't include email addresses or phone numbers. If they accept, PANA introduces you both by email." };
  return { ok: true, message };
}

export function isExpired(createdAt: Date | string, now = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() > REQUEST_EXPIRY_DAYS * 24 * 3600 * 1000;
}

export function expiresOn(createdAt: Date | string): Date {
  return new Date(new Date(createdAt).getTime() + REQUEST_EXPIRY_DAYS * 86400000);
}

export type SendReason = "not_member" | "own" | "not_visible" | "rate_limited" | "already_open" | "not_eligible";
export type SendCheck = { ok: true } | { ok: false; reason: SendReason };

/** Can this viewer send a request right now? `targetOpen` = the idea/need/offer is live and visible to them. */
export function canSend(input: {
  viewerGated: boolean; viewerId: string | null; responderIds: (string | null)[]; targetOpen: boolean;
  eligible?: boolean; sentLast24h: number; hasOpenRequest: boolean;
  /** Optional per-kind cap (e.g. 5 mentorship requests a day), checked on top of the shared daily limit. */
  kindSentLast24h?: number; kindLimit?: number;
}): SendCheck {
  if (!input.viewerGated || !input.viewerId) return { ok: false, reason: "not_member" };
  if (input.responderIds.includes(input.viewerId)) return { ok: false, reason: "own" };
  if (!input.targetOpen) return { ok: false, reason: "not_visible" };
  if (input.eligible === false) return { ok: false, reason: "not_eligible" };
  if (input.hasOpenRequest) return { ok: false, reason: "already_open" };
  if (input.sentLast24h >= MAX_REQUESTS_PER_DAY) return { ok: false, reason: "rate_limited" };
  if (input.kindLimit !== undefined && (input.kindSentLast24h ?? 0) >= input.kindLimit) return { ok: false, reason: "rate_limited" };
  return { ok: true };
}

export const SEND_ERRORS: Record<SendReason, string> = {
  not_member: "Please finish joining PANA first.",
  own: "You can't send a request to yourself.",
  not_visible: "This isn't open for requests right now.",
  not_eligible: "This offer isn't open to you.",
  already_open: "You already have an open request here.",
  rate_limited: "You've sent the maximum number of requests for today. Please try again tomorrow.",
};

/**
 * Who may move a request to which status. `responders` are the people who may accept/decline
 * (the idea owner; for offers, the partner's contacts). Admins may answer offer requests (`adminMayRespond`).
 */
export function canTransition(req: { status: string; requester: string; responders: string[]; created_at: Date | string },
  actor: { id: string; isAdmin?: boolean }, to: "accepted" | "declined" | "withdrawn", opts: { adminMayRespond?: boolean; now?: Date } = {}): boolean {
  if (req.status !== "pending" || isExpired(req.created_at, opts.now)) return false;
  if (to === "withdrawn") return actor.id === req.requester;
  if (actor.id === req.requester) return false;
  return req.responders.includes(actor.id) || (!!opts.adminMayRespond && !!actor.isAdmin);
}

/** Which side of a request the viewer is on (for list/detail pages). */
export function sideOf(req: { requester: string; responders: string[] }, viewerId: string, isAdmin = false): "sent" | "received" | "admin" | null {
  if (viewerId === req.requester) return "sent";
  if (req.responders.includes(viewerId)) return "received";
  return isAdmin ? "admin" : null;
}
