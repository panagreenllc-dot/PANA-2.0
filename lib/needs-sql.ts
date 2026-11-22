// Parameterized SQL for needs on ideas (P3-2b). Never selects an email. The page decides visibility with
// lib/visibility.ts (toNeedView); the public queries below also filter in SQL so a need can't leak past its idea.

export const NEED_COLS = `
  n.id::text AS id, n.project_id::text AS project_id, n.owner_user_id, n.kind, n.title, n.details, n.amount_text,
  n.status, n.moderation_note, n.created_at, n.updated_at`;

/** All needs of one idea (the page filters per viewer). $1 idea id */
export const IDEA_NEEDS_SQL = `
  SELECT ${NEED_COLS} FROM project_needs n WHERE n.project_id::text = $1
  ORDER BY CASE n.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 WHEN 'changes_requested' THEN 2 WHEN 'met' THEN 3 ELSE 4 END, n.created_at`;

/** Create a need on the owner's own idea, within the active limit. $1 idea id, $2 owner, $3 kind, $4 title, $5 details, $6 amount, $7 limit */
export const NEED_INSERT_SQL = `
  INSERT INTO project_needs (project_id, owner_user_id, kind, title, details, amount_text)
  SELECT p.id, $2, $3, $4, $5, $6 FROM projects p
  WHERE p.id::text = $1 AND p.user_id = $2 AND p.status NOT IN ('rejected', 'withdrawn')
    AND (SELECT count(*) FROM project_needs x WHERE x.project_id = p.id AND x.status IN ('pending', 'changes_requested', 'open')) < $7
  RETURNING id::text AS id`;

/** One need with its idea's visibility fields. $1 need id */
export const NEED_WITH_IDEA_SQL = `
  SELECT ${NEED_COLS}, p.user_id AS idea_user_id, p.status AS idea_status, p.audience AS idea_audience,
         p.hidden_by_reports AS idea_hidden, p.project_name
  FROM project_needs n JOIN projects p ON p.id = n.project_id WHERE n.id::text = $1`;

/** Owner edit. $1 need id, $2 owner, $3 kind, $4 title, $5 details, $6 amount, $7 new status */
export const NEED_UPDATE_SQL = `
  UPDATE project_needs SET kind = $3, title = $4, details = $5, amount_text = $6, status = $7, updated_at = now(),
         reviewed_at = CASE WHEN $7 = 'pending' THEN NULL ELSE reviewed_at END
  WHERE id::text = $1 AND owner_user_id = $2 RETURNING id::text AS id, status`;

/** Owner status move (met / closed / re-open), validated in lib/needs.ts first. $1 need id, $2 owner, $3 to, $4 from */
export const NEED_OWNER_STATUS_SQL = `
  UPDATE project_needs SET status = $3, updated_at = now() WHERE id::text = $1 AND owner_user_id = $2 AND status = $4
  RETURNING id::text AS id`;

/** Admin review. $1 need id, $2 'approve'|'send_back', $3 admin id, $4 note */
export const NEED_REVIEW_SQL = `
  UPDATE project_needs SET status = CASE WHEN $2 = 'approve' THEN 'open' ELSE 'changes_requested' END,
         moderation_note = CASE WHEN $2 = 'approve' THEN NULL ELSE $4 END,
         reviewed_by = $3, reviewed_at = now(), updated_at = now()
  WHERE id::text = $1 AND status = 'pending' AND $2 IN ('approve', 'send_back')
  RETURNING id::text AS id, project_id::text AS project_id, owner_user_id, title, status`;

/** Admin review queue (oldest first). No params. */
export const PENDING_NEEDS_SQL = `
  SELECT ${NEED_COLS}, p.project_name, p.status AS idea_status, coalesce(pr.display_name, m.display_name, 'A PANA member') AS owner_name
  FROM project_needs n JOIN projects p ON p.id = n.project_id
  LEFT JOIN members m ON m.user_id = n.owner_user_id LEFT JOIN profiles pr ON pr.user_id = n.owner_user_id
  WHERE n.status = 'pending' ORDER BY n.created_at LIMIT 200`;

export const PENDING_NEEDS_COUNT_SQL = `SELECT count(*)::int AS n FROM project_needs WHERE status = 'pending'`;

/** The member's own needs (for /me). $1 owner */
export const MY_NEEDS_SQL = `
  SELECT ${NEED_COLS}, p.project_name,
         (SELECT count(*)::int FROM help_offers h WHERE h.need_id = n.id AND h.status = 'pending'
            AND h.created_at >= now() - interval '30 days') AS open_offers
  FROM project_needs n JOIN projects p ON p.id = n.project_id
  WHERE n.owner_user_id = $1 ORDER BY (n.status IN ('open', 'pending', 'changes_requested')) DESC, n.updated_at DESC LIMIT 100`;

/** Open needs on PUBLIC, approved, visible ideas (for /support). $1 limit */
export const PUBLIC_OPEN_NEEDS_SQL = `
  SELECT n.id::text AS id, n.kind, n.title, n.amount_text, p.id::text AS project_id, p.project_name
  FROM project_needs n JOIN projects p ON p.id = n.project_id AND p.user_id = n.owner_user_id
  WHERE n.status = 'open' AND p.status = 'approved' AND NOT p.hidden_by_reports AND p.audience = 'public'
  ORDER BY n.updated_at DESC LIMIT $1`;
