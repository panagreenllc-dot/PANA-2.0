// Parameterized SQL for mentor and investor roles (P3-3), used by lib/mentors-repo.ts and PGlite tests.
// No query here selects members.email. Names come from the member's profile or Clerk display name.

const NAME = (m: string, p: string) => `coalesce(${p}.display_name, ${m}.display_name, 'A PANA member')`;

// ---------- Member's own role profiles ----------

/** $1 user */
export const MY_MENTOR_SQL = `SELECT user_id, status, expertise, bio, availability, max_open_mentees, review_note, approved_at, updated_at
  FROM mentor_profiles WHERE user_id = $1`;
/** $1 user */
export const MY_INVESTOR_SQL = `SELECT user_id, status, investor_type, focus_categories, stage_focus, organization, bio, review_note, approved_at, updated_at
  FROM investor_profiles WHERE user_id = $1`;

/** Create or update. $1 user, $2 expertise, $3 bio, $4 availability, $5 max, $6 new status. Never touches a revoked row. */
export const MENTOR_UPSERT_SQL = `
  INSERT INTO mentor_profiles (user_id, expertise, bio, availability, max_open_mentees, status)
  VALUES ($1, $2::text[], $3, $4, $5, $6)
  ON CONFLICT (user_id) DO UPDATE SET expertise = EXCLUDED.expertise, bio = EXCLUDED.bio, availability = EXCLUDED.availability,
    max_open_mentees = EXCLUDED.max_open_mentees, status = EXCLUDED.status, updated_at = now()
  WHERE mentor_profiles.status <> 'revoked'
  RETURNING status`;

/** $1 user, $2 type, $3 categories, $4 stages, $5 organization, $6 bio, $7 new status */
export const INVESTOR_UPSERT_SQL = `
  INSERT INTO investor_profiles (user_id, investor_type, focus_categories, stage_focus, organization, bio, status)
  VALUES ($1, $2, $3::text[], $4::text[], $5, $6, $7)
  ON CONFLICT (user_id) DO UPDATE SET investor_type = EXCLUDED.investor_type, focus_categories = EXCLUDED.focus_categories,
    stage_focus = EXCLUDED.stage_focus, organization = EXCLUDED.organization, bio = EXCLUDED.bio, status = EXCLUDED.status, updated_at = now()
  WHERE investor_profiles.status <> 'revoked'
  RETURNING status`;

/** Mentor pauses / resumes (no new review needed). $1 user, $2 'pause'|'resume' */
export const MENTOR_PAUSE_SQL = `
  UPDATE mentor_profiles SET status = CASE WHEN $2 = 'pause' THEN 'paused' ELSE 'approved' END, updated_at = now()
  WHERE user_id = $1 AND status = CASE WHEN $2 = 'pause' THEN 'approved' ELSE 'paused' END
  RETURNING status`;

/** Withdraw an application or step down. $1 user */
export const MENTOR_DELETE_SQL = `DELETE FROM mentor_profiles WHERE user_id = $1 AND status <> 'revoked' RETURNING user_id`;
export const INVESTOR_DELETE_SQL = `DELETE FROM investor_profiles WHERE user_id = $1 AND status <> 'revoked' RETURNING user_id`;

/** Approved badges for a member (shown on their profile). $1 user */
export const BADGES_SQL = `
  SELECT EXISTS (SELECT 1 FROM mentor_profiles WHERE user_id = $1 AND status IN ('approved', 'paused')) AS mentor,
         EXISTS (SELECT 1 FROM investor_profiles WHERE user_id = $1 AND status = 'approved') AS investor`;

/** $1 user */
export const IS_INVESTOR_SQL = `SELECT 1 FROM investor_profiles i JOIN members m ON m.user_id = i.user_id
  WHERE i.user_id = $1 AND i.status = 'approved' AND m.status = 'active'`;

// ---------- Mentor directory (members only) ----------

const OPEN_LOAD = (mp: string) => `(SELECT count(*)::int FROM mentorship_requests r WHERE r.mentor_user_id = ${mp}.user_id
    AND ((r.status = 'pending' AND r.created_at >= now() - interval '30 days')
         OR (r.status = 'accepted' AND r.responded_at >= now() - interval '90 days')))`;

const MENTOR_COLS = `mp.user_id, ${NAME("m", "pr")} AS name,
  CASE WHEN coalesce(pr.is_published AND pr.moderation = 'ok', false) THEN pr.headline END AS headline,
  coalesce(pr.is_published AND pr.moderation = 'ok', false) AS profile_visible,
  mp.status, mp.expertise, mp.bio, mp.availability, mp.max_open_mentees, ${OPEN_LOAD("mp")} AS open_load`;

/** Approved mentors with active accounts and a profile that isn't hidden. $1 expertise|null */
export const DIRECTORY_SQL = `
  SELECT ${MENTOR_COLS} FROM mentor_profiles mp JOIN members m ON m.user_id = mp.user_id LEFT JOIN profiles pr ON pr.user_id = mp.user_id
  WHERE mp.status = 'approved' AND m.status = 'active' AND coalesce(pr.moderation, 'ok') = 'ok'
    AND ($1::text IS NULL OR $1 = ANY(mp.expertise))
  ORDER BY mp.approved_at DESC NULLS LAST LIMIT 200`;

/** One mentor (any status; the page decides what to show). $1 user */
export const MENTOR_ONE_SQL = `
  SELECT ${MENTOR_COLS}, m.status AS member_status, coalesce(pr.moderation, 'ok') AS moderation
  FROM mentor_profiles mp JOIN members m ON m.user_id = mp.user_id LEFT JOIN profiles pr ON pr.user_id = mp.user_id
  WHERE mp.user_id = $1`;

// ---------- Admin ----------

const ROLE_ROWS = `
  SELECT 'mentor' AS role, mp.user_id, ${NAME("m", "pr")} AS name, mp.status, mp.bio, mp.expertise AS tags, mp.availability AS detail,
         NULL::text AS organization, mp.review_note, mp.created_at, mp.updated_at, mp.approved_at
  FROM mentor_profiles mp JOIN members m ON m.user_id = mp.user_id LEFT JOIN profiles pr ON pr.user_id = mp.user_id
  UNION ALL
  SELECT 'investor', ip.user_id, ${NAME("m", "pr")}, ip.status, ip.bio, ip.focus_categories || ip.stage_focus, ip.investor_type,
         ip.organization, ip.review_note, ip.created_at, ip.updated_at, ip.approved_at
  FROM investor_profiles ip JOIN members m ON m.user_id = ip.user_id LEFT JOIN profiles pr ON pr.user_id = ip.user_id`;

export const ADMIN_PENDING_SQL = `SELECT * FROM (${ROLE_ROWS}) x WHERE status = 'pending' ORDER BY updated_at ASC LIMIT 200`;
export const ADMIN_PENDING_COUNT_SQL = `SELECT (SELECT count(*) FROM mentor_profiles WHERE status = 'pending') + (SELECT count(*) FROM investor_profiles WHERE status = 'pending') AS n`;
export const ADMIN_DECIDED_SQL = `SELECT * FROM (${ROLE_ROWS}) x WHERE status <> 'pending' ORDER BY (status IN ('approved', 'paused')) DESC, updated_at DESC LIMIT 300`;

/** Admin decision. $1 user, $2 new status, $3 admin, $4 note, $5 allowed current statuses (text[]) */
export const MENTOR_DECIDE_SQL = `
  UPDATE mentor_profiles SET status = $2, review_note = $4, reviewed_at = now(), updated_at = now(),
    approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
    approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END
  WHERE user_id = $1 AND status = ANY($5::text[]) RETURNING user_id, status`;
export const INVESTOR_DECIDE_SQL = `
  UPDATE investor_profiles SET status = $2, review_note = $4, reviewed_at = now(), updated_at = now(),
    approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
    approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END
  WHERE user_id = $1 AND status = ANY($5::text[]) RETURNING user_id, status`;

// ---------- Ideas: investor interest switch ----------

/** Owner only. $1 idea id, $2 owner, $3 open (bool) */
export const SET_INVESTOR_OPEN_SQL = `UPDATE projects SET investor_interest_open = $3 WHERE id::text = $1 AND user_id = $2 RETURNING investor_interest_open`;

// ---------- Reports ----------

/** $1 reporter, $2 target type ('mentor_profile' | 'investor_profile' | 'mentorship_request' | 'investor_interest'), $3 target id, $4 reason, $5 details */
export const ROLE_REPORT_INSERT_SQL = `
  INSERT INTO reports (reporter_user_id, target_type, target_id, reason, details)
  SELECT $1, $2, $3, $4, $5 WHERE $1 <> $3
  ON CONFLICT (reporter_user_id, target_type, target_id) DO NOTHING RETURNING id`;
