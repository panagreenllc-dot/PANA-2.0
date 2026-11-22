// Parameterized P3-2a SQL shared by the app (Neon) and the PGlite tests (db/partners.test.mjs).
// Never selects members.email. partner_inquiries.contact_email is selected ONLY by ADMIN_INQUIRIES_SQL (admin pages)
// and INQUIRY_CONFIRM_SQL (the submitter's own confirmation). Calendar days are selected as text.

/** Today's date in ET, for offer expiry. */
const TODAY_ET = `(now() AT TIME ZONE 'America/New_York')::date`;

export const PARTNER_COLS = `
  p.id::text AS id, p.slug, p.name, p.kind, p.summary, p.website, p.area, p.status, p.public_listing,
  p.approved_at, p.created_at, p.updated_at`;

export const OFFER_COLS = `
  o.id::text AS id, o.partner_id::text AS partner_id, o.type, o.title, o.description, o.location_name, o.address,
  o.schedule_text, o.starts_on::text AS starts_on, o.ends_on::text AS ends_on, o.capacity_text, o.eligibility,
  o.cohort_id::text AS cohort_id, o.claim_method, o.external_url, o.how_to, o.status, o.review_note,
  o.approved_at, o.created_at, o.updated_at`;

/** An offer anyone may see listed: published, partner approved, not past its end date (ET). */
export const LIVE_OFFER = `o.status = 'published' AND p.status = 'approved' AND (o.ends_on IS NULL OR o.ends_on >= ${TODAY_ET})`;

/** /partners directory. No params. */
export const PUBLIC_PARTNERS_SQL = `
  SELECT ${PARTNER_COLS},
         (SELECT count(*)::int FROM resource_offers o WHERE o.partner_id = p.id AND ${LIVE_OFFER}) AS live_offers
  FROM partners p
  WHERE p.status = 'approved' AND p.public_listing
  ORDER BY p.name ASC LIMIT 200`;

/** /partners/[slug]. $1 slug */
export const PUBLIC_PARTNER_SQL = `
  SELECT ${PARTNER_COLS} FROM partners p WHERE p.slug = $1 AND p.status = 'approved' AND p.public_listing`;

/** Live offers of one partner. $1 partner id */
export const PARTNER_LIVE_OFFERS_SQL = `
  SELECT ${OFFER_COLS}, p.name AS partner_name, p.slug AS partner_slug, p.area AS partner_area
  FROM resource_offers o JOIN partners p ON p.id = o.partner_id
  WHERE o.partner_id::text = $1 AND ${LIVE_OFFER}
  ORDER BY o.type, o.title`;

/** Every live offer, for /incubator/resources (filtered for the viewer in code). Listed or unlisted partners. No params. */
export const ALL_LIVE_OFFERS_SQL = `
  SELECT ${OFFER_COLS}, p.name AS partner_name, p.slug AS partner_slug, p.area AS partner_area, p.public_listing AS partner_listed
  FROM resource_offers o JOIN partners p ON p.id = o.partner_id
  WHERE ${LIVE_OFFER}
  ORDER BY o.type, p.name, o.title LIMIT 500`;

/** Cohorts where the member is an active participant. $1 user id */
export const PARTICIPANT_COHORTS_SQL = `
  SELECT a.cohort_id::text AS cohort_id FROM incubator_applications a
  JOIN members m ON m.user_id = a.user_id AND m.status = 'active'
  WHERE a.user_id = $1 AND a.status = 'accepted' AND a.participant_status = 'active'`;

// ---------- Inquiries ----------

/** $1 org, $2 contact name, $3 contact email, $4 kind, $5 can_offer text[], $6 message */
export const INSERT_INQUIRY_SQL = `
  INSERT INTO partner_inquiries (org_name, contact_name, contact_email, kind, can_offer, message)
  VALUES ($1, $2, $3, $4, $5::text[], $6) RETURNING id::text AS id`;

/** Admin inbox. $1 'open' (new + contacted) or a single status. Admin pages only (contains contact emails). */
export const ADMIN_INQUIRIES_SQL = `
  SELECT i.id::text AS id, i.org_name, i.contact_name, i.contact_email, i.kind, i.can_offer, i.message, i.status,
         i.partner_id::text AS partner_id, i.admin_note, i.handled_at, i.created_at, p.slug AS partner_slug, p.name AS partner_name
  FROM partner_inquiries i LEFT JOIN partners p ON p.id = i.partner_id
  WHERE ($1 = 'open' AND i.status IN ('new', 'contacted')) OR i.status = $1
  ORDER BY i.created_at DESC LIMIT 200`;

/** $1 id, $2 status (contacted|declined|spam|new), $3 admin id, $4 note (null keeps) */
export const INQUIRY_STATUS_SQL = `
  UPDATE partner_inquiries SET status = $2, admin_note = coalesce($4, admin_note), handled_by = $3, handled_at = now()
  WHERE id::text = $1 AND status <> 'converted' AND $2 IN ('new', 'contacted', 'declined', 'spam')
  RETURNING id::text AS id`;

/** Convert: create a pending partner from the inquiry and link it. $1 inquiry id, $2 slug, $3 admin id */
export const CONVERT_INQUIRY_SQL = `
  WITH i AS (SELECT * FROM partner_inquiries WHERE id::text = $1 AND status IN ('new', 'contacted')),
  np AS (INSERT INTO partners (slug, name, kind, created_by) SELECT $2, i.org_name, i.kind, $3 FROM i RETURNING id),
  up AS (UPDATE partner_inquiries SET status = 'converted', partner_id = (SELECT id FROM np), handled_by = $3, handled_at = now()
         WHERE id::text = $1 AND EXISTS (SELECT 1 FROM np) RETURNING id)
  SELECT id::text AS partner_id FROM np`;

/** Lazy retention sweep: declined and spam inquiries are deleted after 12 months. No params. */
export const PURGE_INQUIRIES_SQL = `
  DELETE FROM partner_inquiries WHERE status IN ('declined', 'spam') AND created_at < now() - interval '12 months'`;

// ---------- Partners (admin) ----------

export const ADMIN_PARTNERS_SQL = `
  SELECT ${PARTNER_COLS}, p.admin_note,
         count(o.id) FILTER (WHERE o.status = 'published')::int AS published,
         count(o.id) FILTER (WHERE o.status = 'pending')::int AS pending_offers,
         count(o.id)::int AS total_offers
  FROM partners p LEFT JOIN resource_offers o ON o.partner_id = p.id
  WHERE p.status <> 'removed' OR $1::boolean
  GROUP BY p.id
  ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, p.name`;

/** $1 id, $2 status, $3 admin id. Approving stamps approved_by/at. */
export const PARTNER_STATUS_SQL = `
  UPDATE partners SET status = $2,
    approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
    approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id::text = $1 AND $2 IN ('pending', 'approved', 'paused', 'removed') AND status <> $2
  RETURNING id::text AS id`;

// ---------- Offers (admin) ----------

/** Offers waiting for John. No params. */
export const PENDING_OFFERS_SQL = `
  SELECT ${OFFER_COLS}, p.name AS partner_name, p.status AS partner_status
  FROM resource_offers o JOIN partners p ON p.id = o.partner_id
  WHERE o.status = 'pending' ORDER BY o.created_at ASC`;

/** All offers of one partner (admin). $1 partner id */
export const ADMIN_PARTNER_OFFERS_SQL = `
  SELECT ${OFFER_COLS}, c.name AS cohort_name,
         (o.ends_on IS NOT NULL AND o.ends_on < ${TODAY_ET}) AS past_end
  FROM resource_offers o LEFT JOIN incubator_cohorts c ON c.id = o.cohort_id
  WHERE o.partner_id::text = $1
  ORDER BY CASE o.status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 WHEN 'draft' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, o.created_at DESC`;

/**
 * Offer status change. $1 id, $2 action (publish|send_back|pause|archive|submit), $3 admin id, $4 note (send_back)
 * publish: from draft/pending/paused, only if not past its end date. send_back: pending → draft with a note.
 * pause: published → paused. archive: anything but archived. submit: draft → pending.
 */
export const OFFER_ACTION_SQL = `
  UPDATE resource_offers SET
    status = CASE $2 WHEN 'publish' THEN 'published' WHEN 'send_back' THEN 'draft' WHEN 'pause' THEN 'paused'
                     WHEN 'archive' THEN 'archived' WHEN 'submit' THEN 'pending' END,
    review_note = CASE WHEN $2 = 'send_back' THEN $4 WHEN $2 = 'publish' THEN NULL ELSE review_note END,
    approved_by = CASE WHEN $2 = 'publish' THEN $3 ELSE approved_by END,
    approved_at = CASE WHEN $2 = 'publish' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id::text = $1
    AND (($2 = 'publish' AND status IN ('draft', 'pending', 'paused') AND (ends_on IS NULL OR ends_on >= ${TODAY_ET}))
      OR ($2 = 'send_back' AND status = 'pending')
      OR ($2 = 'pause' AND status = 'published')
      OR ($2 = 'archive' AND status <> 'archived')
      OR ($2 = 'submit' AND status = 'draft'))
  RETURNING id::text AS id, partner_id::text AS partner_id, status`;

/** Lazy expiry sweep (no cron): published or paused offers past their end date become expired. No params. */
export const EXPIRE_OFFERS_SQL = `
  UPDATE resource_offers SET status = 'expired', updated_at = now()
  WHERE status IN ('published', 'paused') AND ends_on IS NOT NULL AND ends_on < ${TODAY_ET}`;

/** Admin to-do count for the header badge. No params. */
export const PARTNER_TODO_SQL = `
  SELECT (SELECT count(*) FROM partner_inquiries WHERE status = 'new')
       + (SELECT count(*) FROM partners WHERE status = 'pending')
       + (SELECT count(*) FROM resource_offers WHERE status = 'pending') AS n`;

// ---------- Badges ----------

/** End of the cohort's last day in ET, or NULL when the cohort has no end date. */
const BADGE_EXPIRY = `CASE WHEN c.ends_on IS NULL THEN NULL ELSE ((c.ends_on + 1)::timestamp AT TIME ZONE 'America/New_York') END`;

/** Issue the badge for an active participant (idempotent). $1 application id, $2 nonce, $3 token hash */
export const ISSUE_BADGE_SQL = `
  INSERT INTO incubator_credentials (user_id, application_id, token_nonce, token_hash, expires_at)
  SELECT a.user_id, a.id, $2, $3, ${BADGE_EXPIRY}
  FROM incubator_applications a JOIN incubator_cohorts c ON c.id = a.cohort_id
  JOIN members m ON m.user_id = a.user_id AND m.status = 'active'
  WHERE a.id::text = $1 AND a.status = 'accepted' AND a.participant_status = 'active'
  ON CONFLICT (application_id) DO NOTHING
  RETURNING id::text AS id`;

/** Active-participant applications of a member that have no badge row yet (for lazy issue on /me/badge). $1 user id */
export const UNBADGED_APPLICATIONS_SQL = `
  SELECT a.id::text AS id FROM incubator_applications a
  WHERE a.user_id = $1 AND a.status = 'accepted' AND a.participant_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM incubator_credentials k WHERE k.application_id = a.id)`;

const BADGE_JOIN = `
  FROM incubator_credentials k
  JOIN incubator_applications a ON a.id = k.application_id
  JOIN incubator_cohorts c ON c.id = a.cohort_id
  JOIN members m ON m.user_id = k.user_id
  LEFT JOIN profiles pr ON pr.user_id = k.user_id`;

const BADGE_FIELDS = `
  k.id::text AS id, k.user_id, k.issued_at, k.code_rotated_at, k.expires_at, k.revoked_at, k.revoke_reason,
  k.revoked_by, k.last_checked_at, k.check_count, a.status AS app_status, a.participant_status, m.status AS member_status,
  c.name AS cohort_name, c.ends_on::text AS cohort_ends_on, coalesce(pr.display_name, m.display_name) AS display_name`;

/** The member's badges, newest first (includes the nonce, so the server can rebuild the QR). $1 user id */
export const MY_BADGES_SQL = `SELECT ${BADGE_FIELDS}, k.token_nonce ${BADGE_JOIN} WHERE k.user_id = $1 ORDER BY k.issued_at DESC`;

/** "Get a new code": new nonce/hash for the member's own unrevoked badge. $1 user id, $2 badge id, $3 nonce, $4 hash */
export const ROTATE_BADGE_SQL = `
  UPDATE incubator_credentials SET token_nonce = $3, token_hash = $4, code_rotated_at = now()
  WHERE id::text = $2 AND user_id = $1 AND revoked_at IS NULL RETURNING id::text AS id`;

/** Verify-page lookup; also bumps the check count and time (never who or where). $1 token hash */
export const VERIFY_BADGE_SQL = `
  WITH k AS (UPDATE incubator_credentials SET check_count = check_count + 1, last_checked_at = now()
             WHERE token_hash = $1 RETURNING *)
  SELECT ${BADGE_FIELDS} ${BADGE_JOIN.replace("FROM incubator_credentials k", "FROM k")}`;

/** Admin list (no emails). No params. */
export const ADMIN_BADGES_SQL = `SELECT ${BADGE_FIELDS}, a.cohort_id::text AS cohort_id ${BADGE_JOIN}
  ORDER BY (k.revoked_at IS NULL) DESC, c.name, k.issued_at DESC LIMIT 500`;

/** $1 badge id, $2 reason, $3 admin id (or 'system') */
export const REVOKE_BADGE_SQL = `
  UPDATE incubator_credentials SET revoked_at = now(), revoke_reason = $2, revoked_by = $3
  WHERE id::text = $1 AND revoked_at IS NULL RETURNING id::text AS id`;

/** Reinstate with a NEW code (the old QR stays dead). $1 badge id, $2 nonce, $3 hash */
export const REINSTATE_BADGE_SQL = `
  UPDATE incubator_credentials SET revoked_at = NULL, revoke_reason = NULL, revoked_by = NULL,
         token_nonce = $2, token_hash = $3, code_rotated_at = now()
  WHERE id::text = $1 AND revoked_at IS NOT NULL RETURNING id::text AS id`;

/** Badge row of an application (for participant status changes). $1 application id */
export const BADGE_FOR_APPLICATION_SQL = `
  SELECT id::text AS id, revoked_at, revoke_reason, revoked_by FROM incubator_credentials WHERE application_id::text = $1`;
