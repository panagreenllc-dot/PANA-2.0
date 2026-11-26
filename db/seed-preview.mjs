#!/usr/bin/env node
// Preview-only seed data: an always-open "PANA Incubator" program (open enrollment, no apply window).
// Runs from `npm run build` right after the migration runner, with the SAME guard: it only acts on a Vercel Preview
// build whose database is NOT the production endpoint. Production is never seeded.
// Idempotent: inserts by slug (never overwriting a row John created). Rows previously inserted by this seed
// (`created_by = 'seed:preview'`) are updated so reused preview databases pick up open enrollment.
import { pathToFileURL } from "node:url";
import { decide } from "./migrate.mjs";

export const SEED_COHORTS = [{
  name: "PANA Incubator",
  slug: "cohort-1-spring-2027",                 // same slug as production so a Neon preview copy is not duplicated
  summary: "Open enrollment: apply any time, year-round. We review your idea and what you're looking for, then email you a decision.",
  format: "virtual",
  status: "open",
  apply_opens_at: null,
  apply_closes_at: null,
  starts_on: null,
  ends_on: null,
  announce_on: null,
  announce_note: null,
  capacity: null,                               // no fixed number of spots
}];

// Preview-only test fixture for the Terms re-accept banner: these Clerk *dev* test addresses (fixed code 424242) are
// reset to the pre-Phase-3 Terms version on every preview build, so a tester can sign in as one and see the banner.
// Only "+clerk_test@example.com" addresses are allowed here; real members are never touched.
export const STALE_TERMS_TEST_EMAILS = ["pana-terms+clerk_test@example.com"];
export const STALE_TERMS_VERSION = "2026-10-draft";

export async function resetStaleTermsFixtures(db, emails = STALE_TERMS_TEST_EMAILS) {
  const safe = emails.filter((e) => /\+clerk_test@example\.com$/i.test(e));
  if (!safe.length) return 0;
  const rows = await db.query(
    `UPDATE members SET terms_version = $2
      WHERE lower(email) = ANY($1::text[]) AND age_attested_at IS NOT NULL AND terms_version IS DISTINCT FROM $2
      RETURNING 1`,
    [safe.map((e) => e.toLowerCase()), STALE_TERMS_VERSION]);
  return rows.length;
}

/** db: { query(text, params) => rows } */
export async function seedPreview(db, cohorts = SEED_COHORTS) {
  const inserted = [];
  for (const c of cohorts) {
    const vals = [c.name, c.slug, c.summary, c.format, c.status, c.apply_opens_at, c.apply_closes_at, c.starts_on, c.ends_on,
      c.announce_on, c.announce_note, c.capacity];
    const updated = await db.query(
      `UPDATE incubator_cohorts SET name = $1, summary = $3, format = $4, status = $5,
              apply_opens_at = $6, apply_closes_at = $7, starts_on = $8, ends_on = $9,
              announce_on = $10, announce_note = $11, capacity = $12, updated_at = now()
        WHERE slug = $2 AND created_by = 'seed:preview'
          AND (name, summary, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on, announce_on, announce_note, capacity)
              IS DISTINCT FROM ($1, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::date, $9::date, $10::date, $11, $12)
        RETURNING slug`,
      vals);
    if (updated.length) { inserted.push(c.slug); continue; }
    const rows = await db.query(
      `INSERT INTO incubator_cohorts (name, slug, summary, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on,
                                      announce_on, announce_note, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'seed:preview')
       ON CONFLICT (slug) DO NOTHING RETURNING slug`,
      vals);
    if (rows.length) inserted.push(c.slug);
  }
  return inserted;
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const d = decide({ url, env: process.env, previewBuild: true });
  if (!d.run) { console.log(`[seed] ${d.reason}`); return; }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const done = await seedPreview({ query: async (t, p) => (await client.query(t, p)).rows });
    console.log(`[seed] preview seed ${done.length ? `inserted: ${done.join(", ")}` : "already present"}`);
    const reset = await resetStaleTermsFixtures({ query: async (t, p) => (await client.query(t, p)).rows });
    console.log(`[seed] stale-Terms test fixtures reset: ${reset}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`[seed] ERROR: ${e.message}`); process.exit(1); });
}
