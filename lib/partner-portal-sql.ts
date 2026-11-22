// Partner contacts, proposed listing changes and partner-portal offer actions (P3-2b). Never selects an email.

const MEMBER_NAME = `coalesce(pr.display_name, m.display_name, 'A PANA member')`;

/** Contacts of one partner (admin). $1 partner id */
export const PARTNER_CONTACTS_SQL = `
  SELECT c.id::text AS id, c.user_id, c.role, c.created_at, ${MEMBER_NAME} AS name, m.status AS member_status
  FROM partner_contacts c JOIN members m ON m.user_id = c.user_id LEFT JOIN profiles pr ON pr.user_id = c.user_id
  WHERE c.partner_id::text = $1 ORDER BY c.role, name`;

/** Link a member (active, finished joining) as a contact, or change their role. $1 partner, $2 user, $3 role, $4 admin */
export const ADD_CONTACT_SQL = `
  INSERT INTO partner_contacts (partner_id, user_id, role, added_by)
  SELECT p.id, m.user_id, $3, $4 FROM partners p JOIN members m ON m.user_id = $2
  WHERE p.id::text = $1 AND m.status = 'active' AND m.terms_accepted_at IS NOT NULL AND $3 IN ('manager', 'staff')
  ON CONFLICT (partner_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING id::text AS id`;

/** $1 contact id, $2 partner id */
export const REMOVE_CONTACT_SQL = `DELETE FROM partner_contacts WHERE id::text = $1 AND partner_id::text = $2 RETURNING user_id`;

/** Admin member search by NAME only (never by email). $1 like pattern, $2 partner id (excludes existing contacts) */
export const MEMBER_SEARCH_SQL = `
  SELECT m.user_id, ${MEMBER_NAME} AS name, m.created_at, (pr.user_id IS NOT NULL AND pr.is_published) AS has_profile
  FROM members m LEFT JOIN profiles pr ON pr.user_id = m.user_id
  WHERE m.status = 'active' AND m.terms_accepted_at IS NOT NULL
    AND (pr.display_name ILIKE $1 OR m.display_name ILIKE $1)
    AND NOT EXISTS (SELECT 1 FROM partner_contacts c WHERE c.user_id = m.user_id AND c.partner_id::text = $2)
  ORDER BY name LIMIT 10`;

/** Partners this member is a contact for. $1 user */
export const MY_PARTNERS_SQL = `
  SELECT p.id::text AS id, p.slug, p.name, p.kind, p.summary, p.website, p.area, p.status, p.public_listing,
         p.pending_changes, c.role
  FROM partner_contacts c JOIN partners p ON p.id = c.partner_id
  WHERE c.user_id = $1 AND p.status <> 'removed' ORDER BY p.name`;

/** Is this member a contact of this partner? $1 partner id, $2 user */
export const IS_CONTACT_SQL = `
  SELECT c.role FROM partner_contacts c JOIN partners p ON p.id = c.partner_id
  WHERE c.partner_id::text = $1 AND c.user_id = $2 AND p.status <> 'removed'`;

/** Contact proposes listing text; the live listing is unchanged until John approves. $1 partner, $2 user, $3 json */
export const PROPOSE_CHANGES_SQL = `
  UPDATE partners SET pending_changes = $3::jsonb, updated_at = now()
  WHERE id::text = $1 AND status <> 'removed'
    AND EXISTS (SELECT 1 FROM partner_contacts c WHERE c.partner_id = partners.id AND c.user_id = $2)
  RETURNING id::text AS id`;

/** Admin approves proposed listing text. $1 partner id */
export const APPLY_CHANGES_SQL = `
  UPDATE partners SET
    name = coalesce(pending_changes->>'name', name),
    summary = CASE WHEN pending_changes ? 'summary' THEN nullif(pending_changes->>'summary', '') ELSE summary END,
    website = CASE WHEN pending_changes ? 'website' THEN nullif(pending_changes->>'website', '') ELSE website END,
    area = CASE WHEN pending_changes ? 'area' THEN nullif(pending_changes->>'area', '') ELSE area END,
    pending_changes = NULL, updated_at = now()
  WHERE id::text = $1 AND pending_changes IS NOT NULL RETURNING id::text AS id`;

/** $1 partner id */
export const DISCARD_CHANGES_SQL = `UPDATE partners SET pending_changes = NULL, updated_at = now() WHERE id::text = $1 AND pending_changes IS NOT NULL RETURNING id::text AS id`;

/** Partners with proposed changes (admin queue). No params. */
export const PARTNERS_WITH_CHANGES_SQL = `SELECT id::text AS id, name, pending_changes, updated_at FROM partners WHERE pending_changes IS NOT NULL ORDER BY updated_at`;

/** After a contact edits an offer it goes back to John's queue (not archived offers). $1 offer id, $2 partner id */
export const OFFER_BACK_TO_REVIEW_SQL = `
  UPDATE resource_offers SET status = 'pending', review_note = NULL, updated_at = now()
  WHERE id::text = $1 AND partner_id::text = $2 AND status IN ('draft', 'pending', 'published', 'paused', 'expired')
  RETURNING id::text AS id`;

/** Extra admin to-dos for P3-2b: proposed listing changes and offer requests only PANA can answer. No params. */
export const PORTAL_TODO_SQL = `
  SELECT (SELECT count(*) FROM partners WHERE pending_changes IS NOT NULL)
       + (SELECT count(*) FROM offer_requests r JOIN resource_offers o ON o.id = r.offer_id
          WHERE r.status = 'pending' AND r.created_at >= now() - interval '30 days'
            AND NOT EXISTS (SELECT 1 FROM partner_contacts c WHERE c.partner_id = o.partner_id)) AS n`;

/** Emails of a partner's active contacts, ONLY for partner status notices ("your offer is live"). $1 partner id */
export const CONTACT_EMAILS_SQL = `
  SELECT m.email FROM partner_contacts c JOIN members m ON m.user_id = c.user_id
  WHERE c.partner_id::text = $1 AND m.status = 'active' AND m.email IS NOT NULL`;

/** A requestable offer with its partner and contacts (for the request page). $1 offer id */
export const OFFER_FOR_REQUEST_SQL = `
  SELECT o.id::text AS id, o.title, o.type, o.eligibility, o.cohort_id::text AS cohort_id, o.claim_method, o.how_to,
         o.schedule_text, o.location_name, pa.id::text AS partner_id, pa.name AS partner_name, pa.slug AS partner_slug,
         coalesce((SELECT array_agg(c.user_id) FROM partner_contacts c WHERE c.partner_id = pa.id), '{}') AS contact_ids,
         (o.status = 'published' AND pa.status = 'approved' AND o.claim_method = 'request_via_pana'
          AND (o.ends_on IS NULL OR o.ends_on >= (now() AT TIME ZONE 'America/New_York')::date)) AS open
  FROM resource_offers o JOIN partners pa ON pa.id = o.partner_id WHERE o.id::text = $1`;
