-- 007: D7, blank the submitter emails previously copied into projects.email.
-- The app stopped writing this column in PR 1; emails live only in members (from Clerk).
-- Data change (irreversible), but production has 0 such rows at the time of writing.
-- Rollback: none needed. The source of truth is Clerk / members.email.
UPDATE projects SET email = NULL WHERE email IS NOT NULL;
