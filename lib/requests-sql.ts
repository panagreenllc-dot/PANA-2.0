// Parameterized SQL for the shared request module (lib/requests-repo.ts), used by the app and PGlite tests.
// Every *_LIST / *_ONE query returns the same shape and NEVER selects an email. Only the *_PARTIES queries read
// members.email, and they're used solely to send a notice to the responder or the accepted introduction.

const NAME = (m: string, p: string, fallback: string) => `coalesce(${p}.display_name, ${m}.display_name, '${fallback}')`;
const VISIBLE_PROFILE = (p: string) => `coalesce(${p}.is_published AND ${p}.moderation = 'ok', false)`;
const FRESH = `created_at >= now() - interval '30 days'`;

// ---------- Uniform list shape ----------
// kind, id, status, message, created_at, responded_at, intro_sent_at, intro_error, requester, requester_name,
// requester_profile_visible, responders (text[]), responder_name, subject_title, subject_href, context, extra

const COLLAB_SELECT = `
  SELECT 'collab' AS kind, r.id::text AS id, r.status, r.message, r.created_at, r.responded_at, r.intro_sent_at, r.intro_error,
         r.requester_user_id AS requester, ${NAME("q", "qp", "A PANA member")} AS requester_name,
         ${VISIBLE_PROFILE("qp")} AS requester_profile_visible,
         ARRAY[r.owner_user_id] AS responders, ${NAME("o", "op", "The idea owner")} AS responder_name,
         p.project_name AS subject_title, '/ideas/' || p.id::text AS subject_href, NULL::text AS context, NULL::text AS extra
  FROM collaboration_requests r
  JOIN projects p ON p.id = r.project_id
  LEFT JOIN members q ON q.user_id = r.requester_user_id LEFT JOIN profiles qp ON qp.user_id = r.requester_user_id
  LEFT JOIN members o ON o.user_id = r.owner_user_id LEFT JOIN profiles op ON op.user_id = r.owner_user_id`;

const HELP_SELECT = `
  SELECT 'help' AS kind, h.id::text AS id, h.status, h.message, h.created_at, h.responded_at, h.intro_sent_at, h.intro_error,
         h.helper_user_id AS requester, ${NAME("q", "qp", "A PANA member")} AS requester_name,
         ${VISIBLE_PROFILE("qp")} AS requester_profile_visible,
         ARRAY[h.owner_user_id] AS responders, ${NAME("o", "op", "The idea owner")} AS responder_name,
         p.project_name AS subject_title, '/ideas/' || p.id::text AS subject_href, n.title AS context,
         pa.name AS extra
  FROM help_offers h
  JOIN project_needs n ON n.id = h.need_id
  JOIN projects p ON p.id = n.project_id
  LEFT JOIN partners pa ON pa.id = h.partner_id
  LEFT JOIN members q ON q.user_id = h.helper_user_id LEFT JOIN profiles qp ON qp.user_id = h.helper_user_id
  LEFT JOIN members o ON o.user_id = h.owner_user_id LEFT JOIN profiles op ON op.user_id = h.owner_user_id`;

// For offers the requester may attach one of their own ideas; its name is shown only while the idea is live.
const OFFER_SELECT = `
  SELECT 'offer' AS kind, r.id::text AS id, r.status, r.message, r.created_at, r.responded_at, r.intro_sent_at, r.intro_error,
         r.user_id AS requester, ${NAME("q", "qp", "A PANA member")} AS requester_name,
         ${VISIBLE_PROFILE("qp")} AS requester_profile_visible,
         coalesce((SELECT array_agg(c.user_id ORDER BY c.user_id) FROM partner_contacts c WHERE c.partner_id = o.partner_id), '{}') AS responders,
         pa.name AS responder_name,
         o.title AS subject_title, '/partners/' || pa.slug AS subject_href, pa.name AS context,
         CASE WHEN p.status = 'approved' AND NOT p.hidden_by_reports AND p.audience IN ('public', 'members') THEN p.project_name END AS extra
  FROM offer_requests r
  JOIN resource_offers o ON o.id = r.offer_id
  JOIN partners pa ON pa.id = o.partner_id
  LEFT JOIN projects p ON p.id = r.project_id
  LEFT JOIN members q ON q.user_id = r.user_id LEFT JOIN profiles qp ON qp.user_id = r.user_id`;

// Mentorship: the mentee asks an approved mentor. An attached idea's name is shown only while the idea is live.
const MENTOR_SELECT = `
  SELECT 'mentorship' AS kind, r.id::text AS id, r.status, r.message, r.created_at, r.responded_at, r.intro_sent_at, r.intro_error,
         r.mentee_user_id AS requester, ${NAME("q", "qp", "A PANA member")} AS requester_name,
         ${VISIBLE_PROFILE("qp")} AS requester_profile_visible,
         ARRAY[r.mentor_user_id] AS responders, ${NAME("o", "op", "A PANA mentor")} AS responder_name,
         'Mentorship with ' || ${NAME("o", "op", "a PANA mentor")} AS subject_title, '/mentors/' || r.mentor_user_id AS subject_href,
         CASE WHEN p.status = 'approved' AND NOT p.hidden_by_reports AND p.audience IN ('public', 'members') THEN p.project_name END AS context,
         CASE WHEN p.status = 'approved' AND NOT p.hidden_by_reports AND p.audience IN ('public', 'members') THEN '/ideas/' || p.id::text END AS extra
  FROM mentorship_requests r
  LEFT JOIN projects p ON p.id = r.project_id
  LEFT JOIN members q ON q.user_id = r.mentee_user_id LEFT JOIN profiles qp ON qp.user_id = r.mentee_user_id
  LEFT JOIN members o ON o.user_id = r.mentor_user_id LEFT JOIN profiles op ON op.user_id = r.mentor_user_id`;

// Investor interest: an approved investor on an idea whose owner opted in. context = investor type, extra = organization.
const INVEST_SELECT = `
  SELECT 'investor' AS kind, r.id::text AS id, r.status, r.message, r.created_at, r.responded_at, r.intro_sent_at, r.intro_error,
         r.investor_user_id AS requester, ${NAME("q", "qp", "A PANA investor")} AS requester_name,
         ${VISIBLE_PROFILE("qp")} AS requester_profile_visible,
         ARRAY[r.owner_user_id] AS responders, ${NAME("o", "op", "The idea owner")} AS responder_name,
         p.project_name AS subject_title, '/ideas/' || p.id::text AS subject_href, ip.investor_type AS context, ip.organization AS extra
  FROM investor_interests r
  JOIN projects p ON p.id = r.project_id
  LEFT JOIN investor_profiles ip ON ip.user_id = r.investor_user_id
  LEFT JOIN members q ON q.user_id = r.investor_user_id LEFT JOIN profiles qp ON qp.user_id = r.investor_user_id
  LEFT JOIN members o ON o.user_id = r.owner_user_id LEFT JOIN profiles op ON op.user_id = r.owner_user_id`;

const ORDER = `ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200`;

/** Requests a member sent or may answer. $1 user id */
export const LIST_SQL = {
  collab: `SELECT * FROM (${COLLAB_SELECT}) x WHERE requester = $1 OR $1 = ANY(responders) ${ORDER}`,
  help: `SELECT * FROM (${HELP_SELECT}) x WHERE requester = $1 OR $1 = ANY(responders) ${ORDER}`,
  offer: `SELECT * FROM (${OFFER_SELECT}) x WHERE requester = $1 OR $1 = ANY(responders) ${ORDER}`,
  mentorship: `SELECT * FROM (${MENTOR_SELECT}) x WHERE requester = $1 OR $1 = ANY(responders) ${ORDER}`,
  investor: `SELECT * FROM (${INVEST_SELECT}) x WHERE requester = $1 OR $1 = ANY(responders) ${ORDER}`,
} as const;

/** One request by id (the caller checks the viewer's side). $1 request id */
export const ONE_SQL = {
  collab: `SELECT * FROM (${COLLAB_SELECT}) x WHERE id = $1`,
  help: `SELECT * FROM (${HELP_SELECT}) x WHERE id = $1`,
  offer: `SELECT * FROM (${OFFER_SELECT}) x WHERE id = $1`,
  mentorship: `SELECT * FROM (${MENTOR_SELECT}) x WHERE id = $1`,
  investor: `SELECT * FROM (${INVEST_SELECT}) x WHERE id = $1`,
} as const;

/** Offer requests that only PANA can answer (the partner has no linked contacts yet). No params. */
export const ADMIN_OFFER_REQUESTS_SQL = `SELECT * FROM (${OFFER_SELECT}) x WHERE cardinality(responders) = 0 ${ORDER}`;

/** Offer requests for one partner (partner portal / admin). $1 partner id */
export const PARTNER_OFFER_REQUESTS_SQL = `
  SELECT x.* FROM (${OFFER_SELECT}) x JOIN offer_requests r ON r.id::text = x.id JOIN resource_offers o ON o.id = r.offer_id
  WHERE o.partner_id::text = $1 ORDER BY (x.status = 'pending') DESC, x.created_at DESC LIMIT 200`;

/** Help offers a partner's contacts sent on the organization's behalf. $1 partner id */
export const PARTNER_HELP_OFFERS_SQL = `
  SELECT x.* FROM (${HELP_SELECT}) x JOIN help_offers h ON h.id::text = x.id
  WHERE h.partner_id::text = $1 ORDER BY x.created_at DESC LIMIT 200`;

// ---------- Create ----------

/** $1 need id, $2 helper, $3 message, $4 partner id|null (must be a partner the helper is a contact of; checked in SQL).
 *  Only for an open need on an approved, visible idea, never the helper's own. */
export const HELP_INSERT_SQL = `
  INSERT INTO help_offers (need_id, helper_user_id, owner_user_id, message, partner_id)
  SELECT n.id, $2, n.owner_user_id, $3,
         (SELECT c.partner_id FROM partner_contacts c JOIN partners pa ON pa.id = c.partner_id
          WHERE c.user_id = $2 AND c.partner_id::text = $4 AND pa.status = 'approved')
  FROM project_needs n JOIN projects p ON p.id = n.project_id
  WHERE n.id::text = $1 AND n.status = 'open' AND n.owner_user_id <> $2 AND p.user_id = n.owner_user_id
    AND p.status = 'approved' AND NOT p.hidden_by_reports
  ON CONFLICT (need_id, helper_user_id) WHERE status = 'pending' DO NOTHING
  RETURNING id::text AS id`;

/** $1 offer id, $2 member, $3 message, $4 project id|null (only the member's own idea). Only live request_via_pana offers. */
export const OFFER_REQUEST_INSERT_SQL = `
  INSERT INTO offer_requests (offer_id, user_id, message, project_id)
  SELECT o.id, $2, $3, (SELECT p.id FROM projects p WHERE p.id::text = $4 AND p.user_id = $2)
  FROM resource_offers o JOIN partners pa ON pa.id = o.partner_id
  WHERE o.id::text = $1 AND o.claim_method = 'request_via_pana' AND o.status = 'published' AND pa.status = 'approved'
    AND (o.ends_on IS NULL OR o.ends_on >= (now() AT TIME ZONE 'America/New_York')::date)
  ON CONFLICT (offer_id, user_id) WHERE status = 'pending' DO NOTHING
  RETURNING id::text AS id`;

/** $1 mentor user id, $2 mentee, $3 message, $4 project id|null (only the mentee's own idea).
 *  Only to an approved mentor with an active account who still has room (pending + accepted in the last 90 days). */
export const MENTORSHIP_INSERT_SQL = `
  INSERT INTO mentorship_requests (mentor_user_id, mentee_user_id, message, project_id)
  SELECT mp.user_id, $2, $3, (SELECT p.id FROM projects p WHERE p.id::text = $4 AND p.user_id = $2)
  FROM mentor_profiles mp JOIN members m ON m.user_id = mp.user_id
  WHERE mp.user_id = $1 AND mp.status = 'approved' AND m.status = 'active' AND mp.user_id <> $2
    AND (SELECT count(*) FROM mentorship_requests r WHERE r.mentor_user_id = mp.user_id
         AND ((r.status = 'pending' AND r.created_at >= now() - interval '30 days')
              OR (r.status = 'accepted' AND r.responded_at >= now() - interval '90 days'))) < mp.max_open_mentees
  ON CONFLICT (mentee_user_id, mentor_user_id) WHERE status = 'pending' DO NOTHING
  RETURNING id::text AS id`;

/** $1 idea id, $2 investor, $3 message. Only an approved investor with an active account, only on a live idea
 *  (public or members) whose owner turned on investor interest, never their own. */
export const INVESTOR_INSERT_SQL = `
  INSERT INTO investor_interests (project_id, investor_user_id, owner_user_id, message)
  SELECT p.id, $2, p.user_id, $3
  FROM projects p
  JOIN investor_profiles ip ON ip.user_id = $2 AND ip.status = 'approved'
  JOIN members m ON m.user_id = $2 AND m.status = 'active'
  WHERE p.id::text = $1 AND p.status = 'approved' AND NOT p.hidden_by_reports AND p.investor_interest_open
    AND p.audience IN ('public', 'members') AND p.user_id IS NOT NULL AND p.user_id <> $2
  ON CONFLICT (project_id, investor_user_id) WHERE status = 'pending' DO NOTHING
  RETURNING id::text AS id`;

/** Does the member already have an open request? $1 target id, $2 member */
export const HAS_OPEN_SQL = {
  collab: `SELECT 1 FROM collaboration_requests WHERE project_id::text = $1 AND requester_user_id = $2 AND status = 'pending' AND ${FRESH} LIMIT 1`,
  help: `SELECT 1 FROM help_offers WHERE need_id::text = $1 AND helper_user_id = $2 AND status = 'pending' AND ${FRESH} LIMIT 1`,
  offer: `SELECT 1 FROM offer_requests WHERE offer_id::text = $1 AND user_id = $2 AND status = 'pending' AND ${FRESH} LIMIT 1`,
  mentorship: `SELECT 1 FROM mentorship_requests WHERE mentor_user_id = $1 AND mentee_user_id = $2 AND status = 'pending' AND ${FRESH} LIMIT 1`,
  investor: `SELECT 1 FROM investor_interests WHERE project_id::text = $1 AND investor_user_id = $2 AND status = 'pending' AND ${FRESH} LIMIT 1`,
} as const;

/** Per-kind daily counts (on top of the shared limit). $1 member */
export const SENT_LAST_DAY_KIND_SQL = {
  mentorship: `SELECT count(*)::int AS n FROM mentorship_requests WHERE mentee_user_id = $1 AND created_at > now() - interval '24 hours'`,
  investor: `SELECT count(*)::int AS n FROM investor_interests WHERE investor_user_id = $1 AND created_at > now() - interval '24 hours'`,
} as const;

/** Shared daily limit across every kind. $1 member */
export const SENT_LAST_DAY_ALL_SQL = `
  SELECT (SELECT count(*) FROM collaboration_requests WHERE requester_user_id = $1 AND created_at > now() - interval '24 hours')
       + (SELECT count(*) FROM help_offers WHERE helper_user_id = $1 AND created_at > now() - interval '24 hours')
       + (SELECT count(*) FROM offer_requests WHERE user_id = $1 AND created_at > now() - interval '24 hours')
       + (SELECT count(*) FROM mentorship_requests WHERE mentee_user_id = $1 AND created_at > now() - interval '24 hours')
       + (SELECT count(*) FROM investor_interests WHERE investor_user_id = $1 AND created_at > now() - interval '24 hours') AS n`;

// ---------- Respond / withdraw / expire ----------

/** Accept or decline. Only a responder, only pending, only unexpired. $1 id, $2 actor, $3 'accepted'|'declined', $4 actor is admin */
export const RESPOND_SQL = {
  collab: `
    UPDATE collaboration_requests SET status = $3, responded_at = now()
    WHERE id::text = $1 AND owner_user_id = $2 AND status = 'pending' AND ${FRESH} AND $3 IN ('accepted', 'declined') AND $4::boolean IS NOT NULL
    RETURNING id::text AS id`,
  help: `
    UPDATE help_offers SET status = $3, responded_at = now()
    WHERE id::text = $1 AND owner_user_id = $2 AND status = 'pending' AND ${FRESH} AND $3 IN ('accepted', 'declined') AND $4::boolean IS NOT NULL
    RETURNING id::text AS id`,
  offer: `
    UPDATE offer_requests r SET status = $3, responded_at = now(), responded_by = $2
    FROM resource_offers o
    WHERE r.id::text = $1 AND o.id = r.offer_id AND r.status = 'pending' AND r.${FRESH} AND $3 IN ('accepted', 'declined')
      AND r.user_id <> $2
      AND ($4::boolean OR EXISTS (SELECT 1 FROM partner_contacts c WHERE c.partner_id = o.partner_id AND c.user_id = $2))
    RETURNING r.id::text AS id`,
  mentorship: `
    UPDATE mentorship_requests SET status = $3, responded_at = now()
    WHERE id::text = $1 AND mentor_user_id = $2 AND status = 'pending' AND ${FRESH} AND $3 IN ('accepted', 'declined') AND $4::boolean IS NOT NULL
    RETURNING id::text AS id`,
  investor: `
    UPDATE investor_interests SET status = $3, responded_at = now()
    WHERE id::text = $1 AND owner_user_id = $2 AND status = 'pending' AND ${FRESH} AND $3 IN ('accepted', 'declined') AND $4::boolean IS NOT NULL
    RETURNING id::text AS id`,
} as const;

/** $1 id, $2 requester */
export const WITHDRAW_SQL = {
  collab: `UPDATE collaboration_requests SET status = 'withdrawn', responded_at = now() WHERE id::text = $1 AND requester_user_id = $2 AND status = 'pending' RETURNING id::text AS id`,
  help: `UPDATE help_offers SET status = 'withdrawn', responded_at = now() WHERE id::text = $1 AND helper_user_id = $2 AND status = 'pending' RETURNING id::text AS id`,
  offer: `UPDATE offer_requests SET status = 'withdrawn', responded_at = now() WHERE id::text = $1 AND user_id = $2 AND status = 'pending' RETURNING id::text AS id`,
  mentorship: `UPDATE mentorship_requests SET status = 'withdrawn', responded_at = now() WHERE id::text = $1 AND mentee_user_id = $2 AND status = 'pending' RETURNING id::text AS id`,
  investor: `UPDATE investor_interests SET status = 'withdrawn', responded_at = now() WHERE id::text = $1 AND investor_user_id = $2 AND status = 'pending' RETURNING id::text AS id`,
} as const;

/** Lazy 30-day expiry for every kind (no cron). No params. */
export const EXPIRE_ALL_SQL = [
  `UPDATE collaboration_requests SET status = 'expired', responded_at = now() WHERE status = 'pending' AND created_at < now() - interval '30 days'`,
  `UPDATE help_offers SET status = 'expired', responded_at = now() WHERE status = 'pending' AND created_at < now() - interval '30 days'`,
  `UPDATE offer_requests SET status = 'expired', responded_at = now() WHERE status = 'pending' AND created_at < now() - interval '30 days'`,
  `UPDATE mentorship_requests SET status = 'expired', responded_at = now() WHERE status = 'pending' AND created_at < now() - interval '30 days'`,
  `UPDATE investor_interests SET status = 'expired', responded_at = now() WHERE status = 'pending' AND created_at < now() - interval '30 days'`,
];

/** Record introduction delivery. $1 id, $2 sent (bool), $3 email id, $4 error */
export const INTRO_RESULT_SQL = {
  collab: `UPDATE collaboration_requests SET intro_sent_at = CASE WHEN $2::boolean THEN now() END, intro_email_id = $3, intro_error = $4 WHERE id::text = $1`,
  help: `UPDATE help_offers SET intro_sent_at = CASE WHEN $2::boolean THEN now() END, intro_email_id = $3, intro_error = $4 WHERE id::text = $1`,
  offer: `UPDATE offer_requests SET intro_sent_at = CASE WHEN $2::boolean THEN now() END, intro_email_id = $3, intro_error = $4 WHERE id::text = $1`,
  mentorship: `UPDATE mentorship_requests SET intro_sent_at = CASE WHEN $2::boolean THEN now() END, intro_email_id = $3, intro_error = $4 WHERE id::text = $1`,
  investor: `UPDATE investor_interests SET intro_sent_at = CASE WHEN $2::boolean THEN now() END, intro_email_id = $3, intro_error = $4 WHERE id::text = $1`,
} as const;

export const NOTIFIED_SQL = {
  collab: `UPDATE collaboration_requests SET owner_notified_at = now() WHERE id::text = $1`,
  help: `UPDATE help_offers SET owner_notified_at = now() WHERE id::text = $1`,
  offer: `UPDATE offer_requests SET responder_notified_at = now() WHERE id::text = $1`,
  mentorship: `UPDATE mentorship_requests SET mentor_notified_at = now() WHERE id::text = $1`,
  investor: `UPDATE investor_interests SET owner_notified_at = now() WHERE id::text = $1`,
} as const;

// ---------- Parties (emails) — used ONLY to notify the responder or send the accepted introduction ----------

/** $1 request id. Uniform shape: requester_email/name, responder_email/name, notify_emails (text[]), status,
 *  responded_by, subject_title, context, href, message, extra. */
export const PARTIES_SQL = {
  collab: `
    SELECT r.id::text AS id, r.status, r.message, p.project_name AS subject_title, NULL::text AS context, '/ideas/' || p.id::text AS href,
           NULL::text AS extra, q.email AS requester_email, ${NAME("q", "qp", "A PANA member")} AS requester_name,
           o.email AS responder_email, ${NAME("o", "op", "The idea owner")} AS responder_name, r.owner_user_id AS responded_by,
           CASE WHEN o.status = 'active' AND coalesce((o.email_prefs->>'requests')::boolean, true) THEN ARRAY[o.email] ELSE '{}' END AS notify_emails
    FROM collaboration_requests r JOIN projects p ON p.id = r.project_id
    JOIN members o ON o.user_id = r.owner_user_id JOIN members q ON q.user_id = r.requester_user_id
    LEFT JOIN profiles op ON op.user_id = r.owner_user_id LEFT JOIN profiles qp ON qp.user_id = r.requester_user_id
    WHERE r.id::text = $1`,
  help: `
    SELECT h.id::text AS id, h.status, h.message, p.project_name AS subject_title, n.title AS context, '/ideas/' || p.id::text AS href,
           pa.name AS extra, q.email AS requester_email, ${NAME("q", "qp", "A PANA member")} AS requester_name,
           o.email AS responder_email, ${NAME("o", "op", "The idea owner")} AS responder_name, h.owner_user_id AS responded_by,
           CASE WHEN o.status = 'active' AND coalesce((o.email_prefs->>'requests')::boolean, true) THEN ARRAY[o.email] ELSE '{}' END AS notify_emails
    FROM help_offers h JOIN project_needs n ON n.id = h.need_id JOIN projects p ON p.id = n.project_id
    LEFT JOIN partners pa ON pa.id = h.partner_id
    JOIN members o ON o.user_id = h.owner_user_id JOIN members q ON q.user_id = h.helper_user_id
    LEFT JOIN profiles op ON op.user_id = h.owner_user_id LEFT JOIN profiles qp ON qp.user_id = h.helper_user_id
    WHERE h.id::text = $1`,
  offer: `
    SELECT r.id::text AS id, r.status, r.message, o.title AS subject_title, pa.name AS context, '/partners/' || pa.slug AS href,
           NULL::text AS extra, q.email AS requester_email, ${NAME("q", "qp", "A PANA member")} AS requester_name,
           rm.email AS responder_email,
           CASE WHEN rc.user_id IS NOT NULL THEN ${NAME("rm", "rp", "A partner contact")} END AS responder_name,
           r.responded_by,
           coalesce((SELECT array_agg(m.email) FROM partner_contacts c JOIN members m ON m.user_id = c.user_id
                     WHERE c.partner_id = o.partner_id AND m.status = 'active' AND m.email IS NOT NULL
                       AND coalesce((m.email_prefs->>'requests')::boolean, true)), '{}') AS notify_emails,
           (SELECT count(*)::int FROM partner_contacts c WHERE c.partner_id = o.partner_id) AS contact_count
    FROM offer_requests r JOIN resource_offers o ON o.id = r.offer_id JOIN partners pa ON pa.id = o.partner_id
    JOIN members q ON q.user_id = r.user_id LEFT JOIN profiles qp ON qp.user_id = r.user_id
    LEFT JOIN partner_contacts rc ON rc.partner_id = o.partner_id AND rc.user_id = r.responded_by
    LEFT JOIN members rm ON rm.user_id = rc.user_id LEFT JOIN profiles rp ON rp.user_id = rc.user_id
    WHERE r.id::text = $1`,
  mentorship: `
    SELECT r.id::text AS id, r.status, r.message, 'mentorship' AS subject_title,
           CASE WHEN p.status = 'approved' AND NOT p.hidden_by_reports AND p.audience IN ('public', 'members') THEN p.project_name END AS context,
           '/mentors/' || r.mentor_user_id AS href, NULL::text AS extra,
           q.email AS requester_email, ${NAME("q", "qp", "A PANA member")} AS requester_name,
           o.email AS responder_email, ${NAME("o", "op", "A PANA mentor")} AS responder_name, r.mentor_user_id AS responded_by,
           CASE WHEN o.status = 'active' AND coalesce((o.email_prefs->>'requests')::boolean, true) THEN ARRAY[o.email] ELSE '{}' END AS notify_emails
    FROM mentorship_requests r LEFT JOIN projects p ON p.id = r.project_id
    JOIN members o ON o.user_id = r.mentor_user_id JOIN members q ON q.user_id = r.mentee_user_id
    LEFT JOIN profiles op ON op.user_id = r.mentor_user_id LEFT JOIN profiles qp ON qp.user_id = r.mentee_user_id
    WHERE r.id::text = $1`,
  investor: `
    SELECT r.id::text AS id, r.status, r.message, p.project_name AS subject_title, ip.investor_type AS context, '/ideas/' || p.id::text AS href,
           ip.organization AS extra, q.email AS requester_email, ${NAME("q", "qp", "A PANA investor")} AS requester_name,
           o.email AS responder_email, ${NAME("o", "op", "The idea owner")} AS responder_name, r.owner_user_id AS responded_by,
           CASE WHEN o.status = 'active' AND coalesce((o.email_prefs->>'requests')::boolean, true) THEN ARRAY[o.email] ELSE '{}' END AS notify_emails
    FROM investor_interests r JOIN projects p ON p.id = r.project_id
    LEFT JOIN investor_profiles ip ON ip.user_id = r.investor_user_id
    JOIN members o ON o.user_id = r.owner_user_id JOIN members q ON q.user_id = r.investor_user_id
    LEFT JOIN profiles op ON op.user_id = r.owner_user_id LEFT JOIN profiles qp ON qp.user_id = r.investor_user_id
    WHERE r.id::text = $1`,
} as const;
