-- 004: ideas v2 on the existing projects table (D6). user_id stays the owner (no duplicate owner_user_id).
-- Additive; existing rows get safe defaults. New status values are a superset of the old ones.
-- Rollback: drop the added columns and restore the original projects_status_check.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'idea';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'concept';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS help_needed text[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS field_visibility jsonb NOT NULL
  DEFAULT '{"details": "members", "website": "public", "help_needed": "public"}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hidden_by_reports boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_kind_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_kind_check CHECK (kind IN ('idea', 'project', 'startup'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_stage_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_stage_check CHECK (stage IN ('concept', 'building', 'launched', 'growing'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_audience_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_audience_check CHECK (audience IN ('public', 'members'));
  END IF;
END $$;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'changes_requested'));

-- D7: the app stops writing projects.email for new rows (code change in this PR).
-- Blanking the old values is a separate, later migration.
