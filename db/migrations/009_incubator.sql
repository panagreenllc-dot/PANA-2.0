-- 009: Incubator cohorts and applications (Phase 3, P3-1).
-- Additive only: two new tables. Nothing in the deployed code reads them, and no existing table
-- (including every domino_* table) is changed, so this is backward-compatible with the code running now.
-- Account deletion: applications reference members(user_id) ON DELETE CASCADE, so the existing deletion paths
-- (Clerk user.deleted webhook, admin delete) remove them automatically.
-- Rollback: DROP TABLE incubator_applications; DROP TABLE incubator_cohorts;  (or restore from the Neon branch)

CREATE TABLE IF NOT EXISTS incubator_cohorts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  slug               text NOT NULL UNIQUE,
  summary            text,
  format             text NOT NULL DEFAULT 'virtual',
  status             text NOT NULL DEFAULT 'draft',
  apply_opens_at     timestamptz,
  apply_closes_at    timestamptz,
  starts_on          date,
  ends_on            date,
  announce_on        date,                 -- when decisions are announced (e.g. at Tech Con)
  announce_note      text,
  capacity           int NOT NULL DEFAULT 10,
  notified_at        timestamptz,          -- when "notify me" members were emailed that this cohort is open
  created_by         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incubator_cohorts_format_check CHECK (format IN ('virtual', 'in_person', 'hybrid')),
  CONSTRAINT incubator_cohorts_status_check CHECK (status IN ('draft', 'open', 'closed', 'active', 'completed')),
  CONSTRAINT incubator_cohorts_capacity_check CHECK (capacity BETWEEN 1 AND 500),
  CONSTRAINT incubator_cohorts_window_check CHECK (apply_opens_at IS NULL OR apply_closes_at IS NULL OR apply_closes_at > apply_opens_at),
  CONSTRAINT incubator_cohorts_dates_check CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on > starts_on),
  CONSTRAINT incubator_cohorts_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  CONSTRAINT incubator_cohorts_text_len CHECK (char_length(name) BETWEEN 2 AND 80 AND coalesce(char_length(summary), 0) <= 1000
                                               AND coalesce(char_length(announce_note), 0) <= 200)
);

CREATE TABLE IF NOT EXISTS incubator_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id          uuid NOT NULL REFERENCES incubator_cohorts(id),
  user_id            text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  project_id         uuid REFERENCES projects(id) ON DELETE SET NULL,
  stage              text NOT NULL,
  goals              text NOT NULL,
  weekly_hours       int NOT NULL,
  needs              text[] NOT NULL DEFAULT '{}',
  team               text,
  links              jsonb NOT NULL DEFAULT '{}'::jsonb,
  status             text NOT NULL DEFAULT 'submitted',
  participant_status text,
  decision_note      text,                 -- shown to the applicant
  admin_note         text,                 -- private to admins
  reviewed_by        text,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incubator_applications_status_check
    CHECK (status IN ('submitted', 'under_review', 'accepted', 'waitlisted', 'declined', 'withdrawn')),
  CONSTRAINT incubator_applications_participant_check
    CHECK (participant_status IS NULL OR (status = 'accepted' AND participant_status IN ('active', 'completed', 'left'))),
  CONSTRAINT incubator_applications_stage_check CHECK (stage IN ('concept', 'building', 'launched', 'growing')),
  CONSTRAINT incubator_applications_needs_check
    CHECK (needs <@ ARRAY['guidance','mentorship','compute_access','software','meeting_space','sponsorship','other']::text[]),
  CONSTRAINT incubator_applications_hours_check CHECK (weekly_hours BETWEEN 1 AND 80),
  CONSTRAINT incubator_applications_text_len CHECK (
    char_length(goals) BETWEEN 50 AND 2000 AND coalesce(char_length(team), 0) <= 1000
    AND coalesce(char_length(decision_note), 0) <= 1000 AND coalesce(char_length(admin_note), 0) <= 2000)
);

-- One live application per member per cohort (withdrawn or declined ones don't count).
CREATE UNIQUE INDEX IF NOT EXISTS incubator_applications_one_live
  ON incubator_applications (cohort_id, user_id) WHERE status NOT IN ('withdrawn', 'declined');
CREATE INDEX IF NOT EXISTS incubator_applications_queue_idx ON incubator_applications (cohort_id, status, created_at);
CREATE INDEX IF NOT EXISTS incubator_applications_user_idx ON incubator_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS incubator_cohorts_status_idx ON incubator_cohorts (status, apply_closes_at);
