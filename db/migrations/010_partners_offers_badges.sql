-- 010: Community partners, partner inquiries, resource offers and incubator access badges (Phase 3, P3-2a).
-- Additive only: four new tables. No existing table is changed (including every domino_* table), so this is
-- backward-compatible with the code running now. PANA gives no money or equipment: offers have no amount fields.
-- Account deletion: incubator_credentials reference members(user_id) ON DELETE CASCADE.
-- Partner contacts, offer requests, needs and help offers come in P3-2b (011).
-- Rollback: DROP TABLE incubator_credentials, resource_offers, partner_inquiries, partners;  (or restore from backup)

CREATE TABLE IF NOT EXISTS partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  kind            text NOT NULL DEFAULT 'other',
  summary         text,
  website         text,
  area            text,                                  -- e.g. "Fort Pierce, St. Lucie County"
  status          text NOT NULL DEFAULT 'pending',
  public_listing  boolean NOT NULL DEFAULT true,
  admin_note      text,                                  -- private
  approved_by     text,
  approved_at     timestamptz,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partners_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 60),
  CONSTRAINT partners_name_check CHECK (length(name) BETWEEN 2 AND 120),
  CONSTRAINT partners_kind_check CHECK (kind IN ('business', 'college', 'library', 'government', 'nonprofit', 'individual', 'other')),
  CONSTRAINT partners_status_check CHECK (status IN ('pending', 'approved', 'paused', 'removed')),
  CONSTRAINT partners_summary_check CHECK (summary IS NULL OR length(summary) <= 1000),
  CONSTRAINT partners_website_check CHECK (website IS NULL OR (website ~ '^https?://' AND length(website) <= 300)),
  CONSTRAINT partners_area_check CHECK (area IS NULL OR length(area) <= 120)
);
CREATE INDEX IF NOT EXISTS partners_public_idx ON partners (name) WHERE status = 'approved' AND public_listing;

-- From the public /support form; no account needed. contact_email is PRIVATE (admins only, never rendered publicly).
CREATE TABLE IF NOT EXISTS partner_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name        text NOT NULL,
  contact_name    text NOT NULL,
  contact_email   text NOT NULL,
  kind            text NOT NULL DEFAULT 'other',
  can_offer       text[] NOT NULL DEFAULT '{}',
  message         text,
  status          text NOT NULL DEFAULT 'new',
  partner_id      uuid REFERENCES partners(id) ON DELETE SET NULL,   -- set when converted
  admin_note      text,
  handled_by      text,
  handled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_inquiries_org_check CHECK (length(org_name) BETWEEN 2 AND 120),
  CONSTRAINT partner_inquiries_contact_check CHECK (length(contact_name) BETWEEN 2 AND 80),
  CONSTRAINT partner_inquiries_email_check CHECK (length(contact_email) <= 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT partner_inquiries_kind_check CHECK (kind IN ('business', 'college', 'library', 'government', 'nonprofit', 'individual', 'other')),
  CONSTRAINT partner_inquiries_offer_check CHECK (can_offer <@ ARRAY['lab_access', 'library_time', 'mentorship', 'software_credits',
                                                                    'meeting_space', 'sponsorship', 'event_support', 'other']::text[]),
  CONSTRAINT partner_inquiries_message_check CHECK (message IS NULL OR length(message) <= 2000),
  CONSTRAINT partner_inquiries_status_check CHECK (status IN ('new', 'contacted', 'converted', 'declined', 'spam'))
);
CREATE INDEX IF NOT EXISTS partner_inquiries_status_idx ON partner_inquiries (status, created_at DESC);

CREATE TABLE IF NOT EXISTS resource_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  description     text,
  location_name   text,
  address         text,
  schedule_text   text,                                  -- e.g. "Tue/Thu 6 to 9 PM ET"
  starts_on       date,
  ends_on         date,
  capacity_text   text,
  eligibility     text NOT NULL DEFAULT 'incubator_participants',
  cohort_id       uuid REFERENCES incubator_cohorts(id) ON DELETE SET NULL,   -- optional: one cohort only
  claim_method    text NOT NULL DEFAULT 'show_badge',
  external_url    text,
  how_to          text,                                  -- "How to use it" instructions
  status          text NOT NULL DEFAULT 'pending',
  review_note     text,                                  -- shown to whoever edits the offer when sent back
  approved_by     text,
  approved_at     timestamptz,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_offers_type_check CHECK (type IN ('lab_hours', 'library_time', 'mentorship_hours', 'software_credits',
                                                        'meeting_space', 'sponsor_funding', 'other')),
  CONSTRAINT resource_offers_title_check CHECK (length(title) BETWEEN 3 AND 120),
  CONSTRAINT resource_offers_description_check CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT resource_offers_text_check CHECK (coalesce(length(location_name), 0) <= 120 AND coalesce(length(address), 0) <= 200
                                               AND coalesce(length(schedule_text), 0) <= 200 AND coalesce(length(capacity_text), 0) <= 120
                                               AND coalesce(length(how_to), 0) <= 1000),
  CONSTRAINT resource_offers_dates_check CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT resource_offers_eligibility_check CHECK (eligibility IN ('public', 'members', 'incubator_participants')),
  CONSTRAINT resource_offers_cohort_check CHECK (cohort_id IS NULL OR eligibility = 'incubator_participants'),
  CONSTRAINT resource_offers_claim_check CHECK (claim_method IN ('show_badge', 'request_via_pana', 'external_link')),
  CONSTRAINT resource_offers_badge_check CHECK (claim_method <> 'show_badge' OR eligibility = 'incubator_participants'),
  CONSTRAINT resource_offers_url_check CHECK ((claim_method = 'external_link') = (external_url IS NOT NULL)
                                              AND (external_url IS NULL OR (external_url ~ '^https?://' AND length(external_url) <= 300))),
  CONSTRAINT resource_offers_status_check CHECK (status IN ('draft', 'pending', 'published', 'paused', 'expired', 'archived'))
);
CREATE INDEX IF NOT EXISTS resource_offers_partner_idx ON resource_offers (partner_id, status);
CREATE INDEX IF NOT EXISTS resource_offers_published_idx ON resource_offers (type) WHERE status = 'published';

-- Incubator access badge. The QR token is derived on the server (HMAC of a server secret and token_nonce) and only its
-- SHA-256 is stored, so the raw token is never in the database. One badge row per accepted application.
CREATE TABLE IF NOT EXISTS incubator_credentials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  application_id   uuid NOT NULL UNIQUE REFERENCES incubator_applications(id) ON DELETE CASCADE,
  token_nonce      text NOT NULL,
  token_hash       text NOT NULL UNIQUE,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  code_rotated_at  timestamptz,
  expires_at       timestamptz,                         -- end of the cohort's last day (ET); NULL = until revoked
  revoked_at       timestamptz,
  revoke_reason    text,
  revoked_by       text,
  last_checked_at  timestamptz,                         -- only a count and the last time; never who or where
  check_count      int NOT NULL DEFAULT 0,
  CONSTRAINT incubator_credentials_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT incubator_credentials_nonce_check CHECK (length(token_nonce) BETWEEN 16 AND 64),
  CONSTRAINT incubator_credentials_reason_check CHECK (revoke_reason IS NULL OR length(revoke_reason) <= 300),
  CONSTRAINT incubator_credentials_revoked_check CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE INDEX IF NOT EXISTS incubator_credentials_user_idx ON incubator_credentials (user_id);
