// Pure idea constants, validation and re-moderation rules (unit-tested). No I/O.
import { containsContactInfo } from "@/lib/profile-input";
import type { Audience } from "@/lib/visibility";

export const CATEGORIES = ["AI", "Startup", "Cybersecurity", "Robotics", "Blockchain", "Community", "Other"] as const;
export const KINDS = [
  { value: "idea", label: "Idea" }, { value: "project", label: "Project" }, { value: "startup", label: "Startup" },
] as const;
export const STAGES = [
  { value: "concept", label: "Concept" }, { value: "building", label: "Building" },
  { value: "launched", label: "Launched" }, { value: "growing", label: "Growing" },
] as const;
export const HELP_NEEDED = [
  { value: "developer", label: "Developer" }, { value: "designer", label: "Designer" },
  { value: "cofounder", label: "Co-founder" }, { value: "mentor", label: "Mentor" },
  { value: "funding", label: "Funding" }, { value: "testers", label: "Testers" },
  { value: "marketing", label: "Marketing" },
] as const;
export const AUDIENCES = [
  { value: "public", label: "Everyone" }, { value: "members", label: "Signed-in members only" },
] as const;
export const FIELD_LEVELS: { value: Audience; label: string }[] = [
  { value: "public", label: "Public" }, { value: "members", label: "Members only" }, { value: "private", label: "Private (only me)" },
];
export const PRIVACY_FIELDS = ["details", "website", "help_needed"] as const;
export type PrivacyField = (typeof PRIVACY_FIELDS)[number];

export const LIMITS = { name: [2, 80], description: [30, 1000], details: 4000, url: 300 } as const;
export const MAX_PENDING_PER_USER = 3;

export type IdeaInput = {
  project_name: string;
  category: string;
  kind: string;
  stage: string;
  description: string;
  details: string;
  website: string;
  help_needed: string[];
  audience: "public" | "members";
  field_visibility: Record<PrivacyField, Audience>;
};

export type IdeaFormState = {
  ok?: boolean;
  error?: string;
  notice?: string;
  fieldErrors?: Partial<Record<keyof IdeaInput | `vis_${PrivacyField}`, string>>;
  values?: Partial<IdeaInput>;
};

const clean = (v: unknown) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
const oneOf = (v: string, list: readonly { value: string }[]) => list.some((x) => x.value === v);

export function parseIdea(fd: FormData): { data?: IdeaInput; state?: IdeaFormState } {
  const fe: NonNullable<IdeaFormState["fieldErrors"]> = {};
  const v = {
    project_name: clean(fd.get("project_name")).replace(/\s+/g, " "),
    category: clean(fd.get("category")),
    kind: clean(fd.get("kind")) || "idea",
    stage: clean(fd.get("stage")) || "concept",
    description: clean(fd.get("description")),
    details: clean(fd.get("details")),
    website: clean(fd.get("website")),
    help_needed: [...new Set(fd.getAll("help_needed").map(String))],
    audience: (clean(fd.get("audience")) || "public") as IdeaInput["audience"],
    field_visibility: {
      details: (clean(fd.get("vis_details")) || "members") as Audience,
      website: (clean(fd.get("vis_website")) || "public") as Audience,
      help_needed: (clean(fd.get("vis_help_needed")) || "public") as Audience,
    },
  };

  if (v.project_name.length < LIMITS.name[0] || v.project_name.length > LIMITS.name[1]) fe.project_name = "Name must be 2–80 characters.";
  if (!(CATEGORIES as readonly string[]).includes(v.category)) fe.category = "Choose a category from the list.";
  if (!oneOf(v.kind, KINDS)) fe.kind = "Choose a type from the list.";
  if (!oneOf(v.stage, STAGES)) fe.stage = "Choose a stage from the list.";
  if (v.description.length < LIMITS.description[0] || v.description.length > LIMITS.description[1]) fe.description = "Short description must be 30–1000 characters.";
  if (v.details.length > LIMITS.details) fe.details = `Details can be at most ${LIMITS.details} characters.`;
  if (!v.help_needed.every((h) => oneOf(h, HELP_NEEDED))) fe.help_needed = "Choose options from the list.";
  if (!oneOf(v.audience, AUDIENCES)) fe.audience = "Choose who can see this idea.";
  for (const f of PRIVACY_FIELDS) if (!FIELD_LEVELS.some((l) => l.value === v.field_visibility[f])) fe[`vis_${f}`] = "Choose a visibility.";
  if (v.website) {
    try {
      const u = new URL(v.website);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || v.website.length > LIMITS.url) throw new Error();
    } catch {
      fe.website = "Enter a valid http(s) URL, or leave it blank.";
    }
  }
  // Brokered contact: no emails or phone numbers in idea text.
  for (const k of ["project_name", "description", "details"] as const) {
    if (!fe[k] && containsContactInfo(v[k])) fe[k] = "Please remove email addresses and phone numbers. Members contact you through PANA.";
  }

  if (Object.keys(fe).length) return { state: { error: "Please fix the highlighted fields.", fieldErrors: fe, values: v } };
  return { data: v };
}

/** Text whose change on an approved idea sends it back to review (D8). */
export const PUBLIC_TEXT_FIELDS = ["project_name", "description", "details", "website"] as const;

export type ExistingIdea = { status: string } & Partial<Record<(typeof PUBLIC_TEXT_FIELDS)[number], string | null>>;

/**
 * Status after an owner edit:
 * - approved + public text changed → pending (hidden until re-approved)
 * - approved + only privacy/stage/help changed → stays approved
 * - changes_requested / rejected → pending (resubmitted)
 * - pending stays pending; withdrawn stays withdrawn
 */
export function statusAfterOwnerEdit(prev: ExistingIdea, next: Pick<IdeaInput, (typeof PUBLIC_TEXT_FIELDS)[number]>): string {
  if (prev.status === "approved") {
    const changed = PUBLIC_TEXT_FIELDS.some((k) => (prev[k] ?? "").trim() !== (next[k] ?? "").trim());
    return changed ? "pending" : "approved";
  }
  if (prev.status === "changes_requested" || prev.status === "rejected") return "pending";
  return prev.status;
}
