// Parameterized SQL shared by the app (Neon) and the PGlite tests, so the tested SQL is the shipped SQL.
// members.email is never selected.

export const PROFILE_SELECT = `
  p.user_id, p.display_name, p.headline, p.experience, p.roles, p.skills, p.interests, p.looking_for,
  p.links, p.is_published, p.moderation, p.updated_at, m.status AS member_status, m.image_url`;

/** $1 role|null, $2 looking|null, $3 q ('' = none), $4 like pattern, $5 limit, $6 offset */
export const DIRECTORY_SQL = `
  SELECT ${PROFILE_SELECT}, count(*) OVER()::int AS total
  FROM profiles p JOIN members m ON m.user_id = p.user_id
  WHERE p.is_published AND p.moderation = 'ok' AND m.status = 'active'
    AND ($1::text IS NULL OR $1 = ANY(p.roles))
    AND ($2::text IS NULL OR $2 = ANY(p.looking_for))
    AND ($3 = '' OR p.display_name ILIKE $4 OR p.headline ILIKE $4
         OR EXISTS (SELECT 1 FROM unnest(p.skills || p.interests) t WHERE t ILIKE $4))
  ORDER BY p.published_at DESC NULLS LAST, p.updated_at DESC
  LIMIT $5 OFFSET $6`;

/** $1 reporter, $2 target user id, $3 reason, $4 details */
export const REPORT_INSERT_SQL = `
  INSERT INTO reports (reporter_user_id, target_type, target_id, reason, details)
  VALUES ($1, 'profile', $2, $3, $4)
  ON CONFLICT (reporter_user_id, target_type, target_id) DO NOTHING RETURNING id`;

/** $1 target user id, $2 threshold, $3 hidden_reason */
export const AUTO_HIDE_SQL = `
  UPDATE profiles SET moderation = 'hidden', hidden_reason = $3, updated_at = now()
  WHERE user_id = $1 AND moderation = 'ok'
    AND (SELECT count(DISTINCT reporter_user_id) FROM reports
         WHERE target_type = 'profile' AND target_id = $1 AND status = 'open') >= $2
  RETURNING user_id`;

export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
