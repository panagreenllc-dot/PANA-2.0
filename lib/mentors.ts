// Mentor and investor roles (P3-3). Pure rules, unit-tested. No I/O.
// PANA only introduces people: no money amounts, check sizes or accreditation are ever collected or shown.
import { containsContactInfo } from "@/lib/profile-input";
import { CATEGORIES, STAGES } from "@/lib/ideas";

export const EXPERTISE = [
  { value: "product", label: "Product & UX" },
  { value: "software", label: "Software development" },
  { value: "ai_data", label: "AI & data" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "hardware", label: "Hardware & robotics" },
  { value: "business", label: "Business & strategy" },
  { value: "marketing", label: "Marketing & sales" },
  { value: "fundraising", label: "Fundraising readiness" },
  { value: "legal_ops", label: "Legal & operations basics" },
  { value: "community", label: "Community & nonprofits" },
  { value: "careers", label: "Careers & learning" },
] as const;

export const INVESTOR_TYPES = [
  { value: "angel", label: "Individual (angel)" },
  { value: "fund", label: "Fund" },
  { value: "organization", label: "Company or organization" },
  { value: "grantmaker", label: "Grant-maker or foundation" },
  { value: "other", label: "Other" },
] as const;

export const ROLE_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for PANA review", approved: "Approved", paused: "Paused (not taking requests)",
  declined: "Not approved", revoked: "Removed by PANA",
};

export const MENTOR_LIMITS = { bio: [20, 1000], availability: 60, expertise: 8, maxMentees: [1, 10] } as const;
export const INVESTOR_LIMITS = { bio: [20, 1000], organization: 120 } as const;
/** Per-kind daily limits (on top of the shared 10/day across all request kinds). */
export const MENTORSHIP_PER_DAY = 5;
export const INVESTOR_INTEREST_PER_DAY = 10;

export type MentorInput = { expertise: string[]; bio: string; availability: string | null; max_open_mentees: number };
export type InvestorInput = { investor_type: string; focus_categories: string[]; stage_focus: string[]; organization: string | null; bio: string };

const MONEY_RE = /\$\s?\d|\b\d[\d,.]*\s?(k|m|mm|usd|dollars?|bucks|million|thousand)\b/i;
/** True when text names a money amount or check size ("$5,000", "25k", "2 million"). */
export const hasMoneyAmount = (text: string) => MONEY_RE.test(text);
export const MONEY_ERROR = "Please leave out money amounts and check sizes. PANA only makes introductions.";
const clean = (v: unknown) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\r\n/g, "\n").trim();
const pickAll = (fd: FormData, key: string, allowed: readonly string[]) =>
  [...new Set(fd.getAll(key).map(String).filter((v) => allowed.includes(v)))];

export function parseMentor(fd: FormData): { data?: MentorInput; error?: string } {
  const expertise = pickAll(fd, "expertise", EXPERTISE.map((e) => e.value));
  const bio = clean(fd.get("bio"));
  const availability = clean(fd.get("availability")) || null;
  const max = Number(fd.get("max_open_mentees") ?? 3);
  if (expertise.length < 1 || expertise.length > MENTOR_LIMITS.expertise) return { error: `Pick 1–${MENTOR_LIMITS.expertise} areas you can mentor in.` };
  if (bio.length < MENTOR_LIMITS.bio[0] || bio.length > MENTOR_LIMITS.bio[1]) return { error: `Write ${MENTOR_LIMITS.bio[0]}–${MENTOR_LIMITS.bio[1]} characters about how you can help.` };
  if (availability && availability.length > MENTOR_LIMITS.availability) return { error: `Availability must be under ${MENTOR_LIMITS.availability} characters (e.g. "2 hrs/month").` };
  if (!Number.isInteger(max) || max < MENTOR_LIMITS.maxMentees[0] || max > MENTOR_LIMITS.maxMentees[1]) return { error: "Choose how many mentees you can take at once (1–10)." };
  if (containsContactInfo(`${bio} ${availability ?? ""}`)) return { error: "Please don't include email addresses or phone numbers. PANA introduces you when you accept a request." };
  return { data: { expertise, bio, availability, max_open_mentees: max } };
}

export function parseInvestor(fd: FormData): { data?: InvestorInput; error?: string } {
  const investor_type = clean(fd.get("investor_type"));
  const focus_categories = pickAll(fd, "focus_categories", CATEGORIES);
  const stage_focus = pickAll(fd, "stage_focus", STAGES.map((s) => s.value));
  const organization = clean(fd.get("organization")) || null;
  const bio = clean(fd.get("bio"));
  if (!INVESTOR_TYPES.some((t) => t.value === investor_type)) return { error: "Choose what kind of investor or supporter you are." };
  if (organization && organization.length > INVESTOR_LIMITS.organization) return { error: `Organization must be under ${INVESTOR_LIMITS.organization} characters.` };
  if (bio.length < INVESTOR_LIMITS.bio[0] || bio.length > INVESTOR_LIMITS.bio[1]) return { error: `Write ${INVESTOR_LIMITS.bio[0]}–${INVESTOR_LIMITS.bio[1]} characters about what you look for.` };
  const all = `${bio} ${organization ?? ""}`;
  if (MONEY_RE.test(all)) return { error: MONEY_ERROR };
  if (containsContactInfo(all)) return { error: "Please don't include email addresses or phone numbers. PANA introduces you when an owner accepts." };
  return { data: { investor_type, focus_categories, stage_focus, organization, bio } };
}

/** Status after the member saves their mentor/investor form. A wording change on an approved/paused profile goes back to
 *  review (like ideas and needs); declined members may re-apply; revoked stays revoked (only PANA can restore). */
export function roleStatusAfterSave(prev: { status: string; changed: boolean } | null): string | null {
  if (!prev) return "pending";
  if (prev.status === "revoked") return null; // not allowed
  if (prev.status === "declined") return "pending";
  if (prev.status === "pending") return "pending";
  return prev.changed ? "pending" : prev.status;
}

export function mentorChanged(prev: MentorInput, next: MentorInput): boolean {
  return prev.bio !== next.bio || (prev.availability ?? null) !== next.availability
    || [...prev.expertise].sort().join() !== [...next.expertise].sort().join();
}
export function investorChanged(prev: InvestorInput, next: InvestorInput): boolean {
  return prev.bio !== next.bio || (prev.organization ?? null) !== next.organization || prev.investor_type !== next.investor_type
    || [...prev.focus_categories].sort().join() !== [...next.focus_categories].sort().join()
    || [...prev.stage_focus].sort().join() !== [...next.stage_focus].sort().join();
}

/** Admin decisions allowed from each status. */
export function canAdminDecide(from: string, decision: "approve" | "decline" | "revoke"): boolean {
  if (decision === "approve") return from === "pending" || from === "revoked" || from === "declined";
  if (decision === "decline") return from === "pending";
  return from === "approved" || from === "paused";
}

export const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
