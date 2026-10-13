-- PANA 2.0: project moderation
-- Run once in the Neon SQL Editor (see ADMIN_SETUP.md). Safe to re-run.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reviewed_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Owner decision: every existing project goes back to the review queue
-- so fake submissions can be deleted before anything is public again.
-- (Only run this line the first time.)
UPDATE projects SET status = 'pending' WHERE reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_status_created_idx
  ON projects (status, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
