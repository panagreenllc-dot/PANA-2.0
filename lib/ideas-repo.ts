import sql, { raw, type Row } from "@/lib/db";
import { likePattern } from "@/lib/profile-sql";
import { AUTO_HIDE_REPORTS } from "@/lib/profile-input";
import { statusAfterOwnerEdit, type IdeaInput } from "@/lib/ideas";
import { BROWSE_SQL, IDEA_AUTO_HIDE_SQL, IDEA_REPORT_INSERT_SQL, REQUEST_INSERT_SQL } from "@/lib/idea-sql";
import { ideaReviewEmail, sendEmail } from "@/lib/email";
import * as R from "@/lib/requests-repo";
import type { IdeaRow } from "@/lib/visibility";

const q = (text: string, params: unknown[]) => raw().query(text, params) as Promise<Row[]>;

export type BrowseFilters = { category?: string; kind?: string; stage?: string; help?: string; needs?: boolean; q?: string; limit?: number; offset?: number };

export async function browseIdeas(viewerGated: boolean, f: BrowseFilters): Promise<{ rows: (IdeaRow & { name: string | null })[]; total: number }> {
  const text = (f.q ?? "").trim().slice(0, 80);
  const rows = await q(BROWSE_SQL, [viewerGated, f.category || null, f.kind || null, f.stage || null, f.help || null,
    text, likePattern(text), Math.min(f.limit ?? 24, 50), Math.max(0, f.offset ?? 0), !!f.needs]);
  return { rows: rows as (IdeaRow & { name: string | null })[], total: (rows[0]?.total as number) ?? 0 };
}

export async function getIdea(id: string): Promise<(IdeaRow & { name: string | null; owner_edited_at: string | null; moderation_note: string | null }) | null> {
  const rows = await sql`
    SELECT id, user_id, name, project_name, category, description, website, details, help_needed, kind, stage, status,
           audience, field_visibility, hidden_by_reports, moderation_note, owner_edited_at, created_at, updated_at
    FROM projects WHERE id::text = ${id}`;
  return (rows[0] as never) ?? null;
}

export async function countPending(userId: string): Promise<number> {
  const [r] = await sql`SELECT count(*)::int AS n FROM projects WHERE user_id = ${userId} AND status = 'pending'`;
  return r?.n ?? 0;
}

export async function createIdea(userId: string, name: string, d: IdeaInput): Promise<string> {
  // D7: no email is stored on the idea.
  const [r] = await sql`
    INSERT INTO projects (name, project_name, category, description, website, user_id, status,
                          kind, stage, details, help_needed, audience, field_visibility)
    VALUES (${name}, ${d.project_name}, ${d.category}, ${d.description}, ${d.website || null}, ${userId}, 'pending',
            ${d.kind}, ${d.stage}, ${d.details || null}, ${d.help_needed}, ${d.audience}, ${JSON.stringify(d.field_visibility)}::jsonb)
    RETURNING id::text AS id`;
  return r.id;
}

/** Owner edit. Returns the new status, or null if not found / not the owner. */
export async function updateIdeaByOwner(id: string, userId: string, d: IdeaInput): Promise<{ status: string; reReview: boolean } | null> {
  const prev = await getIdea(id);
  if (!prev || prev.user_id !== userId) return null;
  const status = statusAfterOwnerEdit(prev as never, d);
  await sql`
    UPDATE projects SET project_name = ${d.project_name}, category = ${d.category}, description = ${d.description},
      website = ${d.website || null}, kind = ${d.kind}, stage = ${d.stage}, details = ${d.details || null},
      help_needed = ${d.help_needed}, audience = ${d.audience}, field_visibility = ${JSON.stringify(d.field_visibility)}::jsonb,
      status = ${status}, owner_edited_at = now(), updated_at = now(),
      reviewed_at = CASE WHEN ${status} = 'pending' THEN NULL ELSE reviewed_at END
    WHERE id::text = ${id} AND user_id = ${userId}`;
  return { status, reReview: prev.status !== "pending" && status === "pending" };
}

/** Admin edit (no re-moderation). */
export async function updateIdeaByAdmin(id: string, d: IdeaInput): Promise<boolean> {
  const rows = await sql`
    UPDATE projects SET project_name = ${d.project_name}, category = ${d.category}, description = ${d.description},
      website = ${d.website || null}, kind = ${d.kind}, stage = ${d.stage}, details = ${d.details || null},
      help_needed = ${d.help_needed}, audience = ${d.audience}, field_visibility = ${JSON.stringify(d.field_visibility)}::jsonb,
      updated_at = now()
    WHERE id::text = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function setOwnerStatus(id: string, userId: string, to: "withdrawn" | "pending"): Promise<boolean> {
  const from = to === "withdrawn" ? ["pending", "approved", "changes_requested"] : ["withdrawn"];
  const rows = await sql`
    UPDATE projects SET status = ${to}, updated_at = now(), owner_edited_at = now()
    WHERE id::text = ${id} AND user_id = ${userId} AND status = ANY(${from}) RETURNING id`;
  return rows.length > 0;
}

export async function myIdeas(userId: string): Promise<Row[]> {
  return sql`
    SELECT p.id, p.project_name, p.status, p.audience, p.hidden_by_reports, p.moderation_note, p.updated_at,
           (SELECT count(*)::int FROM collaboration_requests r WHERE r.project_id = p.id AND r.status = 'pending'
              AND r.created_at >= now() - interval '30 days') AS open_requests
    FROM projects p WHERE p.user_id = ${userId} ORDER BY p.updated_at DESC NULLS LAST`;
}

export async function reportIdea(reporterId: string, ideaId: string, reason: string, details: string): Promise<"reported" | "duplicate" | "auto_hidden"> {
  const ins = await q(IDEA_REPORT_INSERT_SQL, [reporterId, ideaId, reason, details || null]);
  if (ins.length === 0) return "duplicate";
  const hid = await q(IDEA_AUTO_HIDE_SQL, [ideaId, AUTO_HIDE_REPORTS]);
  if (hid.length) {
    await sql`INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, note)
              VALUES ('system', 'auto_hide', 'idea', ${ideaId}, ${`${AUTO_HIDE_REPORTS} open reports`})`;
    return "auto_hidden";
  }
  return "reported";
}

// ---------------- Collaboration requests ----------------
// The flow (notice → accept/decline → one introduction) is shared with help offers and offer requests in
// lib/requests-repo.ts. These wrappers keep the collaboration-specific names.

export const expireStale = () => R.expireAll();
/** Shared daily limit across every request kind. */
export const sentLastDay = (userId: string) => R.sentLastDayAll(userId);
export const hasOpenRequest = (ideaId: string, userId: string) => R.hasOpen("collab", ideaId, userId);

export async function createRequest(ideaId: string, requesterId: string, ownerId: string, message: string): Promise<string | null> {
  const r = await q(REQUEST_INSERT_SQL, [ideaId, requesterId, ownerId, message]);
  return (r[0]?.id as string) ?? null;
}

/** Notify the owner (no addresses shared). Best effort. */
export const notifyOwnerOfRequest = (requestId: string) => R.notifyResponder("collab", requestId);
export type RespondResult = R.RespondResult;
export const respondToRequest = (requestId: string, ownerId: string, to: "accepted" | "declined") => R.respond("collab", requestId, ownerId, to, false);
export const retryIntro = (requestId: string, actorId: string, isAdmin: boolean) => R.retryIntro("collab", requestId, actorId, isAdmin);
export const withdrawRequest = (requestId: string, requesterId: string) => R.withdraw("collab", requestId, requesterId);

// ---------------- Review results (the "Review results for my ideas" preference) ----------------

/** Email the idea's owner the review outcome, unless they turned review emails off. Best effort, never throws. */
export async function notifyReviewResult(ideaId: string, outcome: "approved" | "changes_requested" | "rejected", note: string | null): Promise<void> {
  try {
    const [r] = await sql`
      SELECT p.project_name, m.email, m.email_prefs, m.status FROM projects p JOIN members m ON m.user_id = p.user_id
      WHERE p.id::text = ${ideaId}`;
    if (!r?.email || r.status !== "active" || r.email_prefs?.reviews === false) return;
    await sendEmail(ideaReviewEmail({ to: r.email, ideaName: r.project_name, ideaId, outcome, note }));
  } catch (e) {
    console.error("review result email failed", e);
  }
}
