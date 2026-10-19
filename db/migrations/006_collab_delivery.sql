-- 006: ideas + collaboration (Phase 2 PR 3). Additive.
-- Rollback: ALTER TABLE collaboration_requests DROP COLUMN intro_sent_at, DROP COLUMN intro_email_id,
--           DROP COLUMN intro_error, DROP COLUMN owner_notified_at; ALTER TABLE projects DROP COLUMN owner_edited_at;
--           DROP INDEX projects_approved_browse_idx;

-- Delivery tracking for the brokered introduction email (Resend) and the owner notification.
ALTER TABLE collaboration_requests ADD COLUMN IF NOT EXISTS intro_sent_at timestamptz;
ALTER TABLE collaboration_requests ADD COLUMN IF NOT EXISTS intro_email_id text;
ALTER TABLE collaboration_requests ADD COLUMN IF NOT EXISTS intro_error text;
ALTER TABLE collaboration_requests ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaboration_requests_message_len') THEN
    ALTER TABLE collaboration_requests ADD CONSTRAINT collaboration_requests_message_len
      CHECK (char_length(message) BETWEEN 1 AND 1000);
  END IF;
END $$;

-- When the owner last edited the idea (re-moderation trail; admin edits don't set it).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_edited_at timestamptz;

-- Browse/search: approved, visible ideas newest first.
CREATE INDEX IF NOT EXISTS projects_approved_browse_idx
  ON projects (created_at DESC) WHERE status = 'approved' AND NOT hidden_by_reports;
