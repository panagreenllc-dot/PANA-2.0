import sql, { raw, type Row } from "@/lib/db";
import { AUTO_HIDE_SQL, DIRECTORY_SQL, likePattern, REPORT_INSERT_SQL } from "@/lib/profile-sql";
import { AUTO_HIDE_REPORTS, type ProfileInput } from "@/lib/profile-input";
import type { IdeaRow, ProfileRow } from "@/lib/visibility";

// All profile reads select explicit columns. members.email is NEVER selected here.

export async function getProfileRow(userId: string): Promise<ProfileRow | null> {
  const rows = await sql`
    SELECT p.user_id, p.display_name, p.headline, p.experience, p.roles, p.skills, p.interests, p.looking_for,
           p.links, p.is_published, p.moderation, p.updated_at, m.status AS member_status, m.image_url
    FROM profiles p JOIN members m ON m.user_id = p.user_id
    WHERE p.user_id = ${userId}`;
  return (rows[0] as ProfileRow) ?? null;
}

export async function listDirectory(f: { role?: string; looking?: string; q?: string; limit?: number; offset?: number }): Promise<{ rows: ProfileRow[]; total: number }> {
  const q = (f.q ?? "").trim().slice(0, 60);
  const limit = Math.min(f.limit ?? 24, 50);
  const offset = Math.max(0, f.offset ?? 0);
  const rows = (await raw().query(DIRECTORY_SQL, [f.role || null, f.looking || null, q, likePattern(q), limit, offset])) as Row[];
  return { rows: rows as ProfileRow[], total: (rows[0]?.total as number) ?? 0 };
}

export async function saveProfile(userId: string, d: ProfileInput): Promise<void> {
  await sql`
    INSERT INTO profiles (user_id, display_name, headline, experience, roles, skills, interests, looking_for, links)
    VALUES (${userId}, ${d.display_name}, ${d.headline || null}, ${d.experience || null}, ${d.roles}, ${d.skills},
            ${d.interests}, ${d.looking_for}, ${JSON.stringify(d.links)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name, headline = EXCLUDED.headline, experience = EXCLUDED.experience,
      roles = EXCLUDED.roles, skills = EXCLUDED.skills, interests = EXCLUDED.interests,
      looking_for = EXCLUDED.looking_for, links = EXCLUDED.links, updated_at = now()`;
}

export async function setPublished(userId: string, publish: boolean): Promise<boolean> {
  const rows = await sql`
    UPDATE profiles SET is_published = ${publish},
      published_at = CASE WHEN ${publish} AND published_at IS NULL THEN now() WHEN ${publish} THEN published_at ELSE NULL END,
      updated_at = now()
    WHERE user_id = ${userId} RETURNING user_id`;
  return rows.length > 0;
}

/** Approved, non-hidden ideas owned by this member (field filtering happens in toIdeaView). */
export async function ideasOf(userId: string): Promise<IdeaRow[]> {
  const rows = await sql`
    SELECT id, user_id, project_name, category, description, website, details, help_needed, kind, stage, status,
           audience, field_visibility, hidden_by_reports, created_at
    FROM projects
    WHERE user_id = ${userId} AND status = 'approved' AND NOT hidden_by_reports AND audience IN ('public', 'members')
    ORDER BY created_at DESC LIMIT 50`;
  return rows as IdeaRow[];
}

export type ReportResult = "reported" | "duplicate" | "auto_hidden";

/** Record a report; auto-hide the profile when it reaches AUTO_HIDE_REPORTS distinct open reports. */
export async function reportProfile(reporterId: string, targetId: string, reason: string, details: string): Promise<ReportResult> {
  const db = raw();
  const ins = (await db.query(REPORT_INSERT_SQL, [reporterId, targetId, reason, details || null])) as Row[];
  if (ins.length === 0) return "duplicate";
  const hidden = (await db.query(AUTO_HIDE_SQL, [targetId, AUTO_HIDE_REPORTS, `Auto-hidden after ${AUTO_HIDE_REPORTS} reports`])) as Row[];
  if (hidden.length > 0) {
    await sql`INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, note)
              VALUES ('system', 'auto_hide', 'profile', ${targetId}, ${`${AUTO_HIDE_REPORTS} open reports`})`;
    return "auto_hidden";
  }
  return "reported";
}

export async function openReportCount(): Promise<number> {
  const r: Row[] = await sql`SELECT count(*)::int AS n FROM reports WHERE status = 'open'`;
  return r[0]?.n ?? 0;
}
