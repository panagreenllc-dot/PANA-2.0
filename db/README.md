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
