-- 008: PANA Domino Royale, Phase 1 (accounts, free tokens, daily bonus, challenges, badges, trophies).
-- Used by the domino game (play.panagreen.org, repo panagreenllc-dot/pana-domino-royale), signed in with PANA's Clerk.
-- Additive: new domino_* tables only. Nothing in PANA 2.0 reads or writes them, so this is backward-compatible
-- with the deployed PANA code. Players hang off members(user_id): deleting a member (Clerk user.deleted webhook,
-- admin delete) cascades and removes all of their domino data.
-- Tokens are free entertainment credits: they can't be bought, cashed out or transferred. The ledger's reason list
-- has no purchase / cash-out / transfer reasons, and the ledger is append-only (balance = sum of rows).
-- Rollback: DROP TABLE IF EXISTS domino_challenge_progress, domino_challenges, domino_trophies,
--           domino_player_badges, domino_badges, domino_token_ledger, domino_players CASCADE;
--           DROP FUNCTION IF EXISTS domino_ledger_guard();

CREATE TABLE IF NOT EXISTS domino_players (
  user_id            text PRIMARY KEY REFERENCES members(user_id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_daily_on      date,                                  -- last daily-bonus day (America/New_York)
  daily_streak       integer NOT NULL DEFAULT 0,            -- consecutive days the bonus was claimed
  best_daily_streak  integer NOT NULL DEFAULT 0
);

-- Append-only token ledger. A player's balance is SUM(amount). idem_key makes every grant happen at most once.
CREATE TABLE IF NOT EXISTS domino_token_ledger (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES domino_players(user_id) ON DELETE CASCADE,
  amount      integer NOT NULL,
  reason      text NOT NULL,
  idem_key    text NOT NULL,
  ref         text,                                          -- e.g. the day, challenge code or game id
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domino_ledger_idem_key UNIQUE (idem_key),
  CONSTRAINT domino_ledger_nonzero CHECK (amount <> 0),
  CONSTRAINT domino_ledger_reason_check CHECK (reason IN (
    'signup', 'daily_bonus', 'challenge', 'game_win', 'title_bonus', 'muggins_win', 'dekabes', 'square', 'streak',
    'stake', 'bag_payout', 'tournament_entry', 'tournament_prize', 'cosmetic', 'admin_adjust', 'reversal')),
  CONSTRAINT domino_ledger_sign_check CHECK (
    (reason IN ('signup', 'daily_bonus', 'challenge', 'game_win', 'title_bonus', 'muggins_win', 'dekabes', 'square',
                'streak', 'tournament_prize') AND amount > 0)
    OR (reason IN ('tournament_entry', 'cosmetic') AND amount < 0)
    OR reason IN ('stake', 'bag_payout', 'admin_adjust', 'reversal'))
);
CREATE INDEX IF NOT EXISTS domino_ledger_user_idx ON domino_token_ledger (user_id, created_at DESC);

-- Rows can't be edited, and can only be deleted together with their player (account deletion).
-- Corrections are new 'reversal' / 'admin_adjust' rows.
CREATE OR REPLACE FUNCTION domino_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'domino_token_ledger is append-only';
  END IF;
  IF EXISTS (SELECT 1 FROM domino_players WHERE user_id = OLD.user_id) THEN
    RAISE EXCEPTION 'domino_token_ledger is append-only (rows go only with their player)';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS domino_ledger_guard ON domino_token_ledger;
CREATE TRIGGER domino_ledger_guard BEFORE UPDATE OR DELETE ON domino_token_ledger
  FOR EACH ROW EXECUTE FUNCTION domino_ledger_guard();

CREATE TABLE IF NOT EXISTS domino_badges (
  code         text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL,
  sort         integer NOT NULL DEFAULT 0
);
INSERT INTO domino_badges (code, name, description, sort) VALUES
  ('founding_member', 'Founding Member', 'Joined PANA Domino Royale in its first season.', 10),
  ('checkin_3',  'Regular',          'Claimed the daily bonus 3 days in a row.', 20),
  ('checkin_7',  'Every Day Player', 'Claimed the daily bonus 7 days in a row.', 21),
  ('checkin_30', 'Fixture at the Table', 'Claimed the daily bonus 30 days in a row.', 22),
  ('partners_title_bronze', 'Partners Title (Bronze)', 'Won a Partners title (4 in a row) online.', 30),
  ('partners_title_silver', 'Partners Title (Silver)', 'Won 10 Partners titles online.', 31),
  ('partners_title_gold',   'Partners Title (Gold)',   'Won 50 Partners titles online.', 32),
  ('muggins_bronze', 'Muggins Winner (Bronze)', 'Won a Muggins match online.', 40),
  ('muggins_silver', 'Muggins Winner (Silver)', 'Won 10 Muggins matches online.', 41),
  ('muggins_gold',   'Muggins Winner (Gold)',   'Won 50 Muggins matches online.', 42),
  ('first_dekabes', 'Dekabes!', 'Won a hand online with a dekabes (double win).', 50)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort = EXCLUDED.sort;

CREATE TABLE IF NOT EXISTS domino_player_badges (
  user_id     text NOT NULL REFERENCES domino_players(user_id) ON DELETE CASCADE,
  badge_code  text NOT NULL REFERENCES domino_badges(code),
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_code)
);

-- Virtual trophies (tournament wins, season titles). Real trophies only after a lawyer review.
CREATE TABLE IF NOT EXISTS domino_trophies (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES domino_players(user_id) ON DELETE CASCADE,
  code        text NOT NULL,                                 -- unique per award, e.g. 'weekend-2026-11-07-partners-1st'
  title       text NOT NULL,
  detail      text,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domino_trophies_user_code UNIQUE (user_id, code)
);

-- Daily challenges. event = what advances it; kind 'count' adds up, 'max' keeps the best value seen that day.
CREATE TABLE IF NOT EXISTS domino_challenges (
  code         text PRIMARY KEY,
  title        text NOT NULL,
  reward       integer NOT NULL CHECK (reward > 0),
  target       integer NOT NULL DEFAULT 1 CHECK (target > 0),
  event        text NOT NULL,
  kind         text NOT NULL DEFAULT 'count' CHECK (kind IN ('count', 'max')),
  active       boolean NOT NULL DEFAULT true,
  sort         integer NOT NULL DEFAULT 0
);
-- Phase 1 can only verify server-side events (no online games yet), so only check-in challenges are active.
-- The game challenges switch on in Phase 2, when the server referees online games.
INSERT INTO domino_challenges (code, title, reward, target, event, kind, active, sort) VALUES
  ('claim_daily',    'Claim today''s bonus',          25, 1, 'daily_claim',  'count', true,  10),
  ('streak_3',       'Check in 3 days in a row',      50, 3, 'daily_streak', 'max',   true,  20),
  ('win_2_online',   'Win 2 online games',            50, 2, 'game_win',     'count', false, 30),
  ('dekabes_online', 'Win a hand with a dekabes',     75, 1, 'dekabes',      'count', false, 40),
  ('muggins_square', 'Score a Square in Muggins',     50, 1, 'square',       'count', false, 50)
ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, reward = EXCLUDED.reward, target = EXCLUDED.target,
  event = EXCLUDED.event, kind = EXCLUDED.kind, active = EXCLUDED.active, sort = EXCLUDED.sort;

CREATE TABLE IF NOT EXISTS domino_challenge_progress (
  user_id       text NOT NULL REFERENCES domino_players(user_id) ON DELETE CASCADE,
  day           date NOT NULL,                               -- America/New_York day
  code          text NOT NULL REFERENCES domino_challenges(code),
  progress      integer NOT NULL DEFAULT 0,
  completed_at  timestamptz,
  PRIMARY KEY (user_id, day, code)
);
