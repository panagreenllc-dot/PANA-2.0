// Needs on ideas (P3-2b). Pure rules, unit-tested. Access needs only: PANA never moves money.
import { containsContactInfo } from "@/lib/profile-input";

export const NEED_KINDS = [
  { value: "compute_access", label: "Computer / compute access" },
  { value: "software", label: "Software or tools" },
  { value: "mentorship", label: "Mentorship" },
  { value: "skills", label: "Skills (e.g. a designer or developer)" },
  { value: "meeting_space", label: "Meeting or work space" },
  { value: "equipment_access", label: "Access to equipment" },
  { value: "sponsorship", label: "Sponsorship (given directly by the sponsor)" },
  { value: "other", label: "Other" },
] as const;
export const NEED_STATUSES = ["pending", "changes_requested", "open", "met", "closed"] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];
/** Needs that count toward the per-idea limit. */
export const ACTIVE_NEED_STATUSES: readonly NeedStatus[] = ["pending", "changes_requested", "open"];
export const MAX_ACTIVE_NEEDS = 5;

export const NEED_STATUS_LABEL: Record<string, string> = {
  pending: "In review", changes_requested: "Changes requested", open: "Open", met: "Met", closed: "Closed",
};

export type NeedInput = { kind: string; title: string; details: string | null; amount_text: string | null };

const MONEY_RE = /\$\s?\d|\b\d[\d,.]*\s?(usd|dollars?|bucks)\b/i;

export function parseNeed(fd: FormData): { data?: NeedInput; error?: string } {
  const s = (k: string) => String(fd.get(k) ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  const kind = s("kind");
  const title = s("title");
  const details = s("details").replace(/\r\n/g, "\n") || null;
  const amount_text = s("amount_text") || null;
  if (!NEED_KINDS.some((k) => k.value === kind)) return { error: "Choose what kind of help you need." };
  if (title.length < 3 || title.length > 120) return { error: "The need's title must be 3–120 characters." };
  if (details && details.length > 1000) return { error: "Details must be under 1,000 characters." };
  if (amount_text && amount_text.length > 60) return { error: "\"How much\" must be under 60 characters (e.g. \"10 hrs/week\")." };
  const all = `${title} ${details ?? ""} ${amount_text ?? ""}`;
  if (MONEY_RE.test(all)) return { error: "Needs describe access or help, not money amounts. Sponsors support projects directly." };
  if (containsContactInfo(all)) return { error: "Please don't include email addresses or phone numbers. PANA introduces you when you accept an offer of help." };
  return { data: { kind, title, details, amount_text } };
}

/** Status after the owner edits a need: any text change goes back to review; otherwise unchanged. */
export function needStatusAfterEdit(prev: NeedInput & { status: string }, next: NeedInput): NeedStatus {
  const changed = prev.kind !== next.kind || prev.title !== next.title || (prev.details ?? null) !== next.details || (prev.amount_text ?? null) !== next.amount_text;
  if (prev.status === "changes_requested") return "pending";
  if (!changed) return prev.status as NeedStatus;
  return prev.status === "closed" ? "closed" : "pending";
}

/** Owner status moves that don't need review. */
export function canOwnerSetStatus(from: string, to: string): boolean {
  if (to === "met") return from === "open";
  if (to === "closed") return from !== "closed";
  if (to === "open") return from === "met"; // re-open a met need (text unchanged, already reviewed)
  return false;
}
