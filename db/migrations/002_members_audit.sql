-- 002: members (synced from Clerk; holds the 18+ / Terms attestation) and admin audit log.
-- Phase 2 PR 1 (Foundation). Additive and backward-compatible with the currently deployed code.
-- Rollback: DROP TABLE admin_audit_log; DROP TABLE members;
--           ALTER TABLE projects ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'UTC';

CREATE TABLE IF NOT EXISTS members (
  user_id            text PRIMARY KEY,                       -- Clerk user id
  email              text,                                   -- PRIVATE: admins + accepted intro emails only
  email_verified     boolean NOT NULL DEFAULT false,
  display_name       text,
  image_url          text,
  age_attested_at    timestamptz,                            -- ticked "I am 18 or older"
  terms_accepted_at  timestamptz,
  terms_version      text,
  status             text NOT NULL DEFAULT 'active',
  email_prefs        jsonb NOT NULL DEFAULT '{"requests": true, "reviews": true}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_status_check CHECK (status IN ('active', 'banned', 'deleted'))
);
CREATE INDEX IF NOT EXISTS members_email_lower_idx ON members (lower(email));

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             bigserial PRIMARY KEY,
  admin_user_id  text NOT NULL,
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text NOT NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);

-- created_at had no time zone (unlike updated_at). Existing values are treated as UTC.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'created_at')
     = 'timestamp without time zone' THEN
    ALTER TABLE projects ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;
