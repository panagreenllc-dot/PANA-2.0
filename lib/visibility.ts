// THE gatekeeper: decides what a viewer may see of profiles and ideas. Pure and unit-tested.
// Every member-facing page must build its data through these functions. Emails are never included.

import type { GateStatus } from "@/lib/gate";

export type ViewerCtx = { userId: string | null; status: GateStatus; isAdmin: boolean };
export type Audience = "public" | "members" | "private";

export type ProfileRow = {
  user_id: string;
  display_name: string;
  headline: string | null;
  experience: string | null;
  roles: string[];
  skills: string[];
  interests: string[];
  looking_for: string[];
  links: Record<string, string> | null;
  is_published: boolean;
  moderation: "ok" | "hidden" | string;
  member_status?: string | null; // members.status of the profile owner
  image_url?: string | null;
  updated_at?: Date | string | null;
};

export type ProfileView = Omit<ProfileRow, "member_status" | "moderation" | "is_published"> & {
  isOwner: boolean;
  /** Only set for the owner/admin, so they can see why the profile isn't visible. */
  state?: { is_published: boolean; moderation: string };
};

/** Members-only area: signed-in, 18+/Terms done, not banned. Admins always qualify. */
export function isGatedMember(v: ViewerCtx): boolean {
  return v.isAdmin || v.status === "ok";
}

export function canViewProfile(v: ViewerCtx, p: Pick<ProfileRow, "user_id" | "is_published" | "moderation" | "member_status">): boolean {
  if (!v.userId) return false;
  if (v.isAdmin) return true;
  if (v.userId === p.user_id) return v.status === "ok"; // owners see their own (even unpublished/hidden)
  if (v.status !== "ok") return false;
  return p.is_published && p.moderation === "ok" && (p.member_status ?? "active") === "active";
}

export function toProfileView(v: ViewerCtx, p: ProfileRow): ProfileView | null {
  if (!canViewProfile(v, p)) return null;
  const isOwner = v.userId === p.user_id;
  const view: ProfileView = {
    user_id: p.user_id,
    display_name: p.display_name,
    headline: p.headline,
    experience: p.experience,
    roles: p.roles ?? [],
    skills: p.skills ?? [],
    interests: p.interests ?? [],
    looking_for: p.looking_for ?? [],
    links: sanitizeLinks(p.links),
    image_url: p.image_url ?? null,
    updated_at: p.updated_at ?? null,
    isOwner,
  };
  if (isOwner || v.isAdmin) view.state = { is_published: p.is_published, moderation: p.moderation };
  return view;
}

function sanitizeLinks(links: Record<string, string> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, url] of Object.entries(links ?? {})) {
    if (typeof url === "string" && /^https?:\/\//i.test(url) && !/^mailto:|^tel:/i.test(url)) out[k] = url;
  }
  return out;
}

// ---------- Ideas ----------

export type IdeaRow = {
  id: string;
  user_id: string | null;
  project_name: string;
  category: string | null;
  description: string | null;
  website: string | null;
  details: string | null;
  help_needed: string[] | null;
  kind: string;
  stage: string;
  status: string;
  audience: "public" | "members" | string;
  field_visibility: Partial<Record<"details" | "website" | "help_needed", Audience>> | null;
  hidden_by_reports: boolean;
  created_at?: Date | string | null;
};

export type IdeaView = {
  id: string;
  project_name: string;
  category: string | null;
  description: string | null;
  kind: string;
  stage: string;
  website?: string;
  details?: string;
  help_needed?: string[];
};

const FIELD_DEFAULTS: Record<"details" | "website" | "help_needed", Audience> = {
  details: "members", website: "public", help_needed: "public",
};

function canSeeLevel(v: ViewerCtx, level: Audience, ownerId: string | null): boolean {
  if (v.isAdmin || (v.userId && v.userId === ownerId)) return true;
  if (level === "public") return true;
  if (level === "members") return v.status === "ok";
  return false; // private: owner + admin only
}

/** Card-level visibility. Only approved, non-hidden ideas are shown to anyone but the owner/admin. */
export function canViewIdea(v: ViewerCtx, i: Pick<IdeaRow, "user_id" | "status" | "audience" | "hidden_by_reports">): boolean {
  if (v.isAdmin || (v.userId && v.userId === i.user_id)) return true;
  if (i.status !== "approved" || i.hidden_by_reports) return false;
  if (i.audience === "public") return true;
  if (i.audience === "members") return v.status === "ok";
  return false;
}

export function toIdeaView(v: ViewerCtx, i: IdeaRow): IdeaView | null {
  if (!canViewIdea(v, i)) return null;
  const fv = { ...FIELD_DEFAULTS, ...(i.field_visibility ?? {}) };
  const out: IdeaView = {
    id: String(i.id), project_name: i.project_name, category: i.category, description: i.description,
    kind: i.kind, stage: i.stage,
  };
  if (i.website && canSeeLevel(v, fv.website, i.user_id)) out.website = i.website;
  if (i.details && canSeeLevel(v, fv.details, i.user_id)) out.details = i.details;
  if (i.help_needed?.length && canSeeLevel(v, fv.help_needed, i.user_id)) out.help_needed = i.help_needed;
  return out;
}
