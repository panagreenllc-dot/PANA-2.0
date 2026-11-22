// Run: npm test. Migration 010 + the shipped P3-2a SQL (lib/partners-sql.ts) on PGlite after all migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import * as S from "../lib/partners-sql.ts";
import { DECIDE_SQL, PARTICIPANT_SQL } from "../lib/incubator-sql.ts";
import { badgeIsValid, deriveToken, hashToken, newNonce } from "../lib/badge.ts";

async function db({ upTo } = {}) {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  const all = loadMigrations();
  await runMigrations(d, upTo ? all.filter((m) => m.version <= upTo) : all, { log: () => {} });
  return { pg, d };
}

const SECRET = "test-secret-test-secret-test-secret-123";
const ymd = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function fixture() {
  const { pg, d } = await db();
  for (const u of ["alice", "bob"]) await d.query("INSERT INTO members (user_id, email, display_name, status) VALUES ($1, $2, $3, 'active')", [u, `${u}@example.com`, `${u} Smith`]);
  const partner = async (o = {}) => (await d.query(
    "INSERT INTO partners (slug, name, kind, status, public_listing) VALUES ($1, $2, $3, $4, $5) RETURNING id::text AS id",
    [o.slug ?? `p-${Math.random().toString(36).slice(2, 8)}`, o.name ?? "Test Library", o.kind ?? "library", o.status ?? "approved", o.listed ?? true]))[0].id;
  const offer = async (pid, o = {}) => (await d.query(
    `INSERT INTO resource_offers (partner_id, type, title, eligibility, claim_method, external_url, status, ends_on, cohort_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id::text AS id`,
    [pid, o.type ?? "lab_hours", o.title ?? "Lab time", o.eligibility ?? "incubator_participants", o.claim ?? "show_badge",
     o.url ?? null, o.status ?? "published", o.ends ?? null, o.cohort ?? null]))[0].id;
  const cohort = (await d.query(
    "INSERT INTO incubator_cohorts (name, slug, status, ends_on, starts_on) VALUES ('C1', 'c1', 'active', $1, $2) RETURNING id::text AS id",
    [ymd(30), ymd(-30)]))[0].id;
  const idea = (await d.query(
    "INSERT INTO projects (user_id, name, project_name, category, description, status) VALUES ('alice','alice','A','AI','A useful description for testing.','approved') RETURNING id::text AS id"))[0].id;
  const app = (await d.query(
    "INSERT INTO incubator_applications (cohort_id, user_id, project_id, stage, goals, weekly_hours, needs) VALUES ($1, 'alice', $2, 'building', $3, 5, '{}') RETURNING id::text AS id",
    [cohort, idea, "G".repeat(60)]))[0].id;
  return { pg, d, partner, offer, cohort, app };
}

test("010 is additive: applies on top of 001-009 and leaves domino_* and incubator tables exactly as they were", async () => {
  const { pg, d } = await db({ upTo: "009" });
  const shape = async () => JSON.stringify(await d.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND (table_name LIKE 'domino_%' OR table_name IN ('incubator_cohorts', 'incubator_applications', 'members', 'projects', 'reports'))
     ORDER BY table_name, column_name`));
  const cons = async () => JSON.stringify(await d.query(
    `SELECT conrelid::regclass::text AS t, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid::regclass::text LIKE 'domino_%' OR conrelid::regclass::text IN ('incubator_cohorts', 'incubator_applications', 'reports') ORDER BY 1, 2`));
  const before = [await shape(), await cons()];
  await runMigrations(d, loadMigrations().filter((m) => m.version <= "010"), { log: () => {} });
  assert.deepEqual([await shape(), await cons()], before);
  const tables = (await d.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('partners','partner_inquiries','resource_offers','incubator_credentials') ORDER BY 1")).map((r) => r.table_name);
  assert.deepEqual(tables, ["incubator_credentials", "partner_inquiries", "partners", "resource_offers"]);
  assert.deepEqual(await runMigrations(d, loadMigrations().filter((m) => m.version <= "010"), { log: () => {} }), [], "idempotent");
  await pg.close();
});

test("constraints: offers carry no money and keep claim methods consistent", async () => {
  const { pg, d, partner } = await fixture();
  const p = await partner();
  const ins = (o) => d.query(`INSERT INTO resource_offers (partner_id, type, title, eligibility, claim_method, external_url) VALUES ($1, $2, 'Title', $3, $4, $5)`,
    [p, o.type ?? "lab_hours", o.elig ?? "incubator_participants", o.claim ?? "show_badge", o.url ?? null]);
  await assert.rejects(ins({ type: "grant" }), "no grant type");
  await assert.rejects(ins({ elig: "public", claim: "show_badge" }), "badge offers are participant-only");
  await assert.rejects(ins({ claim: "external_link" }), "external link needs a url");
  await assert.rejects(ins({ claim: "show_badge", url: "https://x.org" }), "only external links have a url");
  await assert.rejects(ins({ elig: "public", claim: "external_link", url: "javascript:alert(1)" }), "http(s) only");
  await ins({ elig: "public", claim: "external_link", url: "https://library.example.org/book" });
  const cols = (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'resource_offers'")).map((r) => r.column_name);
  assert.ok(!cols.some((c) => /amount|price|dollar|grant/.test(c)), "no money columns");
  await assert.rejects(d.query("INSERT INTO partners (slug, name) VALUES ('Bad Slug', 'X Y')"));
  await assert.rejects(d.query("INSERT INTO partner_inquiries (org_name, contact_name, contact_email) VALUES ('Org', 'Jo', 'not-an-email')"));
  await assert.rejects(d.query("INSERT INTO partner_inquiries (org_name, contact_name, contact_email, can_offer) VALUES ('Org', 'Jo', 'a@b.co', '{cash}')"));
  await pg.close();
});

test("public directory and live offers: approved + listed partners only; drafts, paused and past-end offers hidden", async () => {
  const { pg, d, partner, offer } = await fixture();
  const a = await partner({ slug: "a-lib", name: "A Library" });
  await partner({ slug: "pending-co", status: "pending" });
  await partner({ slug: "hidden-co", listed: false });
  await offer(a, { title: "Live lab" });
  await offer(a, { title: "Draft", status: "draft" });
  await offer(a, { title: "Paused", status: "paused" });
  await offer(a, { title: "Ended", ends: ymd(-2) });
  await offer(a, { title: "Ends today", ends: ymd(0) });
  const dir = await d.query(S.PUBLIC_PARTNERS_SQL);
  assert.deepEqual(dir.map((r) => r.slug), ["a-lib"]);
  assert.equal(dir[0].live_offers, 2);
  assert.equal((await d.query(S.PUBLIC_PARTNER_SQL, ["hidden-co"])).length, 0);
  assert.deepEqual((await d.query(S.PARTNER_LIVE_OFFERS_SQL, [a])).map((r) => r.title).sort(), ["Ends today", "Live lab"]);
  await d.query(S.EXPIRE_OFFERS_SQL);
  assert.equal((await d.query("SELECT status FROM resource_offers WHERE title = 'Ended'"))[0].status, "expired");
  assert.equal((await d.query("SELECT status FROM resource_offers WHERE title = 'Ends today'"))[0].status, "published");
  // public SQL never selects emails
  for (const k of ["PUBLIC_PARTNERS_SQL", "PUBLIC_PARTNER_SQL", "PARTNER_LIVE_OFFERS_SQL", "ALL_LIVE_OFFERS_SQL", "VERIFY_BADGE_SQL", "MY_BADGES_SQL", "ADMIN_BADGES_SQL"]) {
    assert.ok(!/email/i.test(S[k]), `${k} must not select emails`);
  }
  await pg.close();
});

test("offer actions: publish, send back with note, pause, archive; can't publish past its end date", async () => {
  const { pg, d, partner, offer } = await fixture();
  const p = await partner();
  const o = await offer(p, { status: "pending" });
  const act = async (id, a, note = null) => (await d.query(S.OFFER_ACTION_SQL, [id, a, "admin1", note]))[0]?.status ?? null;
  assert.equal(await act(o, "pause"), null, "can't pause a pending offer");
  assert.equal(await act(o, "send_back", "Add the room number"), "draft");
  assert.equal((await d.query("SELECT review_note FROM resource_offers WHERE id::text = $1", [o]))[0].review_note, "Add the room number");
  assert.equal(await act(o, "submit"), "pending");
  assert.equal(await act(o, "publish"), "published");
  const row = (await d.query("SELECT review_note, approved_by FROM resource_offers WHERE id::text = $1", [o]))[0];
  assert.deepEqual([row.review_note, row.approved_by], [null, "admin1"]);
  assert.equal(await act(o, "pause"), "paused");
  assert.equal(await act(o, "archive"), "archived");
  assert.equal(await act(o, "archive"), null);
  const old = await offer(p, { status: "pending", ends: ymd(-1) });
  assert.equal(await act(old, "publish"), null, "past end date");
  await pg.close();
});

test("inquiries: insert, admin inbox, convert to a pending partner once, status changes, 12-month purge", async () => {
  const { pg, d } = await fixture();
  const id = (await d.query(S.INSERT_INQUIRY_SQL, ["IRSC", "Jo Doe", "jo@irsc.example.edu", "college", ["lab_access"], "We have a lab."]))[0].id;
  assert.equal((await d.query(S.ADMIN_INQUIRIES_SQL, ["open"])).length, 1);
  assert.equal((await d.query(S.INQUIRY_STATUS_SQL, [id, "contacted", "admin1", "Called Tue"]))[0].id, id);
  const [conv] = await d.query(S.CONVERT_INQUIRY_SQL, [id, "irsc", "admin1"]);
  assert.ok(conv.partner_id);
  const p = (await d.query("SELECT name, kind, status FROM partners WHERE id::text = $1", [conv.partner_id]))[0];
  assert.deepEqual([p.name, p.kind, p.status], ["IRSC", "college", "pending"]);
  assert.equal((await d.query(S.CONVERT_INQUIRY_SQL, [id, "irsc-2", "admin1"])).length, 0, "only once");
  assert.equal((await d.query("SELECT count(*)::int n FROM partners"))[0].n, 1);
  assert.equal((await d.query(S.INQUIRY_STATUS_SQL, [id, "spam", "admin1", null])).length, 0, "converted is final");
  const old = (await d.query(S.INSERT_INQUIRY_SQL, ["Old", "Spam Bot", "x@y.co", "other", [], null]))[0].id;
  await d.query("UPDATE partner_inquiries SET status = 'spam', created_at = now() - interval '13 months' WHERE id::text = $1", [old]);
  await d.query(S.PURGE_INQUIRIES_SQL);
  assert.equal((await d.query("SELECT count(*)::int n FROM partner_inquiries"))[0].n, 1);
  await pg.close();
});

test("badges: issued only for active participants, expire after the cohort's last day ET, verify shows minimal data", async () => {
  const { pg, d, app, cohort } = await fixture();
  const nonce = newNonce(), token = deriveToken(SECRET, nonce), hash = hashToken(token);
  assert.equal((await d.query(S.ISSUE_BADGE_SQL, [app, nonce, hash])).length, 0, "not accepted yet");
  await d.query(DECIDE_SQL, [app, "admin1", "accepted", null, null]);
  assert.equal((await d.query(S.ISSUE_BADGE_SQL, [app, nonce, hash])).length, 1);
  assert.equal((await d.query(S.ISSUE_BADGE_SQL, [app, newNonce(), hashToken("x".repeat(22))])).length, 0, "one per application");
  const [k] = await d.query("SELECT expires_at, token_hash FROM incubator_credentials");
  const ends = (await d.query("SELECT ends_on::text AS e FROM incubator_cohorts WHERE id::text = $1", [cohort]))[0].e;
  const expect = new Date(`${ends}T00:00:00-05:00`); expect.setUTCDate(expect.getUTCDate() + 1);
  assert.ok(Math.abs(new Date(k.expires_at).getTime() - expect.getTime()) <= 3600_000, "midnight ET after the last day (±DST)");
  assert.notEqual(k.token_hash, token, "raw token never stored");
  const [v] = await d.query(S.VERIFY_BADGE_SQL, [hash]);
  assert.ok(badgeIsValid(v));
  assert.equal(v.cohort_name, "C1");
  assert.equal(v.check_count, 1);
  assert.ok(!Object.keys(v).some((c) => /email|project|goal/.test(c)));
  assert.equal((await d.query(S.VERIFY_BADGE_SQL, [hashToken("unknown-token-xxxxxxx")])).length, 0);
  // participant leaves → invalid even before revocation; banned member → invalid
  await d.query(PARTICIPANT_SQL, [app, "left"]);
  assert.equal(badgeIsValid((await d.query(S.VERIFY_BADGE_SQL, [hash]))[0]), false);
  await d.query(PARTICIPANT_SQL, [app, "active"]);
  await d.query("UPDATE members SET status = 'banned' WHERE user_id = 'alice'");
  assert.equal(badgeIsValid((await d.query(S.VERIFY_BADGE_SQL, [hash]))[0]), false);
  await d.query("UPDATE members SET status = 'active' WHERE user_id = 'alice'");
  // rotate: old code dead, new one works
  const n2 = newNonce(), h2 = hashToken(deriveToken(SECRET, n2));
  const [mine] = await d.query(S.MY_BADGES_SQL, ["alice"]);
  assert.equal((await d.query(S.ROTATE_BADGE_SQL, ["bob", mine.id, n2, h2])).length, 0, "only the owner");
  assert.equal((await d.query(S.ROTATE_BADGE_SQL, ["alice", mine.id, n2, h2])).length, 1);
  assert.equal((await d.query(S.VERIFY_BADGE_SQL, [hash])).length, 0);
  assert.ok(badgeIsValid((await d.query(S.VERIFY_BADGE_SQL, [h2]))[0]));
  // revoke / reinstate (new code)
  await d.query(S.REVOKE_BADGE_SQL, [mine.id, "Shared with someone else", "admin1"]);
  assert.equal(badgeIsValid((await d.query(S.VERIFY_BADGE_SQL, [h2]))[0]), false);
  const n3 = newNonce(), h3 = hashToken(deriveToken(SECRET, n3));
  await d.query(S.REINSTATE_BADGE_SQL, [mine.id, n3, h3]);
  assert.equal((await d.query(S.VERIFY_BADGE_SQL, [h2])).length, 0, "old code stays dead");
  assert.ok(badgeIsValid((await d.query(S.VERIFY_BADGE_SQL, [h3]))[0]));
  // account deletion removes the badge
  await d.query("DELETE FROM projects WHERE user_id = 'alice'");
  await d.query("DELETE FROM members WHERE user_id = 'alice'");
  assert.equal((await d.query("SELECT count(*)::int n FROM incubator_credentials"))[0].n, 0);
  await pg.close();
});

test("participant cohorts and unbadged applications", async () => {
  const { pg, d, app, cohort } = await fixture();
  assert.equal((await d.query(S.PARTICIPANT_COHORTS_SQL, ["alice"])).length, 0);
  await d.query(DECIDE_SQL, [app, "admin1", "accepted", null, null]);
  assert.deepEqual((await d.query(S.PARTICIPANT_COHORTS_SQL, ["alice"])).map((r) => r.cohort_id), [cohort]);
  assert.deepEqual((await d.query(S.UNBADGED_APPLICATIONS_SQL, ["alice"])).map((r) => r.id), [app]);
  await d.query(S.ISSUE_BADGE_SQL, [app, newNonce(), hashToken("abc")]);
  assert.equal((await d.query(S.UNBADGED_APPLICATIONS_SQL, ["alice"])).length, 0);
  assert.equal(Number((await d.query(S.PARTNER_TODO_SQL))[0].n), 0);
  await pg.close();
});
