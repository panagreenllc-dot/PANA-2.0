-- 005: "Interested in collaborating" requests (brokered contact; emails are never shown on site).
-- Additive. Rollback: DROP TABLE collaboration_requests;

CREATE TABLE IF NOT EXISTS collaboration_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requester_user_id  text NOT NULL,
  owner_user_id      text NOT NULL,
  message            text NOT NULL,
  status             text NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  CONSTRAINT collaboration_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  CONSTRAINT collaboration_requests_not_self CHECK (requester_user_id <> owner_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS collaboration_requests_one_open
  ON collaboration_requests (project_id, requester_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS collaboration_requests_owner_idx ON collaboration_requests (owner_user_id, status);
CREATE INDEX IF NOT EXISTS collaboration_requests_requester_idx ON collaboration_requests (requester_user_id, created_at DESC);
