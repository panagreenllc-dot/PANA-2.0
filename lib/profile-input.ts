// Pure profile constants + validation (unit-tested). No I/O.

export const ROLES = [
  { value: "developer", label: "Developer" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "student", label: "Student" },
  { value: "designer", label: "Designer" },
  { value: "mentor_interest", label: "Interested in mentoring" },
  { value: "investor_interest", label: "Interested in investing" },
] as const;

export const LOOKING_FOR = [
  { value: "collaborators", label: "Collaborators" },
  { value: "mentorship", label: "Mentorship" },
  { value: "investment", label: "Investment" },
  { value: "projects", label: "Projects to join" },
] as const;

export const LINK_KINDS = [
  { key: "website", label: "Website", hosts: null },
  { key: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { key: "github", label: "GitHub", hosts: ["github.com"] },
  { key: "portfolio", label: "Portfolio", hosts: null },
] as const;

export type LinkKey = (typeof LINK_KINDS)[number]["key"];

export const LIMITS = {
  displayName: [2, 80],
  headline: 120,
  experience: 2000,
  tagCount: 15,
  tagLength: 30,
  url: 200,
} as const;

export type ProfileInput = {
  display_name: string;
  headline: string;
  experience: string;
  roles: string[];
  skills: string[];
  interests: string[];
  looking_for: string[];
  links: Partial<Record<LinkKey, string>>;
};

export type ProfileFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ProfileInput | LinkKey, string>>;
};

const EMAIL_RE = /[A-Z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*(\.|\(dot\)|\[dot\])\s*[A-Z]{2,}/i;
// 10+ digits, optionally separated by spaces, dots, dashes or parentheses, e.g. (772) 555-0100, +1 772.555.0100
const PHONE_RE = /(\+?\d[\s().-]*){10,}/;

/** True if the text looks like it contains an email address or phone number. */
export function containsContactInfo(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

function clean(s: unknown): string {
  // Collapse whitespace and drop control characters (keep newlines for long text).
  return String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
}

export function parseTags(raw: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of String(raw ?? "").split(/[,\n]/)) {
    const tag = clean(t).replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) { seen.add(key); out.push(tag); }
  }
  return out;
}

function pickAllowed(values: FormDataEntryValue[], allowed: readonly { value: string }[]): string[] | null {
  const ok = new Set(allowed.map((a) => a.value));
  const vals = [...new Set(values.map(String))];
  return vals.every((v) => ok.has(v)) ? vals : null;
}

function validUrl(raw: string, hosts: readonly string[] | null): boolean {
  if (raw.length > LIMITS.url) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    if (hosts && !hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseProfile(fd: FormData): { data?: ProfileInput; state?: ProfileFormState } {
  const fe: NonNullable<ProfileFormState["fieldErrors"]> = {};
  const display_name = clean(fd.get("display_name")).replace(/\s+/g, " ");
  const headline = clean(fd.get("headline")).replace(/\s+/g, " ");
  const experience = clean(fd.get("experience"));

  if (display_name.length < LIMITS.displayName[0] || display_name.length > LIMITS.displayName[1])
    fe.display_name = `Name must be ${LIMITS.displayName[0]}–${LIMITS.displayName[1]} characters.`;
  if (headline.length > LIMITS.headline) fe.headline = `Headline can be at most ${LIMITS.headline} characters.`;
  if (experience.length > LIMITS.experience) fe.experience = `Experience can be at most ${LIMITS.experience} characters.`;

  const roles = pickAllowed(fd.getAll("roles"), ROLES);
  if (!roles) fe.roles = "Choose roles from the list.";
  const looking_for = pickAllowed(fd.getAll("looking_for"), LOOKING_FOR);
  if (!looking_for) fe.looking_for = "Choose options from the list.";

  const skills = parseTags(fd.get("skills"));
  const interests = parseTags(fd.get("interests"));
  for (const [k, tags] of [["skills", skills], ["interests", interests]] as const) {
    if (tags.length > LIMITS.tagCount) fe[k] = `Up to ${LIMITS.tagCount} items.`;
    else if (tags.some((t) => t.length > LIMITS.tagLength)) fe[k] = `Each item can be at most ${LIMITS.tagLength} characters.`;
  }

  const links: ProfileInput["links"] = {};
  for (const l of LINK_KINDS) {
    const v = clean(fd.get(`link_${l.key}`));
    if (!v) continue;
    if (!validUrl(v, l.hosts)) fe[l.key] = l.hosts ? `Enter a valid ${l.label} URL (https://${l.hosts[0]}/…).` : "Enter a valid http(s) URL.";
    else links[l.key] = v;
  }

  // Never allow emails or phone numbers in profile text: contact goes through the platform.
  const textFields: [keyof ProfileInput, string][] = [
    ["display_name", display_name], ["headline", headline], ["experience", experience],
    ["skills", skills.join(", ")], ["interests", interests.join(", ")],
  ];
  for (const [k, v] of textFields) {
    if (!fe[k] && containsContactInfo(v)) fe[k] = "Please remove email addresses and phone numbers. Members contact each other through PANA.";
  }

  if (Object.keys(fe).length) return { state: { error: "Please fix the highlighted fields.", fieldErrors: fe } };
  return { data: { display_name, headline, experience, roles: roles!, skills, interests, looking_for: looking_for!, links } };
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam", label: "Scam or fraud" },
  { value: "underage", label: "May be under 18" },
  { value: "other", label: "Other" },
] as const;

export const AUTO_HIDE_REPORTS = 3;

export function parseReport(fd: FormData): { ok: true; reason: string; details: string } | { ok: false; error: string } {
  const reason = String(fd.get("reason") ?? "");
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { ok: false, error: "Choose a reason." };
  const details = clean(fd.get("details"));
  if (details.length > 500) return { ok: false, error: "Details can be at most 500 characters." };
  return { ok: true, reason, details };
}
