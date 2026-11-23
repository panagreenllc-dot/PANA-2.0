#!/usr/bin/env node
// Preview-only seed data (Phase 3 / P3-1): "Cohort 1, Spring 2027".
// Runs from `npm run build` right after the migration runner, with the SAME guard: it only acts on a Vercel Preview
// build whose database is NOT the production endpoint. Production is never seeded; John creates cohorts in admin.
// Idempotent: inserts by slug and never overwrites a cohort that already exists (admin edits win).
import { pathToFileURL } from "node:url";
import { decide } from "./migrate.mjs";

export const SEED_COHORTS = [{
  name: "Cohort 1, Spring 2027",
  slug: "cohort-1-spring-2027",
  summary: "The first PANA incubator cohort: 12 weeks, fully virtual, with guidance, mentorship and access to resources through community partners. Apply with an idea you've shared on PANA.",
  format: "virtual",
  status: "open",                               // shows "Opening soon" until applications open
  apply_opens_at: "2026-12-01T05:00:00Z",       // Tue, Dec 1, 2026, 12:00 AM ET
  apply_closes_at: "2027-02-01T04:59:00Z",      // Sun, Jan 31, 2027, 11:59 PM ET
  starts_on: "2027-03-01",                      // Mon, Mar 1, 2027
  ends_on: "2027-05-23",                        // 12 weeks later (Sun, May 23, 2027)
  announce_on: "2027-02-26",                    // decisions emailed privately by this date (never announced publicly)
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
    const rows = await db.query(
      `INSERT INTO incubator_cohorts (name, slug, summary, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on,
                                      announce_on, announce_note, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'seed:preview')
       ON CONFLICT (slug) DO NOTHING RETURNING slug`,
      [c.name, c.slug, c.summary, c.format, c.status, c.apply_opens_at, c.apply_closes_at, c.starts_on, c.ends_on,
       c.announce_on, c.announce_note, c.capacity]);
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
