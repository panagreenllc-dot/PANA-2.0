// Parameterized incubator SQL shared by the app (Neon) and the PGlite tests (db/incubator.test.mjs).
// Never selects members.email, except DECISION_PARTIES_SQL and NOTIFY_TARGETS_SQL, which are used only to send
// a member their own email. Calendar days are selected as text ("YYYY-MM-DD") so they never shift time zones.

export const COHORT_COLS = `
  c.id::text AS id, c.name, c.slug, c.summary, c.format, c.status, c.apply_opens_at, c.apply_closes_at,
  c.starts_on::text AS starts_on, c.ends_on::text AS ends_on, c.announce_on::text AS announce_on, c.announce_note,
  c.capacity, c.notified_at, c.created_at, c.updated_at`;

/** Cohorts shown on /incubator: everything except drafts and completed cohorts, soonest deadline first. No params. */
export const PUBLIC_COHORTS_SQL = `
  SELECT ${COHORT_COLS} FROM incubator_cohorts c
  WHERE c.status IN ('open', 'closed', 'active')
  ORDER BY (c.status = 'open') DESC, c.apply_closes_at ASC NULLS LAST, c.created_at DESC
  LIMIT 5`;

/** The cohort if it accepts applications right now. $1 cohort id */
export const COHORT_ACCEPTING_SQL = `
  SELECT ${COHORT_COLS} FROM incubator_cohorts c
  WHERE c.id::text = $1 AND c.status = 'open'
    AND (c.apply_opens_at IS NULL OR c.apply_opens_at <= now())
    AND (c.apply_closes_at IS NULL OR c.apply_closes_at > now())`;

/**
 * Submit an application. Inserts only if the cohort is open right now, the idea belongs to the applicant and is
 * not rejected or withdrawn, and the applicant has no live application for this cohort.
 * $1 cohort id, $2 user id, $3 project id, $4 stage, $5 goals, $6 weekly hours, $7 needs text[], $8 team, $9 links jsonb
 */
export const APPLY_INSERT_SQL = `
  INSERT INTO incubator_applications (cohort_id, user_id, project_id, stage, goals, weekly_hours, needs, team, links)
  SELECT c.id, $2, p.id, $4, $5, $6::int, $7::text[], $8, $9::jsonb
  FROM incubator_cohorts c
  JOIN projects p ON p.id::text = $3 AND p.user_id = $2 AND p.status IN ('pending', 'approved', 'changes_requested')
  WHERE c.id::text = $1 AND c.status = 'open'
    AND (c.apply_opens_at IS NULL OR c.apply_opens_at <= now())
    AND (c.apply_closes_at IS NULL OR c.apply_closes_at > now())
  ON CONFLICT (cohort_id, user_id) WHERE status NOT IN ('withdrawn', 'declined') DO NOTHING
  RETURNING id::text AS id`;

/** $1 user id → the member's own applications (no admin note). */
export const MY_APPLICATIONS_SQL = `
  SELECT a.id::text AS id, a.status, a.participant_status, a.decision_note, a.created_at, a.reviewed_at,
         a.project_id::text AS project_id, p.project_name, c.name AS cohort_name, c.starts_on::text AS starts_on,
         c.ends_on::text AS ends_on, c.announce_on::text AS announce_on, c.announce_note
  FROM incubator_applications a
  JOIN incubator_cohorts c ON c.id = a.cohort_id
  LEFT JOIN projects p ON p.id = a.project_id
  WHERE a.user_id = $1
  ORDER BY a.created_at DESC LIMIT 50`;

/** $1 application id, $2 user id. Withdraw until a final decision. */
export const WITHDRAW_APPLICATION_SQL = `
  UPDATE incubator_applications SET status = 'withdrawn', participant_status = NULL, updated_at = now()
  WHERE id::text = $1 AND user_id = $2 AND status IN ('submitted', 'under_review', 'waitlisted')
  RETURNING id::text AS id`;

/**
 * Admin decision; mirrors canDecide() in lib/incubator.ts.
 * $1 application id, $2 admin id, $3 new status, $4 note to applicant (null keeps), $5 private admin note (null keeps)
 */
export const DECIDE_SQL = `
  UPDATE incubator_applications SET
    status = $3, decision_note = coalesce($4, decision_note), admin_note = coalesce($5, admin_note),
    participant_status = CASE WHEN $3 = 'accepted' THEN 'active' ELSE NULL END,
    reviewed_by = $2, reviewed_at = now(), updated_at = now()
  WHERE id::text = $1
    AND $3 IN ('under_review', 'accepted', 'waitlisted', 'declined')
    AND (status = 'submitted'
         OR (status = 'under_review' AND $3 <> 'under_review')
         OR (status = 'waitlisted' AND $3 IN ('accepted', 'declined')))
  RETURNING id::text AS id, user_id, cohort_id::text AS cohort_id, status`;

/** $1 application id, $2 participant status (active|completed|left). Accepted applications only. */
export const PARTICIPANT_SQL = `
  UPDATE incubator_applications SET participant_status = $2, updated_at = now()
  WHERE id::text = $1 AND status = 'accepted' AND $2 IN ('active', 'completed', 'left')
  RETURNING id::text AS id`;

/** $1 application id, $2 admin note. Save a private note without a decision. */
export const ADMIN_NOTE_SQL = `
  UPDATE incubator_applications SET admin_note = $2, updated_at = now() WHERE id::text = $1 RETURNING id::text AS id`;

/** Admin queue for one cohort. $1 cohort id. Never selects emails. */
export const ADMIN_QUEUE_SQL = `
  SELECT a.id::text AS id, a.user_id, a.status, a.participant_status, a.stage, a.goals, a.weekly_hours, a.needs,
         a.team, a.links, a.decision_note, a.admin_note, a.created_at, a.reviewed_at,
         a.project_id::text AS project_id, p.project_name, p.status AS project_status,
         coalesce(pr.display_name, m.display_name, 'A PANA member') AS applicant_name,
         (pr.is_published AND pr.moderation = 'ok') AS profile_visible
  FROM incubator_applications a
  JOIN members m ON m.user_id = a.user_id
  LEFT JOIN profiles pr ON pr.user_id = a.user_id
  LEFT JOIN projects p ON p.id = a.project_id
  WHERE a.cohort_id::text = $1
  ORDER BY CASE a.status WHEN 'submitted' THEN 0 WHEN 'under_review' THEN 1 WHEN 'waitlisted' THEN 2
                         WHEN 'accepted' THEN 3 ELSE 4 END, a.created_at ASC`;

/** All cohorts with counts, for the admin list. No params. */
export const ADMIN_COHORTS_SQL = `
  SELECT ${COHORT_COLS},
         count(a.id) FILTER (WHERE a.status IN ('submitted', 'under_review'))::int AS to_review,
         count(a.id) FILTER (WHERE a.status = 'waitlisted')::int AS waitlisted,
         count(a.id) FILTER (WHERE a.status = 'accepted')::int AS accepted,
         count(a.id)::int AS total
  FROM incubator_cohorts c LEFT JOIN incubator_applications a ON a.cohort_id = c.id
  GROUP BY c.id ORDER BY c.created_at DESC`;

/** $1 cohort id → accepted count, for the capacity warning. */
export const ACCEPTED_COUNT_SQL = `
  SELECT count(*)::int AS n FROM incubator_applications WHERE cohort_id::text = $1 AND status = 'accepted'`;

/** Applications waiting for review (header badge). No params. */
export const PENDING_APPLICATIONS_SQL = `
  SELECT count(*)::int AS n FROM incubator_applications WHERE status = 'submitted'`;

/** The applicant's own address, ONLY to email them about their own application. $1 application id */
export const DECISION_PARTIES_SQL = `
  SELECT a.id::text AS id, a.status, a.decision_note, m.email, m.status AS member_status, m.email_prefs,
         coalesce(pr.display_name, m.display_name, 'there') AS name, c.name AS cohort_name,
         c.starts_on::text AS starts_on, c.announce_on::text AS announce_on, c.announce_note, p.project_name
  FROM incubator_applications a
  JOIN members m ON m.user_id = a.user_id
  JOIN incubator_cohorts c ON c.id = a.cohort_id
  LEFT JOIN profiles pr ON pr.user_id = a.user_id
  LEFT JOIN projects p ON p.id = a.project_id
  WHERE a.id::text = $1`;

/** Members who asked to hear when applications open (each gets their own email). $1 limit */
export const NOTIFY_TARGETS_SQL = `
  SELECT m.user_id, m.email FROM members m
  WHERE m.status = 'active' AND m.email IS NOT NULL AND (m.email_prefs->>'incubator_news')::boolean IS TRUE
  ORDER BY m.created_at ASC LIMIT $1`;

/** Merge keys into members.email_prefs (never overwrite other keys). $1 user id, $2 jsonb patch */
export const PREFS_MERGE_SQL = `
  UPDATE members SET email_prefs = coalesce(email_prefs, '{}'::jsonb) || $2::jsonb, updated_at = now()
  WHERE user_id = $1 RETURNING email_prefs`;
