// Parameterized SQL shared by the app (Neon) and PGlite tests. Never selects projects.email or members.email,
// except INTRO_PARTIES_SQL, which is used only to send the accepted introduction email.

export const IDEA_COLS = `
  p.id, p.user_id, p.name, p.project_name, p.category, p.description, p.website, p.details, p.help_needed,
  p.kind, p.stage, p.status, p.audience, p.field_visibility, p.hidden_by_reports, p.moderation_note,
  p.created_at, p.updated_at`;

/**
 * Browse approved, visible ideas.
 * $1 viewer is a gated member (bool), $2 category|null, $3 kind|null, $4 stage|null, $5 help|null,
 * $6 q ('' = none), $7 like pattern, $8 limit, $9 offset.
 * Text search only matches fields that are visible to this viewer.
 */
export const BROWSE_SQL = `
  SELECT ${IDEA_COLS}, count(*) OVER()::int AS total
  FROM projects p
  WHERE p.status = 'approved' AND NOT p.hidden_by_reports
    AND (p.audience = 'public' OR (p.audience = 'members' AND $1::boolean))
    AND ($2::text IS NULL OR p.category = $2)
    AND ($3::text IS NULL OR p.kind = $3)
    AND ($4::text IS NULL OR p.stage = $4)
    AND ($5::text IS NULL OR ($5 = ANY(p.help_needed)
         AND (coalesce(p.field_visibility->>'help_needed', 'public') = 'public'
              OR (coalesce(p.field_visibility->>'help_needed', 'public') = 'members' AND $1::boolean))))
    AND ($6 = '' OR p.project_name ILIKE $7 OR p.description ILIKE $7 OR p.category ILIKE $7
         OR (p.details ILIKE $7 AND (coalesce(p.field_visibility->>'details', 'members') = 'public'
             OR (coalesce(p.field_visibility->>'details', 'members') = 'members' AND $1::boolean))))
  ORDER BY p.created_at DESC
  LIMIT $8 OFFSET $9`;

/** $1 reporter, $2 idea id (text), $3 reason, $4 details */
export const IDEA_REPORT_INSERT_SQL = `
  INSERT INTO reports (reporter_user_id, target_type, target_id, reason, details)
  VALUES ($1, 'idea', $2, $3, $4)
  ON CONFLICT (reporter_user_id, target_type, target_id) DO NOTHING RETURNING id`;

/** $1 idea id (text), $2 threshold */
export const IDEA_AUTO_HIDE_SQL = `
  UPDATE projects SET hidden_by_reports = true, updated_at = now()
  WHERE id::text = $1 AND NOT hidden_by_reports
    AND (SELECT count(DISTINCT reporter_user_id) FROM reports
         WHERE target_type = 'idea' AND target_id = $1 AND status = 'open') >= $2
  RETURNING id`;

/** Mark stale pending requests expired. No params. */
export const EXPIRE_SQL = `
  UPDATE collaboration_requests SET status = 'expired', responded_at = now()
  WHERE status = 'pending' AND created_at < now() - interval '30 days'
  RETURNING id`;

/** $1 requester → number of requests sent in the last 24h */
export const SENT_LAST_DAY_SQL = `
  SELECT count(*)::int AS n FROM collaboration_requests
  WHERE requester_user_id = $1 AND created_at > now() - interval '24 hours'`;

/** $1 idea id (uuid text), $2 requester, $3 owner, $4 message. Unique index blocks a second open request. */
export const REQUEST_INSERT_SQL = `
  INSERT INTO collaboration_requests (project_id, requester_user_id, owner_user_id, message)
  VALUES ($1::uuid, $2, $3, $4)
  ON CONFLICT (project_id, requester_user_id) WHERE status = 'pending' DO NOTHING
  RETURNING id`;

/** $1 request id, $2 actor (owner), $3 new status. Only the owner, only pending, only unexpired. */
export const RESPOND_SQL = `
  UPDATE collaboration_requests SET status = $3, responded_at = now()
  WHERE id::text = $1 AND owner_user_id = $2 AND status = 'pending' AND created_at >= now() - interval '30 days'
    AND $3 IN ('accepted', 'declined')
  RETURNING id, project_id, requester_user_id, owner_user_id, message`;

/** $1 request id, $2 actor (requester) */
export const WITHDRAW_SQL = `
  UPDATE collaboration_requests SET status = 'withdrawn', responded_at = now()
  WHERE id::text = $1 AND requester_user_id = $2 AND status = 'pending'
  RETURNING id`;

/** Contact details for the accepted introduction ONLY. $1 request id */
export const INTRO_PARTIES_SQL = `
  SELECT r.id, r.message, r.project_id, p.project_name,
         o.email AS owner_email, coalesce(op.display_name, o.display_name, 'The idea owner') AS owner_name,
         q.email AS requester_email, coalesce(qp.display_name, q.display_name, 'A PANA member') AS requester_name,
         o.email_prefs AS owner_prefs
  FROM collaboration_requests r
  JOIN projects p ON p.id = r.project_id
  JOIN members o ON o.user_id = r.owner_user_id
  JOIN members q ON q.user_id = r.requester_user_id
  LEFT JOIN profiles op ON op.user_id = r.owner_user_id
  LEFT JOIN profiles qp ON qp.user_id = r.requester_user_id
  WHERE r.id::text = $1`;
