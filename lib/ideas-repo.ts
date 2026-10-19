import sql, { raw, type Row } from "@/lib/db";
import { likePattern } from "@/lib/profile-sql";
import { AUTO_HIDE_REPORTS } from "@/lib/profile-input";
import { statusAfterOwnerEdit, type IdeaInput } from "@/lib/ideas";
import {
  BROWSE_SQL, EXPIRE_SQL, IDEA_AUTO_HIDE_SQL, IDEA_REPORT_INSERT_SQL, INTRO_PARTIES_SQL,
  REQUEST_INSERT_SQL, RESPOND_SQL, SENT_LAST_DAY_SQL, WITHDRAW_SQL,
} from "@/lib/idea-sql";
import { declinedEmail, introductionEmail, newRequestEmail, sendEmail } from "@/lib/email";
import type { IdeaRow } from "@/lib/visibility";

const q = (text: string, params: unknown[]) => raw().query(text, params) as Promise<Row[]>;

export type BrowseFilters = { category?: string; kind?: string; stage?: string; help?: string; q?: string; limit?: number; offset?: number };

export async function browseIdeas(viewerGated: boolean, f: BrowseFilters): Promise<{ rows: (IdeaRow & { name: string | null })[]; total: number }> {
  const text = (f.q ?? "").trim().slice(0, 80);
  const rows = await q(BROWSE_SQL, [viewerGated, f.category || null, f.kind || null, f.stage || null, f.help || null,
    text, likePattern(text), Math.min(f.limit ?? 24, 50), Math.max(0, f.offset ?? 0)]);
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

export async function expireStale(): Promise<void> {
  await q(EXPIRE_SQL, []).catch((e) => console.error("expire sweep failed", e));
}

export async function sentLastDay(userId: string): Promise<number> {
  return ((await q(SENT_LAST_DAY_SQL, [userId]))[0]?.n as number) ?? 0;
}

export async function hasOpenRequest(ideaId: string, userId: string): Promise<boolean> {
  const r = await sql`SELECT 1 FROM collaboration_requests WHERE project_id::text = ${ideaId} AND requester_user_id = ${userId}
                      AND status = 'pending' AND created_at >= now() - interval '30 days' LIMIT 1`;
  return r.length > 0;
}

export async function createRequest(ideaId: string, requesterId: string, ownerId: string, message: string): Promise<string | null> {
  const r = await q(REQUEST_INSERT_SQL, [ideaId, requesterId, ownerId, message]);
  return (r[0]?.id as string) ?? null;
}

/** Notify the owner (no addresses shared). Best effort. */
export async function notifyOwnerOfRequest(requestId: string): Promise<void> {
  const [p] = await q(INTRO_PARTIES_SQL, [requestId]);
  if (!p || !p.owner_email || p.owner_prefs?.requests === false) return;
  const res = await sendEmail(newRequestEmail({ ownerEmail: p.owner_email, ideaName: p.project_name, requesterName: p.requester_name, message: p.message, requestId }));
  if (res.ok) await sql`UPDATE collaboration_requests SET owner_notified_at = now() WHERE id::text = ${requestId}`;
}

export type RespondResult = { ok: false } | { ok: true; status: "accepted" | "declined"; intro?: { sent: boolean; error?: string } };

export async function respondToRequest(requestId: string, ownerId: string, to: "accepted" | "declined"): Promise<RespondResult> {
  const rows = await q(RESPOND_SQL, [requestId, ownerId, to]);
  if (!rows.length) return { ok: false };
  const [p] = await q(INTRO_PARTIES_SQL, [requestId]);
  if (to === "declined") {
    if (p?.requester_email) await sendEmail(declinedEmail({ requesterEmail: p.requester_email, ideaName: p.project_name }));
    return { ok: true, status: to };
  }
  // Accepted: exactly one introduction email to both members (D12).
  let result: { sent: boolean; error?: string };
  if (!p?.owner_email || !p?.requester_email) {
    result = { sent: false, error: "missing member email" };
  } else {
    const res = await sendEmail(introductionEmail({
      ownerEmail: p.owner_email, ownerName: p.owner_name, requesterEmail: p.requester_email, requesterName: p.requester_name,
      ideaName: p.project_name, ideaId: String(p.project_id), message: p.message,
    }));
    result = res.ok ? { sent: true } : { sent: false, error: res.error };
    await sql`UPDATE collaboration_requests SET intro_sent_at = ${res.ok ? new Date().toISOString() : null},
                intro_email_id = ${res.ok ? res.id : null}, intro_error = ${res.ok ? null : res.error}
              WHERE id::text = ${requestId}`;
  }
  return { ok: true, status: to, intro: result };
}

/** Retry a failed introduction (owner or admin), only for accepted requests not yet sent. */
export async function retryIntro(requestId: string, actorId: string, isAdmin: boolean): Promise<{ sent: boolean; error?: string } | null> {
  const r = await sql`SELECT owner_user_id FROM collaboration_requests WHERE id::text = ${requestId} AND status = 'accepted' AND intro_sent_at IS NULL`;
  if (!r.length || (!isAdmin && r[0].owner_user_id !== actorId)) return null;
  const [p] = await q(INTRO_PARTIES_SQL, [requestId]);
  if (!p?.owner_email || !p?.requester_email) return { sent: false, error: "missing member email" };
  const res = await sendEmail(introductionEmail({
    ownerEmail: p.owner_email, ownerName: p.owner_name, requesterEmail: p.requester_email, requesterName: p.requester_name,
    ideaName: p.project_name, ideaId: String(p.project_id), message: p.message,
  }));
  await sql`UPDATE collaboration_requests SET intro_sent_at = ${res.ok ? new Date().toISOString() : null},
              intro_email_id = ${res.ok ? res.id : null}, intro_error = ${res.ok ? null : res.error}
            WHERE id::text = ${requestId}`;
  return res.ok ? { sent: true } : { sent: false, error: res.error };
}

export async function withdrawRequest(requestId: string, requesterId: string): Promise<boolean> {
  return (await q(WITHDRAW_SQL, [requestId, requesterId])).length > 0;
}

/** Requests involving this member. Never selects emails. */
export async function listRequests(userId: string): Promise<{ received: Row[]; sent: Row[] }> {
  const rows = await sql`
    SELECT r.id, r.project_id, r.status, r.message, r.created_at, r.responded_at, r.intro_sent_at, r.intro_error,
           r.owner_user_id, r.requester_user_id, p.project_name,
           coalesce(qp.display_name, q.display_name, 'A PANA member') AS requester_name,
           (qp.is_published AND qp.moderation = 'ok') AS requester_profile_visible,
           coalesce(op.display_name, o.display_name, 'The idea owner') AS owner_name
    FROM collaboration_requests r
    JOIN projects p ON p.id = r.project_id
    LEFT JOIN members q ON q.user_id = r.requester_user_id LEFT JOIN profiles qp ON qp.user_id = r.requester_user_id
    LEFT JOIN members o ON o.user_id = r.owner_user_id LEFT JOIN profiles op ON op.user_id = r.owner_user_id
    WHERE r.owner_user_id = ${userId} OR r.requester_user_id = ${userId}
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 200`;
  return { received: rows.filter((r) => r.owner_user_id === userId), sent: rows.filter((r) => r.requester_user_id === userId) };
}
