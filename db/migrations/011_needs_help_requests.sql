-- 011: Needs on ideas, help offers, "Request through PANA" offer requests, and partner contacts (Phase 3, P3-2b).
-- Additive only: four new tables plus one nullable column on `partners` (a P3-2a table). No existing column or rule
-- changes, and no domino_* table is touched. Every user column references members(user_id) ON DELETE CASCADE, so
-- deleting an account removes the member's needs, help offers, offer requests and partner-contact links.
-- Emails are never stored here; they're read from members only to send an accepted introduction.
-- Rollback: DROP TABLE help_offers, project_needs, offer_requests, partner_contacts;
--           ALTER TABLE partners DROP COLUMN pending_changes;   (or restore from backup)

-- People at a partner organization who have PANA accounts. Linked by an admin (member search, never by typing an email).
CREATE TABLE IF NOT EXISTS partner_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'staff',
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_contacts_role_check CHECK (role IN ('manager', 'staff')),
  CONSTRAINT partner_contacts_unique UNIQUE (partner_id, user_id)
);
CREATE INDEX IF NOT EXISTS partner_contacts_user_idx ON partner_contacts (user_id);

-- Listing edits proposed by a partner contact wait here until John approves them; the live listing stays as is.
ALTER TABLE partners ADD COLUMN IF NOT EXISTS pending_changes jsonb;

-- Requests for offers whose claim_method = 'request_via_pana'. A partner contact (or John, when the partner has no
-- contacts yet) accepts or declines; only then does PANA send one introduction email to both sides.
CREATE TABLE IF NOT EXISTS offer_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id            uuid NOT NULL REFERENCES resource_offers(id) ON DELETE CASCADE,
  user_id             text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  project_id          uuid REFERENCES projects(id) ON DELETE SET NULL,
  message             text NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  responded_by        text,
  intro_sent_at       timestamptz,
  intro_email_id      text,
  intro_error         text,
  responder_notified_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  responded_at        timestamptz,
  CONSTRAINT offer_requests_message_len CHECK (char_length(message) BETWEEN 1 AND 1000),
  CONSTRAINT offer_requests_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired'))
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_requests_one_open ON offer_requests (offer_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS offer_requests_user_idx ON offer_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offer_requests_offer_idx ON offer_requests (offer_id, status);

-- Needs on an idea. A need is never more visible than its idea (enforced in lib/visibility.ts: toNeedView), and
-- John reviews every new or edited need. Access needs only: no money amounts (amount_text is e.g. "10 hrs/week").
CREATE TABLE IF NOT EXISTS project_needs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_user_id    text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  kind             text NOT NULL,
  title            text NOT NULL,
  details          text,
  amount_text      text,
  status           text NOT NULL DEFAULT 'pending',
  moderation_note  text,
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_needs_kind_check CHECK (kind IN ('compute_access', 'software', 'mentorship', 'skills', 'meeting_space',
                                                      'equipment_access', 'sponsorship', 'other')),
  CONSTRAINT project_needs_title_check CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT project_needs_details_check CHECK (details IS NULL OR char_length(details) <= 1000),
  CONSTRAINT project_needs_amount_check CHECK (amount_text IS NULL OR char_length(amount_text) <= 60),
  CONSTRAINT project_needs_status_check CHECK (status IN ('pending', 'changes_requested', 'open', 'met', 'closed'))
);
CREATE INDEX IF NOT EXISTS project_needs_project_idx ON project_needs (project_id, status);
CREATE INDEX IF NOT EXISTS project_needs_pending_idx ON project_needs (created_at) WHERE status = 'pending';

-- "Offer help" on a need. Works like collaboration requests: the idea owner accepts or declines, and emails are
-- shared only in the introduction after both sides have agreed (the helper by sending, the owner by accepting).
CREATE TABLE IF NOT EXISTS help_offers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id            uuid NOT NULL REFERENCES project_needs(id) ON DELETE CASCADE,
  helper_user_id     text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  owner_user_id      text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  partner_id         uuid REFERENCES partners(id) ON DELETE SET NULL,   -- offered on behalf of an organization
  message            text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  intro_sent_at      timestamptz,
  intro_email_id     text,
  intro_error        text,
  owner_notified_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  CONSTRAINT help_offers_message_len CHECK (char_length(message) BETWEEN 1 AND 1000),
  CONSTRAINT help_offers_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  CONSTRAINT help_offers_not_self CHECK (helper_user_id <> owner_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS help_offers_one_open ON help_offers (need_id, helper_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS help_offers_owner_idx ON help_offers (owner_user_id, status);
CREATE INDEX IF NOT EXISTS help_offers_helper_idx ON help_offers (helper_user_id, created_at DESC);
