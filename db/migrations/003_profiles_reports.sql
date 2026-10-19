-- 003: member profiles (private until published; signed-in members only) and reports.
-- Additive. Rollback: DROP TABLE reports; DROP TABLE profiles;

CREATE TABLE IF NOT EXISTS profiles (
  user_id        text PRIMARY KEY REFERENCES members(user_id) ON DELETE CASCADE,
  display_name   text NOT NULL,
  headline       text,
  experience     text,
  roles          text[] NOT NULL DEFAULT '{}',
  skills         text[] NOT NULL DEFAULT '{}',
  interests      text[] NOT NULL DEFAULT '{}',
  looking_for    text[] NOT NULL DEFAULT '{}',
  links          jsonb  NOT NULL DEFAULT '{}'::jsonb,
  is_published   boolean NOT NULL DEFAULT false,
  published_at   timestamptz,
  moderation     text NOT NULL DEFAULT 'ok',
  hidden_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_roles_check CHECK (roles <@ ARRAY['developer','entrepreneur','student','designer','mentor_interest','investor_interest']::text[]),
  CONSTRAINT profiles_looking_for_check CHECK (looking_for <@ ARRAY['collaborators','mentorship','investment','projects']::text[]),
  CONSTRAINT profiles_moderation_check CHECK (moderation IN ('ok', 'hidden'))
);
CREATE INDEX IF NOT EXISTS profiles_published_idx ON profiles (is_published, moderation);
CREATE INDEX IF NOT EXISTS profiles_skills_gin ON profiles USING gin (skills);
CREATE INDEX IF NOT EXISTS profiles_roles_gin ON profiles USING gin (roles);

CREATE TABLE IF NOT EXISTS reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id  text NOT NULL,
  target_type       text NOT NULL,
  target_id         text NOT NULL,
  reason            text NOT NULL,
  details           text,
  status            text NOT NULL DEFAULT 'open',
  resolved_by       text,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_type_check CHECK (target_type IN ('profile', 'idea', 'request')),
  CONSTRAINT reports_reason_check CHECK (reason IN ('spam', 'inappropriate', 'scam', 'underage', 'other')),
  CONSTRAINT reports_status_check CHECK (status IN ('open', 'dismissed', 'actioned')),
  CONSTRAINT reports_one_per_reporter UNIQUE (reporter_user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS reports_open_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_type, target_id);
