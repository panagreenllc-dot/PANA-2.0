// Pure incubator constants, validation and status rules (unit-tested). No I/O.
// Phase 3 / P3-1. PANA connects people; it does not give money or equipment, so "needs" are access needs only.
import { parseEasternLocal } from "@/lib/datetime";
import { STAGES } from "@/lib/ideas";

export const NEEDS = [
  { value: "guidance", label: "Guidance and planning" },
  { value: "mentorship", label: "Mentorship" },
  { value: "compute_access", label: "Computer / compute access" },
  { value: "software", label: "Software or tools" },
  { value: "meeting_space", label: "Meeting or work space" },
  { value: "sponsorship", label: "Community or sponsor support" },
  { value: "other", label: "Something else" },
] as const;

export const COHORT_STATUSES = ["draft", "open", "closed", "active", "completed"] as const;
export const COHORT_FORMATS = [
  { value: "virtual", label: "Virtual" }, { value: "hybrid", label: "Hybrid" }, { value: "in_person", label: "In person" },
] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export const APP_STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", under_review: "In review", accepted: "Accepted", waitlisted: "Waitlisted",
  declined: "Not this time", withdrawn: "Withdrawn",
};
export const DECISIONS = ["under_review", "accepted", "waitlisted", "declined"] as const;
export type Decision = (typeof DECISIONS)[number];

export const APP_LIMITS = { goals: [50, 2000], team: 1000, hours: [1, 80], note: 1000, adminNote: 2000, url: 300 } as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** uuid ids only (incubator tables never use the legacy integer ids). */
export function parseUuid(raw: unknown): string | null {
  return typeof raw === "string" && UUID_RE.test(raw.trim()) ? raw.trim().toLowerCase() : null;
}

// ---------- Cohort window ----------

export type CohortLike = {
  status: string;
  apply_opens_at: Date | string | null;
  apply_closes_at: Date | string | null;
};
export type CohortPhase = "draft" | "upcoming" | "open" | "closed" | "running" | "completed";

const t = (v: Date | string | null) => (v === null ? null : new Date(v).getTime());

/** What applicants should see right now. Only "open" accepts applications. */
export function cohortPhase(c: CohortLike, now = new Date()): CohortPhase {
  if (c.status === "draft") return "draft";
  if (c.status === "active") return "running";
  if (c.status === "completed") return "completed";
  if (c.status === "closed") return "closed";
  const n = now.getTime();
  const opens = t(c.apply_opens_at);
  const closes = t(c.apply_closes_at);
  if (opens !== null && n < opens) return "upcoming";
  if (closes !== null && n >= closes) return "closed";
  return "open";
}

// ---------- Decisions ----------

/** Admin decision transitions. Accepted and declined are final; withdrawn belongs to the applicant. */
export function canDecide(from: string, to: string): boolean {
  if (!(DECISIONS as readonly string[]).includes(to) || from === to) return false;
  if (from === "submitted") return true;
  if (from === "under_review") return to !== "under_review";
  if (from === "waitlisted") return to === "accepted" || to === "declined";
  return false;
}

/** The applicant may withdraw until a final decision. */
export function canWithdraw(status: string): boolean {
  return status === "submitted" || status === "under_review" || status === "waitlisted";
}

export function decisionEmailKind(to: string): "accepted" | "waitlisted" | "declined" | null {
  return to === "accepted" || to === "waitlisted" || to === "declined" ? to : null;
}

// ---------- Application form ----------

export type ApplicationInput = {
  cohort_id: string; project_id: string; stage: string; goals: string; weekly_hours: number;
  needs: string[]; team: string; links: Record<string, string>; ack: true;
};
export type ApplicationFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Partial<Record<string, unknown>> };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isUrl = (s: string) => /^https?:\/\/[^\s<>"']+$/i.test(s) && s.length <= APP_LIMITS.url;

export function parseApplication(fd: FormData): { data?: ApplicationInput; state?: ApplicationFormState } {
  const fe: Record<string, string> = {};
  const cohort_id = parseUuid(fd.get("cohort_id")) ?? "";
  const project_id = parseUuid(fd.get("project_id")) ?? "";
  const stage = str(fd, "stage");
  const goals = str(fd, "goals").replace(/\r\n/g, "\n");
  const hoursRaw = str(fd, "weekly_hours");
  const weekly_hours = /^\d{1,2}$/.test(hoursRaw) ? Number(hoursRaw) : NaN;
  const needsRaw = fd.getAll("needs").map(String);
  const allowed = NEEDS.map((n) => n.value as string);
  const needs = [...new Set(needsRaw)].filter((n) => allowed.includes(n));
  const team = str(fd, "team").replace(/\r\n/g, "\n");
  const link = str(fd, "link");
  const ack = fd.get("ack") === "on";

  if (!cohort_id) fe.cohort_id = "Choose a cohort.";
  if (!project_id) fe.project_id = "Choose one of your ideas.";
  if (!STAGES.some((s) => s.value === stage)) fe.stage = "Choose a stage.";
  if (goals.length < APP_LIMITS.goals[0]) fe.goals = `Tell us a bit more (at least ${APP_LIMITS.goals[0]} characters).`;
  if (goals.length > APP_LIMITS.goals[1]) fe.goals = `Keep it under ${APP_LIMITS.goals[1]} characters.`;
  if (!(weekly_hours >= APP_LIMITS.hours[0] && weekly_hours <= APP_LIMITS.hours[1])) fe.weekly_hours = "Enter hours per week (1–80).";
  if (needsRaw.length !== needs.length) fe.needs = "Choose needs from the list.";
  if (team.length > APP_LIMITS.team) fe.team = `Keep it under ${APP_LIMITS.team} characters.`;
  if (link && !isUrl(link)) fe.link = "Use a full link starting with https://";
  if (!ack) fe.ack = "Please confirm you understand how PANA resources work.";

  const values = { cohort_id, project_id, stage, goals, weekly_hours: hoursRaw, needs, team, link };
  if (Object.keys(fe).length) return { state: { error: "Please fix the highlighted fields.", fieldErrors: fe, values } };
  return { data: { cohort_id, project_id, stage, goals, weekly_hours, needs, team, links: link ? { main: link } : {}, ack: true } };
}

// ---------- Cohort form (admin) ----------

export type CohortInput = {
  name: string; slug: string; summary: string | null; format: string; status: CohortStatus;
  apply_opens_at: Date | null; apply_closes_at: Date | null; starts_on: string | null; ends_on: string | null;
  announce_on: string | null; announce_note: string | null; capacity: number | null;
};

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
}

const day = (s: string) => (s === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : undefined);

export function parseCohort(fd: FormData): { data?: CohortInput; error?: string } {
  const name = str(fd, "name");
  const slug = slugify(str(fd, "slug") || name);
  const summary = str(fd, "summary") || null;
  const format = str(fd, "format") || "virtual";
  const status = (str(fd, "status") || "draft") as CohortStatus;
  const opensRaw = str(fd, "apply_opens_at");
  const closesRaw = str(fd, "apply_closes_at");
  const apply_opens_at = opensRaw ? parseEasternLocal(opensRaw) : null;
  const apply_closes_at = closesRaw ? parseEasternLocal(closesRaw) : null;
  const starts_on = day(str(fd, "starts_on"));
  const ends_on = day(str(fd, "ends_on"));
  const announce_on = day(str(fd, "announce_on"));
  const announce_note = str(fd, "announce_note") || null;
  const capRaw = str(fd, "capacity");
  // No fixed number of spots by default (John, Nov 22, 2026): blank = no cap. A number is an internal soft limit only.
  const capacity = capRaw === "" ? null : /^\d{1,3}$/.test(capRaw) ? Number(capRaw) : NaN;

  if (name.length < 2 || name.length > 80) return { error: "Name must be 2–80 characters." };
  if (!slug) return { error: "Add a short web name (slug)." };
  if (summary && summary.length > 1000) return { error: "Summary must be under 1,000 characters." };
  if (!COHORT_FORMATS.some((f) => f.value === format)) return { error: "Choose a format." };
  if (!(COHORT_STATUSES as readonly string[]).includes(status)) return { error: "Choose a status." };
  if ((opensRaw && !apply_opens_at) || (closesRaw && !apply_closes_at)) return { error: "Application dates must be valid ET date-times." };
  if (apply_opens_at && apply_closes_at && apply_closes_at <= apply_opens_at) return { error: "Applications must close after they open." };
  if (starts_on === undefined || ends_on === undefined || announce_on === undefined) return { error: "Program dates must be valid dates." };
  if (starts_on && ends_on && ends_on <= starts_on) return { error: "The program must end after it starts." };
  if (announce_note && announce_note.length > 200) return { error: "The decision note must be under 200 characters." };
  if (announce_note && /tech ?con|announc|public/i.test(announce_note)) return { error: "Decisions are private and sent by email only, so the note can't mention a public announcement." };
  if (capacity !== null && !(capacity >= 1 && capacity <= 500)) return { error: "Leave the soft limit empty (no fixed number), or use 1–500." };
  if (status === "open" && !apply_closes_at) return { error: "Set an application close date before opening the cohort." };
  return { data: { name, slug, summary, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on, announce_on, announce_note, capacity } };
}

/**
 * How applicants hear back. Decisions are private and emailed to each applicant; they're never announced publicly
 * (John, Nov 22, 2026). announce_on = the "emailed by" date; announce_note = an optional extra line for applicants.
 */
export function decisionText(c: { announce_on?: string | null; announce_note?: string | null }, formatDayFn: (d: string) => string): string {
  const when = c.announce_on ? formatDayFn(c.announce_on) : "";
  const base = `Decisions are emailed privately to each applicant${when ? ` by ${when}` : ""}.`;
  return c.announce_note ? `${base} ${c.announce_note.replace(/\.?$/, ".")}` : base;
}

export const COMMUNITY_WELCOME = "There's no fixed number of spots. If you're not placed in a cohort, you're still welcome in the PANA community: post on the community board, find a mentor and keep building with members who support each other.";
