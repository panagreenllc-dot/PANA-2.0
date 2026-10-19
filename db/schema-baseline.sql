-- PANA 2.0 schema baseline: structure only, no data.
-- Captured read-only from the live Neon database (PostgreSQL 17.11) on 2026-10-18
-- via information_schema / pg_catalog. This is the state AFTER 001_moderation.sql.
-- Use it to recreate an empty dev/test database. Do NOT run it against production.

CREATE TABLE IF NOT EXISTS public.projects (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  name         text,                                   -- submitter display name
  email        text,                                   -- submitter email (PRIVATE, never expose publicly)
  project_name text,
  category     text,
  description  text,
  website      text,
  created_at   timestamp without time zone DEFAULT now(),  -- note: no time zone (unlike updated_at)
  status       text        NOT NULL DEFAULT 'pending'::text,
  user_id      text,                                   -- Clerk user id of submitter
  updated_at   timestamp with time zone DEFAULT now(),
  reviewed_at  timestamp with time zone,
  reviewed_by  text,                                   -- Clerk user id of reviewing admin
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);

CREATE INDEX IF NOT EXISTS projects_status_created_idx ON public.projects USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_user_id_idx        ON public.projects USING btree (user_id);

-- Also present in production but NOT used by the app: Neon's sample table.
-- Recorded for completeness; proposed for removal in a later migration (needs owner approval).
-- CREATE TABLE public.playing_with_neon (
--   id    integer NOT NULL DEFAULT nextval('playing_with_neon_id_seq'::regclass) PRIMARY KEY,
--   name  text    NOT NULL,
--   value real
-- );

-- Facts at capture time: no RLS, no triggers, no views, no custom functions,
-- extensions: plpgsql only (gen_random_uuid is built in since PG13). Table owner: neondb_owner.
