// Pure partner / inquiry / offer constants, validation and eligibility rules (unit-tested). No I/O.
// Phase 3 / P3-2a. PANA only connects people: partners provide access directly, and offers have no money amounts.
import { slugify } from "@/lib/incubator";

export const PARTNER_KINDS = [
  { value: "college", label: "College or school" },
  { value: "library", label: "Library" },
  { value: "business", label: "Business" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government" },
  { value: "individual", label: "Individual sponsor" },
  { value: "other", label: "Other" },
] as const;
export const PARTNER_STATUSES = ["pending", "approved", "paused", "removed"] as const;

export const CAN_OFFER = [
  { value: "lab_access", label: "Computer lab access" },
  { value: "library_time", label: "Library computer time" },
  { value: "mentorship", label: "Mentorship hours" },
  { value: "software_credits", label: "Software or cloud credits" },
  { value: "meeting_space", label: "Meeting or work space" },
  { value: "sponsorship", label: "Sponsoring projects directly" },
  { value: "event_support", label: "Event support" },
  { value: "other", label: "Something else" },
] as const;

export const INQUIRY_STATUSES = ["new", "contacted", "converted", "declined", "spam"] as const;

export const OFFER_TYPES = [
  { value: "lab_hours", label: "Computer lab hours" },
  { value: "library_time", label: "Library computer time" },
  { value: "mentorship_hours", label: "Mentorship hours" },
  { value: "software_credits", label: "Software or cloud credits" },
  { value: "meeting_space", label: "Meeting or work space" },
  { value: "sponsor_funding", label: "Sponsor support (paid directly by the sponsor)" },
  { value: "other", label: "Other" },
] as const;
export const ELIGIBILITY = [
  { value: "incubator_participants", label: "Accepted incubator participants" },
  { value: "members", label: "All PANA members" },
  { value: "public", label: "Anyone" },
] as const;
export const CLAIM_METHODS = [
  { value: "show_badge", label: "Show your PANA incubator badge" },
  { value: "request_via_pana", label: "Request through PANA (PANA introduces them)" },
  { value: "external_link", label: "Follow the partner's link" },
] as const;
export const OFFER_STATUSES = ["draft", "pending", "published", "paused", "expired", "archived"] as const;
export const SPONSOR_DIRECT_NOTE = "The sponsor provides this support directly to the participant. PANA doesn't handle money.";

export const label = (list: readonly { value: string; label: string }[], v: string | null | undefined) =>
  list.find((x) => x.value === v)?.label ?? v ?? "";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const multiline = (fd: FormData, k: string) => str(fd, k).replace(/\r\n/g, "\n");
const isUrl = (s: string) => /^https?:\/\/[^\s<>"']+$/i.test(s) && s.length <= 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const day = (s: string) => (s === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : undefined);
const inList = (list: readonly { value: string }[], v: string) => list.some((x) => x.value === v);

// ---------- Public "Become a partner" inquiry ----------

export type InquiryInput = { org_name: string; contact_name: string; contact_email: string; kind: string; can_offer: string[]; message: string | null };
export type InquiryFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, unknown> };

/** Honeypot field name: hidden from people, filled by naive bots. */
export const HONEYPOT = "company_fax";
/** Hidden timestamp: forms submitted faster than this are treated as bots. */
export const MIN_FILL_MS = 2500;

export function isLikelyBot(fd: FormData, now = Date.now()): boolean {
  if (str(fd, HONEYPOT) !== "") return true;
  const started = Number(str(fd, "form_started"));
  return !Number.isFinite(started) || started <= 0 || now - started < MIN_FILL_MS || now - started > 24 * 3600_000;
}

export function parseInquiry(fd: FormData): { data?: InquiryInput; state?: InquiryFormState } {
  const fe: Record<string, string> = {};
  const org_name = str(fd, "org_name");
  const contact_name = str(fd, "contact_name");
  const contact_email = str(fd, "contact_email").toLowerCase();
  const kind = str(fd, "kind") || "other";
  const raw = fd.getAll("can_offer").map(String);
  const can_offer = [...new Set(raw)].filter((v) => inList(CAN_OFFER, v));
  const message = multiline(fd, "message");
  if (org_name.length < 2 || org_name.length > 120) fe.org_name = "Enter your organization's name (2–120 characters).";
  if (contact_name.length < 2 || contact_name.length > 80) fe.contact_name = "Enter your name (2–80 characters).";
  if (!EMAIL_RE.test(contact_email) || contact_email.length > 254) fe.contact_email = "Enter a valid email address.";
  if (!inList(PARTNER_KINDS, kind)) fe.kind = "Choose a type.";
  if (raw.length !== can_offer.length) fe.can_offer = "Choose from the list.";
  if (message.length > 2000) fe.message = "Keep it under 2,000 characters.";
  if ((message.match(/https?:\/\//g) ?? []).length > 2) fe.message = "Please include at most two links.";
  const values = { org_name, contact_name, contact_email, kind, can_offer, message };
  if (Object.keys(fe).length) return { state: { error: "Please fix the highlighted fields.", fieldErrors: fe, values } };
  return { data: { org_name, contact_name, contact_email, kind, can_offer, message: message || null } };
}

// ---------- Partner (admin) ----------

export type PartnerInput = { name: string; slug: string; kind: string; summary: string | null; website: string | null; area: string | null; public_listing: boolean };

export function parsePartner(fd: FormData): { data?: PartnerInput; error?: string } {
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const kind = str(fd, "kind") || "other";
  const summary = multiline(fd, "summary") || null;
  const website = str(fd, "website") || null;
  const area = str(fd, "area") || null;
  const public_listing = fd.get("public_listing") === "on";
  if (name.length < 2 || name.length > 120) return { error: "Name must be 2–120 characters." };
  if (!slug) return { error: "Add a short web name (slug)." };
  if (!inList(PARTNER_KINDS, kind)) return { error: "Choose a partner type." };
  if (summary && summary.length > 1000) return { error: "Summary must be under 1,000 characters." };
  if (website && !isUrl(website)) return { error: "Website must be a full link starting with https://" };
  if (area && area.length > 120) return { error: "Area must be under 120 characters." };
  return { data: { name, slug, kind, summary, website, area, public_listing } };
}

/** Listing text a partner contact may propose from the portal (John approves before it goes live). */
export type ListingChangesInput = { name: string; summary: string | null; website: string | null; area: string | null };
export function parseListingChanges(fd: FormData): { data?: ListingChangesInput; error?: string } {
  const name = str(fd, "name");
  const summary = multiline(fd, "summary") || null;
  const website = str(fd, "website") || null;
  const area = str(fd, "area") || null;
  if (name.length < 2 || name.length > 120) return { error: "Name must be 2–120 characters." };
  if (summary && summary.length > 1000) return { error: "Summary must be under 1,000 characters." };
  if (website && !isUrl(website)) return { error: "Website must be a full link starting with https://" };
  if (area && area.length > 120) return { error: "Area must be under 120 characters." };
  if (EMAIL_RE.test(`${summary ?? ""}`.split(/\s+/).find((w) => w.includes("@")) ?? "")) return { error: "Please don't put email addresses in the public listing." };
  return { data: { name, summary, website, area } };
}

// ---------- Offer (admin) ----------

export type OfferInput = {
  type: string; title: string; description: string | null; location_name: string | null; address: string | null;
  schedule_text: string | null; starts_on: string | null; ends_on: string | null; capacity_text: string | null;
  eligibility: string; cohort_id: string | null; claim_method: string; external_url: string | null; how_to: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseOffer(fd: FormData): { data?: OfferInput; error?: string } {
  const type = str(fd, "type");
  const title = str(fd, "title");
  let description = multiline(fd, "description") || null;
  const location_name = str(fd, "location_name") || null;
  const address = str(fd, "address") || null;
  const schedule_text = str(fd, "schedule_text") || null;
  const starts_on = day(str(fd, "starts_on"));
  const ends_on = day(str(fd, "ends_on"));
  const capacity_text = str(fd, "capacity_text") || null;
  const eligibility = str(fd, "eligibility") || "incubator_participants";
  const cohortRaw = str(fd, "cohort_id");
  const cohort_id = cohortRaw ? (UUID_RE.test(cohortRaw) ? cohortRaw.toLowerCase() : "bad") : null;
  const claim_method = str(fd, "claim_method") || "show_badge";
  const external_url = str(fd, "external_url") || null;
  const how_to = multiline(fd, "how_to") || null;

  if (!inList(OFFER_TYPES, type)) return { error: "Choose an offer type." };
  if (title.length < 3 || title.length > 120) return { error: "Title must be 3–120 characters." };
  if (description && description.length > 2000) return { error: "Description must be under 2,000 characters." };
  if ((location_name?.length ?? 0) > 120 || (address?.length ?? 0) > 200 || (schedule_text?.length ?? 0) > 200 || (capacity_text?.length ?? 0) > 120)
    return { error: "One of the location, schedule or capacity fields is too long." };
  if (starts_on === undefined || ends_on === undefined) return { error: "Dates must be valid." };
  if (starts_on && ends_on && ends_on < starts_on) return { error: "The end date must be on or after the start date." };
  if (!inList(ELIGIBILITY, eligibility)) return { error: "Choose who can use this offer." };
  if (cohort_id === "bad") return { error: "Choose a valid cohort." };
  if (cohort_id && eligibility !== "incubator_participants") return { error: "Only participant offers can be limited to one cohort." };
  if (!inList(CLAIM_METHODS, claim_method)) return { error: "Choose how participants use this offer." };
  if (claim_method === "show_badge" && eligibility !== "incubator_participants") return { error: "\"Show your badge\" only works for incubator participant offers." };
  if (claim_method === "external_link" && !(external_url && isUrl(external_url))) return { error: "Add the partner's link (https://…)." };
  if (claim_method !== "external_link" && external_url) return { error: "Only \"Follow the partner's link\" offers have a link." };
  if (how_to && how_to.length > 1000) return { error: "\"How to use it\" must be under 1,000 characters." };
  if (/\$\s?\d/.test(`${title} ${description ?? ""}`) && type !== "software_credits") return { error: "Offers don't list money amounts. Describe the access instead." };
  if (type === "sponsor_funding" && !(description ?? "").includes(SPONSOR_DIRECT_NOTE)) {
    description = [description, SPONSOR_DIRECT_NOTE].filter(Boolean).join("\n\n").slice(0, 2000);
  }
  return { data: { type, title, description, location_name, address, schedule_text, starts_on, ends_on, capacity_text, eligibility, cohort_id, claim_method, external_url, how_to } };
}

// ---------- Who sees an offer's details ----------

export type OfferViewer = { member: boolean; participantCohorts: string[] };
export type OfferLike = { eligibility: string; cohort_id: string | null };

/** Whether this viewer may see the offer's details and use it. Everyone else sees only who it is for. */
export function canUseOffer(o: OfferLike, v: OfferViewer): boolean {
  if (o.eligibility === "public") return true;
  if (o.eligibility === "members") return v.member;
  if (o.eligibility === "incubator_participants") {
    if (!v.member || v.participantCohorts.length === 0) return false;
    return o.cohort_id === null || v.participantCohorts.includes(o.cohort_id);
  }
  return false;
}

export function audienceLabel(o: OfferLike): string {
  if (o.eligibility === "public") return "Open to everyone";
  if (o.eligibility === "members") return "For PANA members";
  return o.cohort_id ? "For PANA incubator participants (one cohort)" : "For PANA incubator participants";
}

/** "How to use it" line for an offer the viewer can use. */
export function howToUse(o: { claim_method: string; external_url: string | null; how_to: string | null }): { kind: string; text: string; href?: string } {
  if (o.claim_method === "external_link" && o.external_url) return { kind: "link", text: o.how_to || "Follow the partner's link to sign up or book.", href: o.external_url };
  if (o.claim_method === "request_via_pana") return { kind: "request", text: o.how_to || "Send a short request through PANA. If it's accepted, PANA introduces you to the partner by email." };
  return { kind: "badge", text: o.how_to || "Show your PANA incubator badge (My PANA → Badge) and a photo ID at the location.", href: "/me/badge" };
}

/** Badge check page shows only first name and last initial. */
export function badgeDisplayName(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PANA participant";
  const first = parts[0].slice(0, 40);
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}
