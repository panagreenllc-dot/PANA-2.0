# Database & migrations

The app uses the Vercel-managed Neon database `neon-bisque-book` (`DATABASE_URL`).

**Preview database (D2).** Previews must use Neon *preview branching*: each Vercel Preview deployment gets its own
copy-on-write Neon branch (`preview/<git-branch>`), and its connection variables are injected at deploy time.
Production keeps the main branch. To enable it (owner, Vercel dashboard): Storage → `neon-bisque-book` → Projects →
`pana-2-0` → Edit/Connect → Advanced Options → Deployments Configuration → turn on **Preview** (and "Resource must be
active before deployment"). Until this is on, Preview shares the production database, and the runner refuses to
migrate there (see below).

## Files
- `schema-baseline.sql`: exact structure of the live database as of 2026-10-18 (structure only, no data).
  Use it to create an empty development or test database.
- `migrations/NNN_short_name.sql`: numbered, forward-only changes, applied in order.
  - `001_moderation.sql` is already applied to production (included in the baseline).

## Runner (`db/migrate.mjs`)
- `npm run build` runs `node db/migrate.mjs --preview-build` first. That step **only** applies migrations when
  `VERCEL_ENV=preview` **and** the database is not the production endpoint (`PRODUCTION_DB_ENDPOINTS` in the
  script). In every other case it logs a message and exits without touching anything. Production builds never migrate.
- `npm run db:migrate:dry` / `npm run db:migrate`: manual runs (uses `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`).
  Refuses production unless `--allow-production` is passed, which needs John's written approval.
- Each file runs in its own transaction together with its `schema_migrations` row, under an advisory lock.
  Applied files are checksummed, and editing one after it was applied is an error. `001` is recorded as pre-applied.
- Tests: `npm test` (uses an in-memory Postgres via PGlite, loaded from `schema-baseline.sql`).

## Process for a new migration
1. **Number:** take the next number (`002_`, `003_`…), one concern per file, lowercase snake_case name.
2. **Write it to be safe to re-run:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks for
   constraints. Do **not** add `BEGIN/COMMIT` (the runner wraps each file). Prefer additive changes (add columns or tables). Destructive changes
   (drop or rename) go in their own later migration, after the code no longer uses the old shape.
3. **Header comment:** purpose, PR link, whether it is backward-compatible with the currently deployed code, and a
   rollback note (the SQL to undo it, or "restore from Neon branch").
4. **Test first:** `npm test`, then the PR's Preview deployment (its own Neon preview branch) applies it automatically.
   Never test migrations on the production branch.
5. **Owner approval:** every migration that changes production needs John's explicit OK, recorded in the PR.
6. **Apply to production:** take a Neon restore point or branch snapshot first, then run the file in the Neon SQL Editor
   or with `npm run db:migrate -- --allow-production`. Apply **before** merging
   code that needs it, so migrations must stay backward-compatible with the deployed code.
7. **Record it:** add a row to the log below and refresh `schema-baseline.sql` from a read-only introspection.

The runner creates and maintains `schema_migrations(version, name, checksum, applied_at)` in each database.

## Applied log
| # | File | Applied to production | By | Notes |
|---|------|-----------------------|----|-------|
| 001 | 001_moderation.sql | before 2026-10-18 | owner (Neon SQL Editor) | status/user_id/review columns |
| 002–005 | members/audit, profiles/reports, ideas v2, collaboration | 2026-10-19 16:40 EDT | runner `--allow-production` (owner approved in writing) | Phase 2 PR 1. Backup taken first (logical JSON dump, LSN 0/6524B60) |
| 006 | 006_collab_delivery.sql | 2026-10-19 19:39 EDT (from `schema_migrations`) | runner `--allow-production` | Collaboration delivery columns + browse index (Phase 2 PR #6). |
| 007 | 007_blank_legacy_project_emails.sql | 2026-10-19 19:39 EDT (from `schema_migrations`) | runner `--allow-production` | Blanked legacy `projects.email` copies (0 rows at the time). |
| 008 | domino_* tables (PANA Domino Royale Phase 1) | 2026-10-21 16:56 EDT | runner `runMigrations` over Neon WebSocket/HTTPS (port 5432 blocked from the box), owner approved in writing 2026-10-21 16:52 EDT | Backup first: `pana-prod-pre-008-20261021-205302.json` (LSN 0/6BFF9F8). Existing data verified identical afterwards. |
| 009 | 009_incubator.sql (Phase 3 P3-1, PR #9) | 2026-11-22 12:20 PM EST | runner `runMigrations` over Neon WebSocket (port 5432 blocked from the box), owner approved in writing 2026-11-22 ("merge it") | Backup first: `pana-prod-pre-009-20261122-172023.json` (logical JSON dump, LSN 0/DD49D60, taken 12:20 PM EST). Dry run showed only 009 pending. Existing tables, columns and data (incl. `domino_*`) verified identical afterwards. Additive: `incubator_cohorts`, `incubator_applications`. |
| 010 | 010_partners_offers_badges.sql (Phase 3 P3-2a, PR #10) | 2026-11-22 1:36 PM EST | runner `runMigrations` over Neon WebSocket (port 5432 blocked from the box), owner approved in writing 2026-11-22 ("merge it") | Backup first: `pana-prod-pre-010-20261122-183627.json` (logical JSON dump, LSN 0/DDBA1B8, taken 1:36 PM EST). Dry run showed only 010 pending. Existing tables, columns, indexes, constraints and data (incl. `domino_*`) verified identical afterwards. Additive: `partners`, `partner_inquiries`, `resource_offers`, `incubator_credentials`. `BADGE_TOKEN_SECRET` (Sensitive) added to Production the same day. Rollback: drop the four tables. |
| 011 | 011_needs_help_requests.sql (Phase 3 P3-2b, PR #11) | 2026-11-22 3:47 PM EST | runner `runMigrations` over Neon WebSocket (port 5432 blocked from the box), owner approved in writing 2026-11-22 ("merge it") | Backup first: `pana-prod-pre-011-20261122-204650.json` (logical JSON dump, LSN 0/DE70B48, taken 3:46 PM EST). Dry run showed only 011 pending. Existing tables, columns, indexes, constraints and data (incl. `domino_*`) verified identical afterwards. Additive: `project_needs`, `help_offers`, `offer_requests`, `partner_contacts`, plus nullable `partners.pending_changes`. Rollback: `DROP TABLE help_offers, project_needs, offer_requests, partner_contacts; ALTER TABLE partners DROP COLUMN pending_changes;` |
| 012 | 012_mentors_investors.sql (Phase 3 P3-3, PR #12) | 2026-11-22 6:28 PM EST | runner `runMigrations` over Neon WebSocket (port 5432 blocked from the box), owner approved in writing 2026-11-22 ("Merge it") | Backup first: `pana-prod-pre-012-20261122-232751.json` (logical JSON dump, LSN 0/DEDB078, taken 6:27 PM EST). Dry run showed only 012 pending. Existing tables, columns, indexes, constraints and data (incl. `domino_*`) verified identical afterwards, except the intended changes: new `projects.investor_interest_open` (NOT NULL DEFAULT false) and a wider `reports_target_type_check`. Additive: `mentor_profiles`, `investor_profiles`, `mentorship_requests`, `investor_interests`. Rollback: `DROP TABLE investor_interests, mentorship_requests, investor_profiles, mentor_profiles; ALTER TABLE projects DROP COLUMN investor_interest_open;` and restore the old reports check (`profile`, `idea`, `request`). |

## Preview seed (`db/seed-preview.mjs`)
`npm run build` also runs `node db/seed-preview.mjs`, with the same guard as the runner: it only acts on a Vercel Preview
build whose database is **not** production. It inserts "Cohort 1, Spring 2027" (by slug, never overwriting). Production is
never seeded; John creates cohorts in **Admin → Incubator**.

It also resets the Clerk **dev** test member `pana-terms+clerk_test@example.com` (code 424242) to the pre-Phase-3 Terms
version (`2026-10-draft`) on every preview build, so the "We updated our Terms" banner can be tested. Only
`+clerk_test@example.com` addresses are accepted by that step; real members are never touched.

Note: a Neon preview branch starts as a copy of production data, so it contains real members' emails. Never add a shared
test address (like `+clerk_test`) to a preview's `ADMIN_EMAILS` on a deployment that has a share link.


## Badge secret (`BADGE_TOKEN_SECRET`)

Badge QR codes are derived as HMAC-SHA256(`BADGE_TOKEN_SECRET`, nonce); the database stores only the nonce and a
SHA-256 hash of the code, never the code itself. Set it per environment as a Sensitive env var (e.g. `openssl rand -base64 48`).
Without it badges are simply switched off. Changing it invalidates every printed badge (members can open /me/badge for a new one).

## Requests and introductions (`lib/requests*.ts`, P3-2b)
Collaboration requests, help offers on needs, and "Request through PANA" offer requests share one flow: a short note with
no contact details → the responder accepts or declines (30-day expiry, 10 requests/day across all kinds) → on accept,
ONE introduction email shares both addresses. Rules are in `lib/requests.ts` (pure), SQL in `lib/requests-sql.ts`
(PGlite-tested in `db/needs.test.mjs`), delivery in `lib/requests-repo.ts`. List/detail queries never select an email;
only the `PARTIES_SQL` queries do, for the notice and the introduction. Offer requests on a partner with no linked
contacts are answered by PANA (admin), and the introduction then goes to the PANA inbox (`ADMIN_NOTIFY_EMAIL`).

P3-3 adds two kinds to the same flow: **mentorship requests** (mentee → an approved mentor; max 5/day, and a mentor's
`max_open_mentees` caps pending + accepted-in-the-last-90-days requests) and **investor interest** (an approved investor →
the owner of an idea with `projects.investor_interest_open = true`; max 10/day). Both also count toward the shared 10/day.
Mentor/investor roles live in `mentor_profiles` / `investor_profiles` (SQL in `lib/mentors-sql.ts`, PGlite-tested in
`db/mentors.test.mjs`); John approves, declines or revokes each one in Admin → Mentors & Investors (audited).

**012 (`012_mentors_investors.sql`) is on production** (applied 2026-11-22 6:28 PM EST, before PR #12 was merged; see the log above).

## Community feed, events and member board (`lib/community*.ts`, P3-4)

**013 (`013_community_posts.sql`) is NOT on production yet.** It runs only on the Vercel Preview branch database until John
approves it in writing; then: backup → dry run → apply → verify → merge → add a row to the applied log above.

- `community_posts` + `event_agenda_items` + `event_speakers`: John's announcements and events (Admin → Community). Times are
  typed in ET (`parseEasternLocal`) and stored in UTC. Price (`price_text`) and the registration link/note are plain fields,
  so "To be announced" → "Free" or adding a link later is an admin edit, not a code change.
- `member_posts` + `member_post_replies`: the members-only board. A member's first post or reply is `pending`; once one is
  approved, later ones publish straight away (decided in SQL, `POST_INSERT_SQL` / `REPLY_INSERT_SQL`). Limits: 5 posts and 30
  replies a day. Contact details and money amounts are rejected in `lib/community.ts`. Three distinct open reports set
  `hidden_by_reports` until John reviews. Rows cascade when a member is deleted.
- `community_digests` + `community_digest_recipients`: the opt-in digest (`email_prefs.community_digest`, off by default) of
  John's posts only; at most one every 14 days, sent 90 per day. `DIGEST_TARGETS_SQL` is the only query that reads emails.
- `reports_target_type_check` is widened with `member_post` and `member_reply`.

**Data changes inside 013 (prod effect at merge, guarded on the old values so re-runs are no-ops):**
- Incubator cohort `cohort-1-spring-2027` (prod id `7fe7aedf-2f8c-40c2-9f6a-9b91186c16d0`): `capacity` 10 → NULL (no fixed
  spots; the column becomes nullable), `announce_on` 2027-02-21 → 2027-02-26 (date decisions are emailed by),
  `announce_note` "…announced at Treasure Coast Tech Con" → NULL. Application and program dates are unchanged.
- Seeds the Tech Con event `treasure-coast-tech-con-2027`: Sun May 30, 2027, 10:30 AM–5:00 PM ET, Havert L. Fenn Center,
  price "To be announced", "Registration opens soon", speaker Professor Joseph Ali (Keiser University · Guest speaker).

Rollback: `DROP TABLE community_digest_recipients, community_digests, member_post_replies, member_posts, event_speakers,
event_agenda_items, community_posts;` restore the 012 reports check; put the cohort values back and `SET NOT NULL DEFAULT 10`
on `incubator_cohorts.capacity` (after filling NULLs). Existing tables, including `domino_*`, are untouched (PGlite test).
