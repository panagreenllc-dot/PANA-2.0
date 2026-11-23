// Run: npm test. Migration 013 + the shipped P3-4 SQL (feed, events, member board, moderation, digest) on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import * as C from "../lib/community-sql.ts";

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
  for (const u of ["ana", "ben", "cal", "dee", "eve", "admin"]) {
    await d.query("INSERT INTO members (user_id, email, display_name, status, terms_accepted_at) VALUES ($1, $2, $3, 'active', now())", [u, `${u}@example.com`, `${u} Person`]);
  }
  const post = (u, o = {}) => d.query(C.POST_INSERT_SQL, [u, o.kind ?? "question", o.title ?? "How do I find testers?", o.body ?? "I have an MVP and need five people to try it.", o.limit ?? 5]).then((r) => r[0]);
  const reply = (p, u, body = "Happy to try it this week!", limit = 30) => d.query(C.REPLY_INSERT_SQL, [p, u, body, limit]).then((r) => r[0]);
  const approve = (id, type = "post") => d.query(type === "post" ? C.MODERATE_POST_SQL : C.MODERATE_REPLY_SQL, [id, "published", "admin", null, ["pending"]]);
  return { pg, d, post, reply, approve };
}

test("013 applies on top of 001-012: domino_* and existing tables unchanged except the optional cohort capacity and a wider report check", async () => {
  const { pg, d } = await db({ upTo: "012" });
  const shape = async () => JSON.stringify(await d.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name NOT IN ('community_posts', 'event_agenda_items', 'event_speakers', 'member_posts',
       'member_post_replies', 'community_digests', 'community_digest_recipients', 'schema_migrations')
       AND NOT (table_name = 'incubator_cohorts' AND column_name = 'capacity')
     ORDER BY table_name, column_name`));
  const cons = async () => JSON.stringify(await d.query(
    `SELECT conrelid::regclass::text AS t, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text NOT IN ('community_posts', 'event_agenda_items', 'event_speakers',
       'member_posts', 'member_post_replies', 'community_digests', 'community_digest_recipients')
       AND conname NOT IN ('reports_target_type_check') AND conname NOT LIKE 'incubator_cohorts_capacity%' ORDER BY 1, 2`));
  const idx = async () => JSON.stringify(await d.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename NOT IN ('community_posts', 'event_agenda_items',
       'event_speakers', 'member_posts', 'member_post_replies', 'community_digests', 'community_digest_recipients') ORDER BY 1, 2`));
  await d.query("INSERT INTO members (user_id, email, display_name, status) VALUES ('a', 'a@example.com', 'A', 'active'), ('b', 'b@example.com', 'B', 'active')");
  for (const t of ["profile", "idea", "request", "mentor_profile", "investor_interest"]) await d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('a', $1, 'b', 'spam')", [t]);
  // The production Cohort 1 row as it was before 013.
  await d.query(`INSERT INTO incubator_cohorts (id, name, slug, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on, announce_on, announce_note, capacity, created_by)
    VALUES ('7fe7aedf-2f8c-40c2-9f6a-9b91186c16d0', 'Cohort 1, Spring 2027', 'cohort-1-spring-2027', 'virtual', 'open', '2026-12-01T05:00:00Z', '2027-02-01T04:59:00Z',
            '2027-03-01', '2027-05-23', '2027-02-21', 'Accepted participants announced at Treasure Coast Tech Con', 10, 'owner-approved:2026-11-22'),
           (gen_random_uuid(), 'Other cohort', 'other', 'virtual', 'draft', NULL, NULL, NULL, NULL, '2027-02-21', 'Announced at Tech Con', 10, 'x')`);
  await d.query("INSERT INTO domino_badges (id, name, description, icon) VALUES ('t013', 'Test', 'Test badge', 'x') ON CONFLICT DO NOTHING").catch(() => {});
  const domino = async () => JSON.stringify(await d.query("SELECT table_name, (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM ' || table_name, false, true, '')))[1]::text AS n FROM information_schema.tables WHERE table_name LIKE 'domino_%' ORDER BY 1"));
  const before = [await shape(), await cons(), await idx(), await domino()];
  await runMigrations(d, loadMigrations(), { log: () => {} });
  assert.deepEqual([await shape(), await cons(), await idx(), await domino()], before);
  assert.equal((await d.query("SELECT count(*)::int AS n FROM reports"))[0].n, 5, "old reports still valid");
  const [cap] = await d.query("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'incubator_cohorts' AND column_name = 'capacity'");
  assert.deepEqual(cap, { is_nullable: "YES", column_default: null });
  const cohorts = await d.query("SELECT slug, capacity, announce_on::text AS announce_on, announce_note FROM incubator_cohorts ORDER BY slug");
  assert.deepEqual(cohorts, [
    { slug: "cohort-1-spring-2027", capacity: null, announce_on: "2027-02-26", announce_note: null },
    { slug: "other", capacity: 10, announce_on: "2027-02-21", announce_note: "Announced at Tech Con" },
  ], "only Cohort 1 is changed");
  await assert.rejects(d.query("UPDATE incubator_cohorts SET capacity = 0 WHERE slug = 'other'"), "1-500 rule still applies when set");
  const [tc] = await d.query(C.TECHCON_SQL);
  assert.equal(tc.slug, "treasure-coast-tech-con-2027");
  assert.equal(new Date(tc.starts_at).toISOString(), "2027-05-30T14:30:00.000Z");
  assert.equal(new Date(tc.ends_at).toISOString(), "2027-05-30T21:00:00.000Z");
  assert.deepEqual([tc.price_text, tc.registration_url, tc.registration_note], ["To be announced", null, "Registration opens soon"]);
  assert.deepEqual(await d.query(C.SPEAKERS_SQL, [tc.id]), [{ name: "Professor Joseph Ali", role: "Keiser University · Guest speaker" }]);
  await d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('a', 'member_post', 'x', 'spam')");
  await assert.rejects(d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('b', 'bogus', 'x', 'spam')"));
  assert.deepEqual(await runMigrations(d, loadMigrations(), { log: () => {} }), [], "idempotent");
  const cols = (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name IN ('member_posts','member_post_replies','community_posts','community_digests')")).map((r) => r.column_name);
  assert.ok(!cols.some((c) => /email|phone|amount|dollar/.test(c)), "no contact or money columns");
  await pg.close();
});

test("013 data change is guarded: an admin-edited Cohort 1 is left alone", async () => {
  const { pg, d } = await db({ upTo: "012" });
  await d.query(`INSERT INTO incubator_cohorts (name, slug, format, status, announce_on, announce_note, capacity, created_by)
    VALUES ('Cohort 1', 'cohort-1-spring-2027', 'virtual', 'draft', '2027-02-20', 'Emailed by Feb 20', 25, 'x')`);
  await runMigrations(d, loadMigrations(), { log: () => {} });
  assert.deepEqual(await d.query("SELECT capacity, announce_on::text AS a, announce_note FROM incubator_cohorts"), [{ capacity: 25, a: "2027-02-20", announce_note: "Emailed by Feb 20" }]);
  await pg.close();
});

test("board: first contribution waits for review, later ones publish; daily limits; replies only on visible posts", async () => {
  const { pg, d, post, reply, approve } = await fixture();
  const p1 = await post("ana");
  assert.equal(p1.status, "pending");
  assert.equal((await d.query(C.BOARD_SQL, [null, 20, 0])).length, 0, "pending posts aren't on the board");
  assert.equal((await d.query(C.POST_ONE_SQL, [p1.id, "ana", false])).length, 1, "the author sees their own pending post");
  assert.equal((await d.query(C.POST_ONE_SQL, [p1.id, "ben", false])).length, 0, "others don't");
  assert.equal((await d.query(C.POST_ONE_SQL, [p1.id, "admin", true])).length, 1, "John does");
  assert.equal(await reply(p1.id, "ben"), undefined, "no replies on a pending post");
  await approve(p1.id);
  assert.equal((await d.query(C.TRUSTED_SQL, ["ana"]))[0].trusted, true);
  const p2 = await post("ana", { kind: "win", title: "We shipped the beta" });
  assert.equal(p2.status, "published", "trusted after one approval");
  const r1 = await reply(p1.id, "ben");
  assert.equal(r1.status, "pending", "ben's first reply waits too");
  assert.equal((await d.query(C.REPLIES_SQL, [p1.id, "cal", false])).length, 0);
  assert.equal((await d.query(C.REPLIES_SQL, [p1.id, "ben", false])).length, 1, "ben sees his own pending reply");
  await approve(r1.id, "reply");
  assert.equal((await d.query(C.TRUSTED_SQL, ["ben"]))[0].trusted, true, "an approved reply also counts");
  const r2 = await reply(p1.id, "ana", "Thanks Ben!");
  assert.equal(r2.status, "published");
  const board = await d.query(C.BOARD_SQL, [null, 20, 0]);
  assert.deepEqual(board.map((b) => [b.title, b.reply_count]), [["How do I find testers?", 2], ["We shipped the beta", 0]], "a published reply bumps the post");
  assert.equal(board[0].total, 2);
  assert.deepEqual((await d.query(C.BOARD_SQL, ["win", 20, 0])).map((b) => b.title), ["We shipped the beta"]);
  assert.ok(!JSON.stringify(board).includes("@example.com"), "never an email");
  for (let i = 0; i < 3; i++) assert.ok(await post("ana", { title: `Post number ${i}` }));
  assert.equal(await post("ana", { title: "Sixth today" }), undefined, "5 posts a day");
  assert.equal(await reply(p1.id, "cal", "x".repeat(10), 0), undefined, "reply limit");
  await d.query("UPDATE members SET status = 'banned' WHERE user_id = 'dee'");
  assert.equal(await post("dee"), undefined, "inactive members can't post");
  await assert.rejects(post("cal", { title: "Hi" }), "title length is enforced in the database too");
  await assert.rejects(post("cal", { kind: "ad" }));
  await pg.close();
});

test("moderation: decline, remove, restore are re-checked in SQL; reports auto-hide at 3 and John's review clears them", async () => {
  const { pg, d, post, reply, approve } = await fixture();
  const p = await post("ana");
  assert.equal((await d.query(C.ADMIN_QUEUE_SQL)).length, 1);
  assert.equal((await d.query(C.ADMIN_QUEUE_COUNT_SQL))[0].n, 1);
  assert.equal((await d.query(C.MODERATE_POST_SQL, [p.id, "removed", "admin", "x", ["removed", "declined"]])).length, 0, "allowed statuses are checked");
  await approve(p.id);
  assert.equal((await d.query(C.ADMIN_QUEUE_SQL)).length, 0);
  const r = await reply(p.id, "ana", "Bump: still looking!");
  assert.equal(r.status, "published");
  for (const u of ["ben", "cal"]) await d.query(C.REPORT_INSERT_SQL, [u, "member_post", p.id, "spam", null]);
  assert.equal((await d.query(C.REPORT_INSERT_SQL, ["ben", "member_post", p.id, "spam", null])).length, 0, "one report per reporter");
  assert.equal((await d.query(C.AUTO_HIDE_POST_SQL, [p.id, 3])).length, 0, "two reports aren't enough");
  const q1 = await d.query(C.ADMIN_QUEUE_SQL);
  assert.deepEqual(q1.map((x) => [x.type, x.open_reports]), [["post", 2]], "reported items show in John's queue");
  await d.query(C.REPORT_INSERT_SQL, ["dee", "member_post", p.id, "scam", "asks for money"]);
  assert.equal((await d.query(C.AUTO_HIDE_POST_SQL, [p.id, 3])).length, 1);
  assert.equal((await d.query(C.BOARD_SQL, [null, 20, 0])).length, 0, "hidden from the board");
  assert.equal((await d.query(C.POST_ONE_SQL, [p.id, "ben", false])).length, 0);
  assert.equal(await reply(p.id, "ben"), undefined, "no replies while hidden");
  assert.equal((await d.query(C.ADMIN_QUEUE_COUNT_SQL))[0].n, 1);
  // John keeps it: back on the board, reports dismissed.
  await d.query(C.MODERATE_POST_SQL, [p.id, "published", "admin", null, ["published"]]);
  await d.query(C.RESOLVE_REPORTS_SQL, ["member_post", p.id, "admin", "dismissed"]);
  assert.equal((await d.query(C.BOARD_SQL, [null, 20, 0])).length, 1);
  assert.equal((await d.query(C.ADMIN_QUEUE_SQL)).length, 0);
  // John removes it, then restores it.
  assert.equal((await d.query(C.MODERATE_POST_SQL, [p.id, "removed", "admin", "Off topic", ["published", "pending"]]))[0].status, "removed");
  assert.equal((await d.query(C.BOARD_SQL, [null, 20, 0])).length, 0);
  assert.equal((await d.query(C.MY_POSTS_SQL, ["ana"])).length, 0, "removed posts leave the author's list");
  await d.query(C.MODERATE_POST_SQL, [p.id, "published", "admin", null, ["removed", "declined"]]);
  // Reply reports.
  for (const u of ["ben", "cal", "dee"]) await d.query(C.REPORT_INSERT_SQL, [u, "member_reply", r.id, "inappropriate", null]);
  assert.equal((await d.query(C.AUTO_HIDE_REPLY_SQL, [r.id, 3])).length, 1);
  assert.equal((await d.query(C.REPLIES_SQL, [p.id, "ben", false])).length, 0);
  assert.equal((await d.query(C.REPLIES_SQL, [p.id, "ana", false])).length, 0, "a hidden published reply is hidden from its author too");
  assert.equal((await d.query(C.REPLIES_SQL, [p.id, "admin", true])).length, 1);
  // Authors can delete their own content only.
  assert.equal((await d.query(C.DELETE_OWN_REPLY_SQL, [r.id, "ben"])).length, 0);
  assert.equal((await d.query(C.DELETE_OWN_REPLY_SQL, [r.id, "ana"])).length, 1);
  assert.equal((await d.query(C.DELETE_OWN_POST_SQL, [p.id, "ben"])).length, 0);
  assert.equal((await d.query(C.DELETE_OWN_POST_SQL, [p.id, "ana"])).length, 1);
  await pg.close();
});

test("deleting an account removes the member's posts, replies and digest history", async () => {
  const { pg, d, post, reply, approve } = await fixture();
  const p = await post("ana"); await approve(p.id);
  const r = await reply(p.id, "ben"); await approve(r.id, "reply");
  const pb = await post("ben");
  await d.query("UPDATE members SET email_prefs = email_prefs || '{\"community_digest\": true}' WHERE user_id = 'ben'");
  const [tc] = await d.query(C.TECHCON_SQL);
  const [dg] = await d.query(C.DIGEST_CREATE_SQL, ["admin", [tc.id]]);
  await d.query(C.DIGEST_MARK_SQL, [dg.id, ["ben"]]);
  await d.query("DELETE FROM members WHERE user_id = 'ben'");
  assert.equal((await d.query("SELECT count(*)::int AS n FROM member_post_replies"))[0].n, 0);
  assert.equal((await d.query("SELECT count(*)::int AS n FROM member_posts WHERE id = $1::uuid", [pb.id]))[0].n, 0);
  assert.equal((await d.query("SELECT count(*)::int AS n FROM community_digest_recipients"))[0].n, 0);
  assert.equal((await d.query("SELECT count(*)::int AS n FROM member_posts"))[0].n, 1, "ana's post stays");
  await pg.close();
});

test("feed: drafts hidden, members-only gated, events upcoming only, slugs unique, agenda/speakers replaced, Tech Con picks the next one", async () => {
  const { pg, d } = await fixture();
  const ins = (o) => d.query(C.FEED_INSERT_SQL, [o.kind ?? "announcement", o.title ?? "Welcome to PANA", o.slug, o.body ?? "Hello", o.program ?? "community",
    o.audience ?? "public", o.pinned ?? false, o.starts ?? null, o.ends ?? null, null, null, false, o.url ?? null, null, null, "admin"]).then((r) => r[0]);
  const a = await ins({ slug: "welcome" });
  assert.equal(await ins({ slug: "welcome" }), undefined, "slug taken");
  const m = await ins({ slug: "members-note", audience: "members" });
  const past = await ins({ slug: "old-meetup", kind: "event", starts: "2020-01-01T15:00:00Z" });
  const soon = await ins({ slug: "build-night", kind: "event", starts: new Date(Date.now() + 86_400_000).toISOString() });
  await assert.rejects(ins({ slug: "no-time", kind: "event" }), "events need a start");
  await assert.rejects(ins({ slug: "bad-url", url: "javascript:alert(1)" }));
  await assert.rejects(ins({ slug: "Bad Slug" }));
  assert.equal((await d.query(C.ANNOUNCEMENTS_SQL, [true])).length, 0, "drafts aren't shown");
  for (const p of [a, m, past, soon]) await d.query(C.FEED_STATUS_SQL, [p.id, "published"]);
  assert.deepEqual((await d.query(C.ANNOUNCEMENTS_SQL, [false])).map((r) => r.slug), ["welcome"]);
  assert.deepEqual((await d.query(C.ANNOUNCEMENTS_SQL, [true])).map((r) => r.slug).sort(), ["members-note", "welcome"]);
  assert.equal((await d.query(C.POST_BY_SLUG_SQL, [false, "members-note"])).length, 0);
  assert.equal((await d.query(C.POST_BY_SLUG_SQL, [true, "members-note"])).length, 1);
  assert.deepEqual((await d.query(C.UPCOMING_EVENTS_SQL, [false])).map((r) => r.slug), ["treasure-coast-tech-con-2027", "build-night"], "pinned Tech Con first, past events dropped");
  const [first] = await d.query(C.FEED_STATUS_SQL, [a.id, "published"]);
  assert.equal(first.status, "published");
  assert.equal((await d.query(C.FEED_UPDATE_SQL, [a.id, "announcement", "Welcome", "build-night", "", "community", "public", false, null, null, null, null, false, null, null, null])).length, 0, "can't steal a slug");
  await d.query(C.AGENDA_REPLACE_SQL, [soon.id, ["6:00 PM", "7:00 PM"], ["Doors", "Demos"]]);
  await d.query(C.AGENDA_REPLACE_SQL, [soon.id, ["6:30 PM"], ["Doors"]]);
  assert.deepEqual(await d.query(C.AGENDA_SQL, [soon.id]), [{ time_label: "6:30 PM", title: "Doors" }]);
  await d.query(C.SPEAKERS_REPLACE_SQL, [soon.id, [], []]);
  assert.deepEqual(await d.query(C.SPEAKERS_SQL, [soon.id]), []);
  // A later Tech Con doesn't replace the next one.
  const next = await ins({ slug: "tech-con-2028", kind: "event", program: "techcon", starts: "2028-05-20T14:00:00Z" });
  await d.query(C.FEED_STATUS_SQL, [next.id, "published"]);
  assert.equal((await d.query(C.TECHCON_SQL))[0].slug, "treasure-coast-tech-con-2027");
  assert.equal((await d.query(C.FEED_DELETE_SQL, [a.id])).length, 0, "only drafts can be deleted");
  await pg.close();
});

test("digest: only opted-in active members, batches never repeat, emails only in the send query", async () => {
  const { pg, d } = await fixture();
  for (const u of ["ana", "ben", "cal"]) await d.query("UPDATE members SET email_prefs = email_prefs || '{\"community_digest\": true}' WHERE user_id = $1", [u]);
  await d.query("UPDATE members SET status = 'banned' WHERE user_id = 'cal'");
  assert.equal((await d.query(C.DIGEST_AUDIENCE_SQL))[0].n, 2);
  const cands = await d.query(C.DIGEST_CANDIDATES_SQL, [null, 20]);
  assert.deepEqual(cands.map((c) => c.slug), ["treasure-coast-tech-con-2027"]);
  assert.equal((await d.query(C.LAST_DIGEST_SQL)).length, 0);
  const [dg] = await d.query(C.DIGEST_CREATE_SQL, ["admin", cands.map((c) => c.id)]);
  const t1 = await d.query(C.DIGEST_TARGETS_SQL, [dg.id, 1]);
  assert.equal(t1.length, 1);
  assert.equal((await d.query(C.DIGEST_MARK_SQL, [dg.id, t1.map((t) => t.user_id)]))[0].n, 1);
  let last = (await d.query(C.LAST_DIGEST_SQL))[0];
  assert.deepEqual([last.sent, last.remaining], [1, 1]);
  const t2 = await d.query(C.DIGEST_TARGETS_SQL, [dg.id, 90]);
  assert.equal(t2.length, 1); assert.notEqual(t2[0].user_id, t1[0].user_id);
  await d.query(C.DIGEST_MARK_SQL, [dg.id, t2.map((t) => t.user_id)]);
  last = (await d.query(C.LAST_DIGEST_SQL))[0];
  assert.deepEqual([last.sent, last.remaining], [2, 0]);
  assert.equal((await d.query(C.DIGEST_TARGETS_SQL, [dg.id, 90])).length, 0);
  assert.deepEqual((await d.query(C.DIGEST_POSTS_SQL, [last.post_ids])).map((p) => p.slug), ["treasure-coast-tech-con-2027"]);
  for (const s of [C.LAST_DIGEST_SQL, C.DIGEST_AUDIENCE_SQL]) assert.ok(!JSON.stringify(await d.query(s)).includes("@example.com"));
  await assert.rejects(d.query(C.DIGEST_CREATE_SQL, ["admin", []]), "a digest needs at least one post");
  await pg.close();
});
