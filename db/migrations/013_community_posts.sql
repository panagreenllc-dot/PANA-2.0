-- 013: Community feed and events (Phase 3, P3-4), the member board, and John's Nov 22, 2026 incubator changes.
-- Additive except one relaxed rule: incubator_cohorts.capacity becomes optional (NULL = no fixed number of spots), and
-- reports.target_type gets a WIDER check (superset, so every existing row still passes). No domino_* table is touched.
-- Every member column references members(user_id) ON DELETE CASCADE, so deleting an account removes that member's
-- posts, replies and digest history. Emails are never stored here.
-- Data changes (reviewed, idempotent, guarded so they only touch rows still holding the old values):
--   * Cohort 1 (slug cohort-1-spring-2027): no fixed spots; decisions are emailed privately (by Fri, Feb 26, 2027),
--     never announced at Tech Con.
--   * Treasure Coast Tech Con 2027 becomes an event row: Sun, May 30, 2027, 10:30 AM - 5:00 PM ET, price
--     "To be announced", registration "Registration opens soon", guest speaker Professor Joseph Ali (Keiser University).
-- Rollback: DROP TABLE community_digest_recipients, community_digests, member_post_replies, member_posts,
--           event_speakers, event_agenda_items, community_posts;
--           restore reports_target_type_check to the 012 list; UPDATE incubator_cohorts SET capacity = 10 WHERE capacity IS NULL;
--           ALTER TABLE incubator_cohorts ALTER COLUMN capacity SET NOT NULL, ALTER COLUMN capacity SET DEFAULT 10;
--           (and restore Cohort 1's announce_on / announce_note from the backup if wanted)

-- John's announcements and events. Only admins write these.
CREATE TABLE IF NOT EXISTS community_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  kind              text NOT NULL,
  program           text NOT NULL DEFAULT 'community',
  audience          text NOT NULL DEFAULT 'public',
  status            text NOT NULL DEFAULT 'draft',
  pinned            boolean NOT NULL DEFAULT false,
  title             text NOT NULL,
  body              text NOT NULL DEFAULT '',
  starts_at         timestamptz,
  ends_at           timestamptz,
  location_name     text,
  address           text,
  is_online         boolean NOT NULL DEFAULT false,
  registration_url  text,
  registration_note text,
  price_text        text,
  author_user_id    text,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  CONSTRAINT community_posts_kind_check CHECK (kind IN ('announcement', 'event')),
  CONSTRAINT community_posts_program_check CHECK (program IN ('community', 'incubator', 'techcon')),
  CONSTRAINT community_posts_audience_check CHECK (audience IN ('public', 'members')),
  CONSTRAINT community_posts_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT community_posts_title_check CHECK (char_length(title) BETWEEN 3 AND 140),
  CONSTRAINT community_posts_body_check CHECK (char_length(body) <= 5000),
  CONSTRAINT community_posts_event_check CHECK (kind <> 'event' OR starts_at IS NOT NULL),
  CONSTRAINT community_posts_times_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT community_posts_text_check CHECK (coalesce(char_length(location_name), 0) <= 120 AND coalesce(char_length(address), 0) <= 200
                                               AND coalesce(char_length(registration_note), 0) <= 120 AND coalesce(char_length(price_text), 0) <= 80),
  CONSTRAINT community_posts_url_check CHECK (registration_url IS NULL OR (registration_url ~ '^https?://' AND char_length(registration_url) <= 500))
);
CREATE INDEX IF NOT EXISTS community_posts_feed_idx ON community_posts (status, pinned DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_events_idx ON community_posts (kind, starts_at) WHERE status = 'published';

-- Agenda lines and speakers are text John types in (speakers are not member links, so nobody's account is involved).
CREATE TABLE IF NOT EXISTS event_agenda_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  time_label  text NOT NULL DEFAULT '',
  title       text NOT NULL,
  sort        int NOT NULL DEFAULT 0,
  CONSTRAINT event_agenda_items_text_check CHECK (char_length(time_label) <= 40 AND char_length(title) BETWEEN 1 AND 140)
);
CREATE INDEX IF NOT EXISTS event_agenda_items_post_idx ON event_agenda_items (post_id, sort);

CREATE TABLE IF NOT EXISTS event_speakers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL DEFAULT '',
  sort        int NOT NULL DEFAULT 0,
  CONSTRAINT event_speakers_text_check CHECK (char_length(name) BETWEEN 1 AND 100 AND char_length(role) <= 140)
);
CREATE INDEX IF NOT EXISTS event_speakers_post_idx ON event_speakers (post_id, sort);

-- The member board: members support each other with questions, asks, wins and tips. Members-only.
-- A member's FIRST post or reply waits for John's review ('pending'); once one is approved, later ones publish
-- straight away. Three distinct open reports hide an item until John looks at it.
CREATE TABLE IF NOT EXISTS member_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  kind              text NOT NULL,
  title             text NOT NULL,
  body              text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  hidden_by_reports boolean NOT NULL DEFAULT false,
  review_note       text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_posts_kind_check CHECK (kind IN ('question', 'ask', 'win', 'tip')),
  CONSTRAINT member_posts_status_check CHECK (status IN ('pending', 'published', 'declined', 'removed')),
  CONSTRAINT member_posts_title_check CHECK (char_length(title) BETWEEN 5 AND 120),
  CONSTRAINT member_posts_body_check CHECK (char_length(body) BETWEEN 20 AND 2000),
  CONSTRAINT member_posts_note_check CHECK (review_note IS NULL OR char_length(review_note) <= 500)
);
CREATE INDEX IF NOT EXISTS member_posts_board_idx ON member_posts (status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS member_posts_user_idx ON member_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS member_post_replies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES member_posts(id) ON DELETE CASCADE,
  user_id           text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  body              text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  hidden_by_reports boolean NOT NULL DEFAULT false,
  review_note       text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_post_replies_status_check CHECK (status IN ('pending', 'published', 'declined', 'removed')),
  CONSTRAINT member_post_replies_body_check CHECK (char_length(body) BETWEEN 2 AND 1000),
  CONSTRAINT member_post_replies_note_check CHECK (review_note IS NULL OR char_length(review_note) <= 500)
);
CREATE INDEX IF NOT EXISTS member_post_replies_post_idx ON member_post_replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS member_post_replies_user_idx ON member_post_replies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS member_post_replies_status_idx ON member_post_replies (status);

-- Opt-in email digest of John's announcements and events (never member posts). At most one digest every 14 days,
-- sent in batches under the Resend free tier. Recipients are recorded so a batch is never sent twice.
CREATE TABLE IF NOT EXISTS community_digests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  text NOT NULL,
  post_ids    uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_batch_at timestamptz,
  CONSTRAINT community_digests_posts_check CHECK (cardinality(post_ids) BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS community_digest_recipients (
  digest_id   uuid NOT NULL REFERENCES community_digests(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES members(user_id) ON DELETE CASCADE,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (digest_id, user_id)
);

-- Members can report board posts and replies. Superset of the 012 rule, so existing rows are unaffected.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('profile', 'idea', 'request', 'mentor_profile', 'investor_profile', 'mentorship_request', 'investor_interest',
                         'member_post', 'member_reply'));

-- Incubator: no fixed number of spots (John, Nov 22, 2026). The existing 1-500 check still applies when a number is set.
ALTER TABLE incubator_cohorts ALTER COLUMN capacity DROP NOT NULL;
ALTER TABLE incubator_cohorts ALTER COLUMN capacity DROP DEFAULT;

-- Cohort 1: decisions go out privately by email, never announced at Tech Con; no spots cap.
-- Guarded on the old values so an admin edit made since then is never overwritten.
UPDATE incubator_cohorts
   SET announce_on = DATE '2027-02-26', announce_note = NULL, updated_at = now()
 WHERE slug = 'cohort-1-spring-2027' AND announce_on = DATE '2027-02-21' AND announce_note ILIKE '%tech con%';
UPDATE incubator_cohorts SET capacity = NULL, updated_at = now()
 WHERE slug = 'cohort-1-spring-2027' AND capacity = 10;

-- Treasure Coast Tech Con 2027 (May 30, 2027 is EDT, UTC-4: 10:30 AM ET = 14:30 UTC, 5:00 PM ET = 21:00 UTC).
INSERT INTO community_posts (slug, kind, program, audience, status, pinned, title, body, starts_at, ends_at,
                             location_name, address, registration_url, registration_note, price_text, author_user_id, published_at)
VALUES ('treasure-coast-tech-con-2027', 'event', 'techcon', 'public', 'published', true, 'Treasure Coast Tech Con 2027',
        'A one-day conference of talks, live demos and startup pitches connecting founders, engineers, students and investors on the Treasure Coast.',
        TIMESTAMPTZ '2027-05-30 14:30:00+00', TIMESTAMPTZ '2027-05-30 21:00:00+00',
        'Havert L. Fenn Center', '2000 Virginia Avenue, Fort Pierce, FL 34982', NULL, 'Registration opens soon', 'To be announced',
        'owner-approved:2026-11-22', now())
ON CONFLICT (slug) DO NOTHING;
INSERT INTO event_speakers (post_id, name, role, sort)
SELECT p.id, 'Professor Joseph Ali', 'Keiser University · Guest speaker', 0
  FROM community_posts p
 WHERE p.slug = 'treasure-coast-tech-con-2027'
   AND NOT EXISTS (SELECT 1 FROM event_speakers s WHERE s.post_id = p.id);
