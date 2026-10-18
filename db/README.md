# Database & migrations

The app uses one Neon Postgres database (`DATABASE_URL`). **Production and Vercel Preview currently share
the same database**, so anything run "for a preview" hits production data.

## Files
- `schema-baseline.sql`: exact structure of the live database as of 2026-10-18 (structure only, no data).
  Use it to create an empty development or test database.
- `migrations/NNN_short_name.sql`: numbered, forward-only changes, applied in order.
  - `001_moderation.sql` is already applied to production (included in the baseline).

## Process for a new migration
1. **Number:** take the next number (`002_`, `003_`…), one concern per file, lowercase snake_case name.
2. **Write it to be safe to re-run:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded `DO $$` blocks for
   constraints. Wrap it in `BEGIN; … COMMIT;`. Prefer additive changes (add columns or tables). Destructive changes
   (drop or rename) go in their own later migration, after the code no longer uses the old shape.
3. **Header comment:** purpose, PR link, whether it is backward-compatible with the currently deployed code, and a
   rollback note (the SQL to undo it, or "restore from Neon branch").
4. **Test first** on a Neon *branch* (Neon console → Branches → create from `main`), with the PR preview pointed at it
   if possible. Never test migrations on the production branch.
5. **Owner approval:** every migration that changes production needs John's explicit OK, recorded in the PR.
6. **Apply to production:** take a Neon restore point or branch snapshot first, then run the file in the Neon SQL Editor
   (or `psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f db/migrations/NNN_x.sql`). Apply **before** merging
   code that needs it, so migrations must stay backward-compatible with the deployed code.
7. **Record it:** add a row to the log below and refresh `schema-baseline.sql` from a read-only introspection.

(Optional later: a `schema_migrations(version text primary key, applied_at timestamptz)` table so the applied state
is tracked inside the database itself. Proposed as part of migration 002.)

## Applied log
| # | File | Applied to production | By | Notes |
|---|------|-----------------------|----|-------|
| 001 | 001_moderation.sql | before 2026-10-18 | owner (Neon SQL Editor) | status/user_id/review columns |
