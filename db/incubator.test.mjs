// Run: npm test. Migration 009 + the shipped incubator SQL (lib/incubator-sql.ts) on PGlite after all migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import { resetStaleTermsFixtures, seedPreview, SEED_COHORTS } from "./seed-preview.mjs";
import {
  ACCEPTED_COUNT_SQL, ADMIN_COHORTS_SQL, ADMIN_QUEUE_SQL, APPLY_INSERT_SQL, COHORT_ACCEPTING_SQL, DECIDE_SQL, MY_APPLICATIONS_SQL,
  NOTIFY_TARGETS_SQL, PARTICIPANT_SQL, PENDING_APPLICATIONS_SQL, PREFS_MERGE_SQL, PUBLIC_COHORTS_SQL, WITHDRAW_APPLICATION_SQL,
} from "../lib/incubator-sql.ts";
import { canDecide, DECISIONS } from "../lib/incubator.ts";

async function db({ upTo } = {}) {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  const all = loadMigrations();
  await runMigrations(d, upTo ? all.filter((m) => m.version <= upTo) : all, { log: () => {} });
  return { pg, d };
}

async function fixture() {
  const { pg, d } = await db();
  for (const u of ["alice", "bob", "carol"]) await d.query("INSERT INTO members (user_id, email, display_name, status) VALUES ($1, $2, $3, 'active')", [u, `${u}@example.com`, u]);
  const idea = async (user, status = "approved") => (await d.query(
    `INSERT INTO projects (user_id, name, project_name, category, description, status) VALUES ($1, $1, $2, 'AI', 'A useful description for testing.', $3) RETURNING id::text AS id`,
    [user, `${user}-idea-${status}`, status]))[0].id;
  const cohort = async (o = {}) => (await d.query(
    `INSERT INTO incubator_cohorts (name, slug, status, apply_opens_at, apply_closes_at, capacity)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text AS id`,
    [o.name ?? "Test cohort", o.slug ?? `c-${Math.random().toString(36).slice(2, 8)}`, o.status ?? "open",
     o.opens ?? new Date(Date.now() - 86400000).toISOString(), o.closes ?? new Date(Date.now() + 86400000).toISOString(), o.capacity ?? 10]))[0].id;
  const apply = (c, user, project, o = {}) => d.query(APPLY_INSERT_SQL,
    [c, user, project, o.stage ?? "building", o.goals ?? "G".repeat(60), o.hours ?? 10, o.needs ?? ["mentorship"], o.team ?? null, JSON.stringify(o.links ?? {})]);
  return { pg, d, idea, cohort, apply };
}

test("009 is additive: applies on top of 001-008 and leaves domino_* tables exactly as they were", async () => {
  const { pg, d } = await db({ upTo: "008" });
  const shape = async () => JSON.stringify(await d.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name LIKE 'domino_%' ORDER BY table_name, column_name`));
  const cons = async () => JSON.stringify(await d.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid::regclass::text LIKE 'domino_%' ORDER BY conname`));
  const before = [await shape(), await cons()];
  await runMigrations(d, loadMigrations(), { log: () => {} });
  assert.deepEqual([await shape(), await cons()], before);
  const tables = (await d.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('incubator_applications', 'incubator_cohorts') ORDER BY 1")).map((r) => r.table_name);
  assert.deepEqual(tables, ["incubator_applications", "incubator_cohorts"]);
  assert.deepEqual(await runMigrations(d, loadMigrations(), { log: () => {} }), [], "idempotent");
  await pg.close();
});

test("constraints: statuses, needs (access only, no money), hours, goals length, window and slug", async () => {
  const { pg, d, idea, cohort, apply } = await fixture();
  await assert.rejects(d.query("INSERT INTO incubator_cohorts (name, slug, status) VALUES ('X', 'x', 'bogus')"));
  await assert.rejects(d.query("INSERT INTO incubator_cohorts (name, slug) VALUES ('X', 'Bad Slug')"));
  await assert.rejects(d.query("INSERT INTO incubator_cohorts (name, slug, apply_opens_at, apply_closes_at) VALUES ('X', 'x2', now(), now() - interval '1 day')"));
  await assert.rejects(d.query("INSERT INTO incubator_cohorts (name, slug, capacity) VALUES ('X', 'x3', 0)"));
  const c = await cohort();
  const p = await idea("alice");
  await assert.rejects(apply(c, "alice", p, { needs: ["small_grant"] }), "grants are not a need");
  await assert.rejects(apply(c, "alice", p, { needs: ["computer"] }), "computers are not handed out");
  await assert.rejects(apply(c, "alice", p, { hours: 0 }));
  await assert.rejects(apply(c, "alice", p, { goals: "too short" }));
  await assert.rejects(apply(c, "alice", p, { stage: "nope" }));
  await assert.rejects(d.query("INSERT INTO incubator_applications (cohort_id, user_id, stage, goals, weekly_hours, participant_status) VALUES ($1, 'alice', 'concept', $2, 5, 'active')", [c, "G".repeat(60)]),
    "participant status only for accepted");
  await pg.close();
});

test("apply: only while open, only with your own active idea, one live application per cohort", async () => {
  const { pg, d, idea, cohort, apply } = await fixture();
  const open = await cohort();
  const upcoming = await cohort({ opens: new Date(Date.now() + 86400000).toISOString(), closes: new Date(Date.now() + 2 * 86400000).toISOString() });
  const past = await cohort({ opens: new Date(Date.now() - 2 * 86400000).toISOString(), closes: new Date(Date.now() - 86400000).toISOString() });
  const draft = await cohort({ status: "draft" });
  const mine = await idea("alice");
  const pending = await idea("alice", "pending");
  const rejected = await idea("alice", "rejected");
  const bobs = await idea("bob");

  assert.equal((await d.query(COHORT_ACCEPTING_SQL, [open])).length, 1);
  for (const c of [upcoming, past, draft]) {
    assert.equal((await d.query(COHORT_ACCEPTING_SQL, [c])).length, 0);
    assert.equal((await apply(c, "alice", mine)).length, 0, "closed / upcoming / draft cohorts reject applications");
  }
  assert.equal((await apply(open, "alice", bobs)).length, 0, "can't apply with someone else's idea");
  assert.equal((await apply(open, "alice", rejected)).length, 0, "can't apply with a rejected idea");
  const a1 = await apply(open, "alice", pending);
  assert.equal(a1.length, 1, "an idea still in review is fine");
  assert.equal((await apply(open, "alice", mine)).length, 0, "one live application per cohort");
  assert.equal((await d.query(WITHDRAW_APPLICATION_SQL, [a1[0].id, "bob"])).length, 0, "only the applicant withdraws");
  assert.equal((await d.query(WITHDRAW_APPLICATION_SQL, [a1[0].id, "alice"])).length, 1);
  assert.equal((await apply(open, "alice", mine)).length, 1, "can re-apply after withdrawing");
  assert.equal((await d.query(PENDING_APPLICATIONS_SQL))[0].n, 1);
  await pg.close();
});

test("decisions: SQL transitions match canDecide() for every status pair; accept makes an active participant", async () => {
  const { pg, d, idea, cohort, apply } = await fixture();
  const statuses = ["submitted", "under_review", "accepted", "waitlisted", "declined", "withdrawn"];
  const c = await cohort({ capacity: 100 });
  let n = 0;
  for (const from of statuses) {
    for (const to of [...DECISIONS, "withdrawn", "bogus"]) {
      const user = `u${n++}`;
      await d.query("INSERT INTO members (user_id, email, status) VALUES ($1, $2, 'active')", [user, `${user}@example.com`]);
      const id = (await apply(c, user, await idea(user)))[0].id;
      if (from !== "submitted") await d.query("UPDATE incubator_applications SET status = $2, participant_status = CASE WHEN $2 = 'accepted' THEN 'active' END WHERE id::text = $1", [id, from]);
      const rows = await d.query(DECIDE_SQL, [id, "admin", to, "note", null]);
      assert.equal(rows.length === 1, canDecide(from, to), `${from} -> ${to}`);
      if (rows.length && to === "accepted") {
        const [r] = await d.query("SELECT participant_status, decision_note, reviewed_by FROM incubator_applications WHERE id::text = $1", [id]);
        assert.deepEqual(r, { participant_status: "active", decision_note: "note", reviewed_by: "admin" });
      }
    }
  }
  assert.ok((await d.query(ACCEPTED_COUNT_SQL, [c]))[0].n >= 3);
  await pg.close();
});

test("participant status, admin queue without emails, member view without admin notes", async () => {
  const { pg, d, idea, cohort, apply } = await fixture();
  const c = await cohort();
  const id = (await apply(c, "alice", await idea("alice")))[0].id;
  assert.equal((await d.query(PARTICIPANT_SQL, [id, "completed"])).length, 0, "not accepted yet");
  await d.query(DECIDE_SQL, [id, "admin", "accepted", "Welcome!", "strong team"]);
  assert.equal((await d.query(PARTICIPANT_SQL, [id, "left"])).length, 1);
  assert.equal((await d.query(PARTICIPANT_SQL, [id, "bogus"])).length, 0);
  const queue = await d.query(ADMIN_QUEUE_SQL, [c]);
  assert.equal(queue.length, 1);
  assert.ok(!JSON.stringify(queue).includes("@example.com"), "admin queue never selects emails");
  const mine = await d.query(MY_APPLICATIONS_SQL, ["alice"]);
  assert.equal(mine[0].decision_note, "Welcome!");
  assert.ok(!("admin_note" in mine[0]) && !JSON.stringify(mine).includes("strong team"), "applicant never sees the private note");
  assert.ok(!JSON.stringify(mine).includes("@example.com"));
  const list = await d.query(ADMIN_COHORTS_SQL);
  assert.equal(list.find((r) => r.id === c).accepted, 1);
  await pg.close();
});

test("account deletion cascades; deleting an idea keeps the application without it", async () => {
  const { pg, d, idea, cohort, apply } = await fixture();
  const c = await cohort();
  const pa = await idea("alice");
  await apply(c, "alice", pa);
  const pb = await idea("bob");
  await apply(c, "bob", pb);
  await d.query("DELETE FROM projects WHERE id::text = $1", [pb]);
  assert.equal((await d.query("SELECT project_id FROM incubator_applications WHERE user_id = 'bob'"))[0].project_id, null);
  // the Clerk user.deleted webhook path:
  await d.query("DELETE FROM projects WHERE user_id = 'alice'");
  await d.query("DELETE FROM members WHERE user_id = 'alice'");
  assert.equal((await d.query("SELECT count(*)::int n FROM incubator_applications WHERE user_id = 'alice'"))[0].n, 0);
  await assert.rejects(d.query("DELETE FROM incubator_cohorts WHERE id::text = $1", [c]), "cohorts with applications can't be deleted by accident");
  await pg.close();
});

test("public cohort list hides drafts and completed cohorts; preview seed is idempotent and in ET", async () => {
  const { pg, d, cohort } = await fixture();
  await cohort({ status: "draft", slug: "d1" });
  await cohort({ status: "completed", slug: "done1" });
  assert.deepEqual(await seedPreview(d), ["cohort-1-spring-2027"]);
  assert.deepEqual(await seedPreview(d), [], "second run inserts nothing");
  const pub = await d.query(PUBLIC_COHORTS_SQL);
  assert.deepEqual(pub.map((r) => r.slug), ["cohort-1-spring-2027"]);
  const [s] = pub;
  assert.equal(s.capacity, null, "no fixed number of spots");
  assert.equal(s.format, "virtual");
  assert.equal(new Date(s.apply_opens_at).toISOString(), "2026-12-01T05:00:00.000Z", "Dec 1, 12:00 AM ET");
  assert.equal(new Date(s.apply_closes_at).toISOString(), "2027-02-01T04:59:00.000Z", "Jan 31, 11:59 PM ET");
  assert.deepEqual([s.starts_on, s.ends_on, s.announce_on], ["2027-03-01", "2027-05-23", "2027-02-26"]);
  assert.equal((Date.parse(`${s.ends_on}T00:00:00Z`) - Date.parse(`${s.starts_on}T00:00:00Z`)) / 86400000 + 1, 84, "12 weeks");
  assert.equal(SEED_COHORTS.length, 1);
  await pg.close();
});

test("email prefs merge without wiping other keys; notify targets are opted-in active members only", async () => {
  const { pg, d } = await fixture();
  await d.query(PREFS_MERGE_SQL, ["alice", JSON.stringify({ incubator_news: true })]);
  await d.query(PREFS_MERGE_SQL, ["bob", JSON.stringify({ incubator_news: true })]);
  await d.query("UPDATE members SET status = 'banned' WHERE user_id = 'bob'");
  const [a] = await d.query("SELECT email_prefs FROM members WHERE user_id = 'alice'");
  assert.deepEqual(a.email_prefs, { requests: true, reviews: true, incubator_news: true });
  assert.deepEqual((await d.query(NOTIFY_TARGETS_SQL, [90])).map((r) => r.user_id), ["alice"]);
  await pg.close();
});

test("preview stale-Terms fixture only touches +clerk_test@example.com members who finished onboarding", async () => {
  const { pg, d } = await fixture();
  const ins = "INSERT INTO members (user_id, email, age_attested_at, terms_version) VALUES ($1, $2, $3, '2026-12')";
  await d.query(ins, ["t1", "Pana-Terms+clerk_test@example.com", new Date()]);
  await d.query(ins, ["t2", "pana-terms+clerk_test@example.com.evil.org", new Date()]);
  await d.query(ins, ["t3", "real.person@gmail.com", new Date()]);
  const emails = ["pana-terms+clerk_test@example.com", "real.person@gmail.com"];
  assert.equal(await resetStaleTermsFixtures(d, emails), 1, "real address filtered out before the query");
  assert.equal(await resetStaleTermsFixtures(d, emails), 0, "idempotent");
  const rows = await d.query("SELECT user_id, terms_version FROM members WHERE user_id IN ('t1','t2','t3') ORDER BY user_id");
  assert.deepEqual(rows.map((r) => r.terms_version), ["2026-10-draft", "2026-12", "2026-12"]);
  await pg.close();
});
