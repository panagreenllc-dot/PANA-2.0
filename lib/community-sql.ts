// Parameterized SQL for the community feed, events, member board and digest (P3-4), shared by the app (Neon) and the
// PGlite tests, so the tested SQL is the shipped SQL. members.email is never selected, except DIGEST_TARGETS_SQL,
// which is used only to send the opt-in digest.

const NAME = (m: string, p: string) => `coalesce(${p}.display_name, ${m}.display_name, 'A PANA member')`;
const VISIBLE_PROFILE = (p: string) => `coalesce(${p}.is_published AND ${p}.moderation = 'ok', false)`;

// ---------- John's announcements and events ----------

export const FEED_COLS = `
  c.id::text AS id, c.slug, c.kind, c.program, c.audience, c.status, c.pinned, c.title, c.body, c.starts_at, c.ends_at,
  c.location_name, c.address, c.is_online, c.registration_url, c.registration_note, c.price_text, c.published_at, c.created_at, c.updated_at`;

const SEES = `(c.audience = 'public' OR $1::boolean)`;

/** $1 viewer is a member (sees members-only posts). Announcements, pinned first, then newest. */
export const ANNOUNCEMENTS_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c
  WHERE c.status = 'published' AND c.kind = 'announcement' AND ${SEES}
  ORDER BY c.pinned DESC, c.published_at DESC NULLS LAST LIMIT 10`;

/** $1 viewer is a member. Upcoming (or still running) events, soonest first. */
export const UPCOMING_EVENTS_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c
  WHERE c.status = 'published' AND c.kind = 'event' AND ${SEES} AND coalesce(c.ends_at, c.starts_at) >= now()
  ORDER BY c.pinned DESC, c.starts_at ASC LIMIT 20`;

/** $1 viewer is a member, $2 slug. Published only. */
export const POST_BY_SLUG_SQL = `SELECT ${FEED_COLS} FROM community_posts c WHERE c.slug = $2 AND c.status = 'published' AND ${SEES}`;

/** The Tech Con page: the next published techcon event, else the latest past one. Always public. */
export const TECHCON_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c
  WHERE c.status = 'published' AND c.kind = 'event' AND c.program = 'techcon' AND c.audience = 'public'
  ORDER BY (coalesce(c.ends_at, c.starts_at) < now()), CASE WHEN coalesce(c.ends_at, c.starts_at) >= now() THEN c.starts_at END ASC,
           c.starts_at DESC LIMIT 1`;

export const AGENDA_SQL = `SELECT time_label, title FROM event_agenda_items WHERE post_id = $1::uuid ORDER BY sort, id`;
export const SPEAKERS_SQL = `SELECT name, role FROM event_speakers WHERE post_id = $1::uuid ORDER BY sort, id`;

export const ADMIN_POSTS_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c
  ORDER BY (c.status = 'archived'), c.pinned DESC, coalesce(c.starts_at, c.published_at, c.created_at) DESC LIMIT 200`;
export const ADMIN_POST_ONE_SQL = `SELECT ${FEED_COLS} FROM community_posts c WHERE c.id = $1::uuid`;

/** $1 kind … $15 price_text, $16 author. Returns id, or nothing when the slug is taken. */
export const FEED_INSERT_SQL = `
  INSERT INTO community_posts (kind, title, slug, body, program, audience, pinned, starts_at, ends_at, location_name, address,
                               is_online, registration_url, registration_note, price_text, author_user_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  ON CONFLICT (slug) DO NOTHING RETURNING id::text AS id`;

/** $1 id, $2 kind … $16 price_text. Returns id, or nothing when the slug belongs to another post. */
export const FEED_UPDATE_SQL = `
  UPDATE community_posts SET kind = $2, title = $3, slug = $4, body = $5, program = $6, audience = $7, pinned = $8, starts_at = $9,
         ends_at = $10, location_name = $11, address = $12, is_online = $13, registration_url = $14, registration_note = $15,
         price_text = $16, updated_at = now()
  WHERE id = $1::uuid AND NOT EXISTS (SELECT 1 FROM community_posts o WHERE o.slug = $4 AND o.id <> $1::uuid)
  RETURNING id::text AS id`;

/** $1 id, $2 status (draft|published|archived). Publishing stamps published_at once. */
export const FEED_STATUS_SQL = `
  UPDATE community_posts SET status = $2, published_at = CASE WHEN $2 = 'published' THEN coalesce(published_at, now()) ELSE published_at END,
         updated_at = now()
  WHERE id = $1::uuid RETURNING id::text AS id, status`;
export const FEED_PIN_SQL = `UPDATE community_posts SET pinned = $2, updated_at = now() WHERE id = $1::uuid RETURNING id::text AS id`;
export const FEED_DELETE_SQL = `DELETE FROM community_posts WHERE id = $1::uuid AND status = 'draft' RETURNING id::text AS id`;

/** Replace an event's agenda: $1 post id, $2 time labels[], $3 titles[]. */
export const AGENDA_REPLACE_SQL = `
  WITH del AS (DELETE FROM event_agenda_items WHERE post_id = $1::uuid)
  INSERT INTO event_agenda_items (post_id, time_label, title, sort)
  SELECT $1::uuid, t.l, t.ti, t.n::int - 1 FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS t(l, ti, n)`;
/** Replace an event's speakers: $1 post id, $2 names[], $3 roles[]. */
export const SPEAKERS_REPLACE_SQL = `
  WITH del AS (DELETE FROM event_speakers WHERE post_id = $1::uuid)
  INSERT INTO event_speakers (post_id, name, role, sort)
  SELECT $1::uuid, t.na, t.ro, t.n::int - 1 FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS t(na, ro, n)`;

// ---------- Member board ----------

const TRUSTED = (u: string) => `(EXISTS (SELECT 1 FROM member_posts tp WHERE tp.user_id = ${u} AND tp.status = 'published')
  OR EXISTS (SELECT 1 FROM member_post_replies tr WHERE tr.user_id = ${u} AND tr.status = 'published'))`;

export const POST_COLS = `
  mp.id::text AS id, mp.user_id, mp.kind, mp.title, mp.body, mp.status, mp.hidden_by_reports, mp.review_note,
  mp.last_activity_at, mp.created_at, ${NAME("m", "pr")} AS author_name, ${VISIBLE_PROFILE("pr")} AS author_profile_visible,
  (SELECT count(*)::int FROM member_post_replies r WHERE r.post_id = mp.id AND r.status = 'published' AND NOT r.hidden_by_reports) AS reply_count`;
const POST_FROM = `FROM member_posts mp JOIN members m ON m.user_id = mp.user_id LEFT JOIN profiles pr ON pr.user_id = mp.user_id`;
const PUBLIC_POST = `mp.status = 'published' AND NOT mp.hidden_by_reports AND m.status = 'active'`;

/** $1 user → true when the member already has an approved post or reply (later ones publish straight away). */
export const TRUSTED_SQL = `SELECT ${TRUSTED("$1")} AS trusted`;

/**
 * $1 user, $2 kind, $3 title, $4 body, $5 posts-per-day limit. Status is decided here (first contribution → pending),
 * and nothing is inserted for an inactive member or one over the daily limit.
 */
export const POST_INSERT_SQL = `
  INSERT INTO member_posts (user_id, kind, title, body, status)
  SELECT $1, $2, $3, $4, CASE WHEN ${TRUSTED("$1")} THEN 'published' ELSE 'pending' END
  FROM members m WHERE m.user_id = $1 AND m.status = 'active'
    AND (SELECT count(*) FROM member_posts x WHERE x.user_id = $1 AND x.created_at > now() - interval '24 hours') < $5
  RETURNING id::text AS id, status`;

/** $1 post, $2 user, $3 body, $4 replies-per-day limit. Only on a visible post; bumps the post when published. */
export const REPLY_INSERT_SQL = `
  WITH ins AS (
    INSERT INTO member_post_replies (post_id, user_id, body, status)
    SELECT mp.id, $2, $3, CASE WHEN ${TRUSTED("$2")} THEN 'published' ELSE 'pending' END
    FROM member_posts mp JOIN members m ON m.user_id = mp.user_id JOIN members me ON me.user_id = $2 AND me.status = 'active'
    WHERE mp.id = $1::uuid AND ${PUBLIC_POST}
      AND (SELECT count(*) FROM member_post_replies x WHERE x.user_id = $2 AND x.created_at > now() - interval '24 hours') < $4
    RETURNING id, post_id, status),
  bump AS (UPDATE member_posts SET last_activity_at = now() WHERE id IN (SELECT post_id FROM ins WHERE status = 'published'))
  SELECT id::text AS id, status FROM ins`;

/** $1 kind|null, $2 limit, $3 offset. Published, not hidden, active authors; most recent activity first. */
export const BOARD_SQL = `
  SELECT ${POST_COLS}, count(*) OVER()::int AS total ${POST_FROM}
  WHERE ${PUBLIC_POST} AND ($1::text IS NULL OR mp.kind = $1)
  ORDER BY mp.last_activity_at DESC LIMIT $2 OFFSET $3`;

/** $1 user: their own posts in any status (newest first), for "Your posts" and /me. */
export const MY_POSTS_SQL = `SELECT ${POST_COLS} ${POST_FROM} WHERE mp.user_id = $1 AND mp.status <> 'removed' ORDER BY mp.created_at DESC LIMIT 50`;

/** $1 id, $2 viewer, $3 is admin. Visible when published and not hidden, or it's the viewer's own, or an admin is looking. */
export const POST_ONE_SQL = `
  SELECT ${POST_COLS} ${POST_FROM}
  WHERE mp.id = $1::uuid AND ((${PUBLIC_POST}) OR (mp.user_id = $2 AND mp.status IN ('pending', 'declined', 'published')) OR $3::boolean)`;

/** $1 post, $2 viewer, $3 is admin. */
export const REPLIES_SQL = `
  SELECT r.id::text AS id, r.user_id, r.body, r.status, r.hidden_by_reports, r.created_at,
         ${NAME("m", "pr")} AS author_name, ${VISIBLE_PROFILE("pr")} AS author_profile_visible
  FROM member_post_replies r JOIN members m ON m.user_id = r.user_id LEFT JOIN profiles pr ON pr.user_id = r.user_id
  WHERE r.post_id = $1::uuid
    AND ((r.status = 'published' AND NOT r.hidden_by_reports AND m.status = 'active') OR (r.user_id = $2 AND r.status IN ('pending', 'declined')) OR $3::boolean)
  ORDER BY r.created_at ASC LIMIT 300`;

export const DELETE_OWN_POST_SQL = `DELETE FROM member_posts WHERE id = $1::uuid AND user_id = $2 RETURNING id::text AS id`;
export const DELETE_OWN_REPLY_SQL = `DELETE FROM member_post_replies WHERE id = $1::uuid AND user_id = $2 RETURNING post_id::text AS post_id`;

// ---------- Moderation (John) ----------

/** Pending first contributions and anything hidden by reports or with open reports. */
export const ADMIN_QUEUE_SQL = `
  SELECT 'post' AS type, mp.id::text AS id, mp.id::text AS post_id, mp.title AS post_title, mp.kind, mp.body, mp.status, mp.hidden_by_reports,
         mp.created_at, mp.user_id, ${NAME("m", "pr")} AS author_name,
         (SELECT count(*)::int FROM reports rp WHERE rp.target_type = 'member_post' AND rp.target_id = mp.id::text AND rp.status = 'open') AS open_reports
  FROM member_posts mp JOIN members m ON m.user_id = mp.user_id LEFT JOIN profiles pr ON pr.user_id = mp.user_id
  WHERE mp.status = 'pending' OR mp.hidden_by_reports
     OR (mp.status = 'published' AND EXISTS (SELECT 1 FROM reports rp WHERE rp.target_type = 'member_post' AND rp.target_id = mp.id::text AND rp.status = 'open'))
  UNION ALL
  SELECT 'reply', r.id::text, r.post_id::text, mp.title, mp.kind, r.body, r.status, r.hidden_by_reports, r.created_at, r.user_id,
         ${NAME("m", "pr")},
         (SELECT count(*)::int FROM reports rp WHERE rp.target_type = 'member_reply' AND rp.target_id = r.id::text AND rp.status = 'open')
  FROM member_post_replies r JOIN member_posts mp ON mp.id = r.post_id JOIN members m ON m.user_id = r.user_id LEFT JOIN profiles pr ON pr.user_id = r.user_id
  WHERE r.status = 'pending' OR r.hidden_by_reports
     OR (r.status = 'published' AND EXISTS (SELECT 1 FROM reports rp WHERE rp.target_type = 'member_reply' AND rp.target_id = r.id::text AND rp.status = 'open'))
  ORDER BY created_at ASC LIMIT 200`;

export const ADMIN_QUEUE_COUNT_SQL = `
  SELECT ((SELECT count(*) FROM member_posts WHERE status = 'pending' OR hidden_by_reports)
        + (SELECT count(*) FROM member_post_replies WHERE status = 'pending' OR hidden_by_reports))::int AS n`;

/** $1 id, $2 new status, $3 admin, $4 note, $5 allowed current statuses. Clears the report-hide flag (John looked). */
export const MODERATE_POST_SQL = `
  UPDATE member_posts SET status = $2, hidden_by_reports = false, review_note = $4, reviewed_by = $3, reviewed_at = now(), updated_at = now(),
         last_activity_at = CASE WHEN status = 'pending' AND $2 = 'published' THEN now() ELSE last_activity_at END
  WHERE id = $1::uuid AND status = ANY($5::text[]) RETURNING id::text AS id, user_id, status`;
export const MODERATE_REPLY_SQL = `
  UPDATE member_post_replies SET status = $2, hidden_by_reports = false, review_note = $4, reviewed_by = $3, reviewed_at = now()
  WHERE id = $1::uuid AND status = ANY($5::text[]) RETURNING id::text AS id, user_id, status, post_id::text AS post_id`;

/** $1 target type, $2 target id, $3 admin, $4 'dismissed'|'actioned': close the open reports John just handled. */
export const RESOLVE_REPORTS_SQL = `
  UPDATE reports SET status = $4, resolved_by = $3, resolved_at = now()
  WHERE target_type = $1 AND target_id = $2 AND status = 'open' RETURNING id`;

/** $1 reporter, $2 'member_post'|'member_reply', $3 target id, $4 reason, $5 details. One report per reporter per item. */
export const REPORT_INSERT_SQL = `
  INSERT INTO reports (reporter_user_id, target_type, target_id, reason, details)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (reporter_user_id, target_type, target_id) DO NOTHING RETURNING id`;

/** $1 post id, $2 threshold. */
export const AUTO_HIDE_POST_SQL = `
  UPDATE member_posts SET hidden_by_reports = true, updated_at = now()
  WHERE id = $1::uuid AND NOT hidden_by_reports
    AND (SELECT count(DISTINCT reporter_user_id) FROM reports WHERE target_type = 'member_post' AND target_id = $1::text AND status = 'open') >= $2
  RETURNING id::text AS id`;
export const AUTO_HIDE_REPLY_SQL = `
  UPDATE member_post_replies SET hidden_by_reports = true
  WHERE id = $1::uuid AND NOT hidden_by_reports
    AND (SELECT count(DISTINCT reporter_user_id) FROM reports WHERE target_type = 'member_reply' AND target_id = $1::text AND status = 'open') >= $2
  RETURNING id::text AS id`;

// ---------- Opt-in digest of John's posts ----------

const OPTED_IN = `m.status = 'active' AND m.email IS NOT NULL AND (m.email_prefs->>'community_digest')::boolean IS TRUE`;

export const DIGEST_AUDIENCE_SQL = `SELECT count(*)::int AS n FROM members m WHERE ${OPTED_IN}`;

/** The latest digest, with how many opted-in members haven't received it yet. */
export const LAST_DIGEST_SQL = `
  SELECT d.id::text AS id, d.created_at, d.last_batch_at, d.post_ids::text[] AS post_ids,
         (SELECT count(*)::int FROM community_digest_recipients r WHERE r.digest_id = d.id) AS sent,
         (SELECT count(*)::int FROM members m WHERE ${OPTED_IN}
            AND NOT EXISTS (SELECT 1 FROM community_digest_recipients r WHERE r.digest_id = d.id AND r.user_id = m.user_id)) AS remaining
  FROM community_digests d ORDER BY d.created_at DESC LIMIT 1`;

/** $1 since (timestamptz|null), $2 limit: published posts not in an earlier digest window, plus upcoming events. */
export const DIGEST_CANDIDATES_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c
  WHERE c.status = 'published'
    AND (($1::timestamptz IS NULL AND c.published_at > now() - interval '30 days') OR c.published_at > $1::timestamptz
         OR (c.kind = 'event' AND c.starts_at >= now() AND c.starts_at < now() + interval '60 days'))
  ORDER BY c.pinned DESC, (c.kind = 'event') DESC, coalesce(c.starts_at, c.published_at) ASC LIMIT $2`;

/** $1 admin, $2 post ids[]. */
export const DIGEST_CREATE_SQL = `INSERT INTO community_digests (created_by, post_ids) VALUES ($1, $2::uuid[]) RETURNING id::text AS id, created_at`;

/** $1 digest, $2 limit. Emails are read ONLY here, to send the digest. */
export const DIGEST_TARGETS_SQL = `
  SELECT m.user_id, m.email FROM members m
  WHERE ${OPTED_IN} AND NOT EXISTS (SELECT 1 FROM community_digest_recipients r WHERE r.digest_id = $1::uuid AND r.user_id = m.user_id)
  ORDER BY m.created_at, m.user_id LIMIT $2`;

/** $1 digest, $2 user ids[]: record a sent batch. */
export const DIGEST_MARK_SQL = `
  WITH ins AS (INSERT INTO community_digest_recipients (digest_id, user_id) SELECT $1::uuid, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING 1)
  UPDATE community_digests SET last_batch_at = now() WHERE id = $1::uuid RETURNING (SELECT count(*)::int FROM ins) AS n`;

/** $1 post ids[]: posts for the digest email, in the order they were picked. */
export const DIGEST_POSTS_SQL = `
  SELECT ${FEED_COLS} FROM community_posts c JOIN unnest($1::uuid[]) WITH ORDINALITY AS t(id, n) ON t.id = c.id ORDER BY t.n`;
