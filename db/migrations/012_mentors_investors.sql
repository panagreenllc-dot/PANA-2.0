-- 012: Mentor and investor roles, mentorship requests and investor interest (Phase 3, P3-3).
-- Additive only: four new tables, one new column with a default on `projects`, and a WIDER check on reports.target_type
-- (the old rule is dropped and a superset added, so every existing row still passes). No domino_* table is touched.
-- Every user column references members(user_id) ON DELETE CASCADE, so deleting an account removes the member's
-- mentor/investor profile and their requests. Emails are never stored here; they're read from members only to send an
-- accepted introduction. No money amounts, check sizes or accreditation fields: PANA only introduces people.
-- Rollback: DROP TABLE investor_interests, mentorship_requests, investor_profiles, mentor_profiles;
--           ALTER TABLE projects DROP COLUMN investor_interest_open;
--           restore reports_target_type_check to ('profile', 'idea', 'request')   (or restore from backup)

-- A member who offers to mentor. John approves every one (status 'approved' = PANA mentor badge); the mentor can pause
-- (status 'paused': hidden from the directory, no new requests) and resume without a new review.
CREATE TABLE IF NOT EXISTS mentor_profiles (
  user_id          text PRIMARY KEY REFERENCES members(user_id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending',
  expertise        text[] NOT NULL DEFAULT '{}',
  bio              text NOT NULL,
  availability     text,
  max_open_mentees int NOT NULL DEFAULT 3,
  review_note      text,
  approved_by      text,
  approved_at      timestamptz,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_profiles_status_check CHECK (status IN ('pending', 'approved', 'paused', 'declined', 'revoked')),
  CONSTRAINT mentor_profiles_bio_check CHECK (char_length(bio) BETWEEN 20 AND 1000),
  CONSTRAINT mentor_profiles_availability_check CHECK (availability IS NULL OR char_length(availability) <= 60),
  CONSTRAINT mentor_profiles_expertise_check CHECK (cardinality(expertise) BETWEEN 1 AND 8),
  CONSTRAINT mentor_profiles_max_check CHECK (max_open_mentees BETWEEN 1 AND 10)
);
CREATE INDEX IF NOT EXISTS mentor_profiles_status_idx ON mentor_profiles (status);

-- A member who'd like to hear from ideas open to investor interest. John approves every one. Never listed as a directory.
CREATE TABLE IF NOT EXISTS investor_profiles (
  user_id          text PRIMARY KEY REFERENCES members(user_id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending',
  investor_type    text NOT NULL,
  focus_categories text[] NOT NULL DEFAULT '{}',
  stage_focus      text[] NOT NULL DEFAULT '{}',
  organization     text,
  bio              text NOT NULL,
  review_note      text,
  approved_by      text,
  approved_at      timestamptz,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investor_profiles_status_check CHECK (status IN ('pending', 'approved', 'declined', 'revoked')),
  CONSTRAINT investor_profiles_type_check CHECK (investor_type IN ('angel', 'fund', 'organization', 'grantmaker', 'other')),
  CONSTRAINT investor_profiles_bio_check CHECK (char_length(bio) BETWEEN 20 AND 1000),
  CONSTRAINT investor_profiles_org_check CHECK (organization IS NULL OR char_length(organization) <= 120)
);
CREATE INDEX IF NOT EXISTS investor_profiles_status_idx ON investor_profiles (status);

-- "Request mentorship": the mentor accepts or declines; only then does PANA send one introduction email.
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_user_id     text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  mentor_user_id     text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  project_id         uuid REFERENCES projects(id) ON DELETE SET NULL,
  message            text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  intro_sent_at      timestamptz,
  intro_email_id     text,
  intro_error        text,
  mentor_notified_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  CONSTRAINT mentorship_requests_message_len CHECK (char_length(message) BETWEEN 1 AND 1000),
  CONSTRAINT mentorship_requests_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  CONSTRAINT mentorship_requests_not_self CHECK (mentee_user_id <> mentor_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS mentorship_requests_one_open ON mentorship_requests (mentee_user_id, mentor_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS mentorship_requests_mentor_idx ON mentorship_requests (mentor_user_id, status);
CREATE INDEX IF NOT EXISTS mentorship_requests_mentee_idx ON mentorship_requests (mentee_user_id, created_at DESC);

-- "I'm interested" from an approved investor, only on ideas whose owner turned on investor interest.
CREATE TABLE IF NOT EXISTS investor_interests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id   text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  owner_user_id      text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message            text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  intro_sent_at      timestamptz,
  intro_email_id     text,
  intro_error        text,
  owner_notified_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  CONSTRAINT investor_interests_message_len CHECK (char_length(message) BETWEEN 1 AND 1000),
  CONSTRAINT investor_interests_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  CONSTRAINT investor_interests_not_self CHECK (investor_user_id <> owner_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS investor_interests_one_open ON investor_interests (project_id, investor_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS investor_interests_owner_idx ON investor_interests (owner_user_id, status);
CREATE INDEX IF NOT EXISTS investor_interests_investor_idx ON investor_interests (investor_user_id, created_at DESC);

-- Per-idea owner switch, off by default, so code running today is unaffected.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS investor_interest_open boolean NOT NULL DEFAULT false;

-- Members can report the new kinds of content. Superset of the old rule, so existing rows are unaffected.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'idea', 'request', 'mentor_profile', 'investor_profile', 'mentorship_request', 'investor_interest'));
