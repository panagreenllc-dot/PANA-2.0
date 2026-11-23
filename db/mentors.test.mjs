// Run: npm test. Migration 012 + the shipped P3-3 SQL (mentor/investor roles, mentorship requests, investor interest) on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import * as M from "../lib/mentors-sql.ts";
import * as Q from "../lib/requests-sql.ts";
import { BROWSE_SQL } from "../lib/idea-sql.ts";

async function db({ upTo } = {}) {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  const all = loadMigrations();
  await runMigrations(d, upTo ? all.filter((m) => m.version <= upTo) : all, { log: () => {} });
  return { pg, d };
}

const BIO = "I have launched two apps and can help with planning.";

async function fixture() {
  const { pg, d } = await db();
  for (const u of ["mentor", "mentee", "m2", "owner", "inv", "inv2", "admin"]) {
    await d.query("INSERT INTO members (user_id, email, display_name, status, terms_accepted_at) VALUES ($1, $2, $3, 'active', now())", [u, `${u}@example.com`, `${u} Person`]);
  }
  const idea = async (o = {}) => (await d.query(
    `INSERT INTO projects (user_id, name, project_name, category, description, status, audience, hidden_by_reports, investor_interest_open)
     VALUES ($1, 'Owner', $2, 'AI', 'A useful description for testing.', $3, $4, $5, $6) RETURNING id::text AS id`,
    [o.user ?? "owner", o.name ?? "Idea", o.status ?? "approved", o.audience ?? "public", o.hidden ?? false, o.open ?? true]))[0].id;
  const mentor = async (u = "mentor", o = {}) => {
    await d.query(M.MENTOR_UPSERT_SQL, [u, o.expertise ?? ["product"], BIO, "2 hrs/month", o.max ?? 3, "pending"]);
    if (o.approve !== false) await d.query(M.MENTOR_DECIDE_SQL, [u, "approved", "admin", null, ["pending"]]);
  };
  const investor = async (u = "inv", o = {}) => {
    await d.query(M.INVESTOR_UPSERT_SQL, [u, "angel", ["AI"], ["concept"], null, BIO, "pending"]);
    if (o.approve !== false) await d.query(M.INVESTOR_DECIDE_SQL, [u, "approved", "admin", null, ["pending"]]);
  };
  return { pg, d, idea, mentor, investor };
}

test("012 is additive: applies on top of 001-011, leaves domino_* and existing tables as they were (plus one defaulted column and a wider report check)", async () => {
  const { pg, d } = await db({ upTo: "011" });
  const shape = async () => JSON.stringify(await d.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND (table_name LIKE 'domino_%' OR table_name IN ('members', 'reports', 'collaboration_requests', 'profiles',
       'resource_offers', 'incubator_cohorts', 'incubator_applications', 'incubator_credentials', 'partners', 'partner_contacts',
       'project_needs', 'help_offers', 'offer_requests', 'admin_audit_log'))
     ORDER BY table_name, column_name`));
  const cons = async () => JSON.stringify(await d.query(
    `SELECT conrelid::regclass::text AS t, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE (conrelid::regclass::text LIKE 'domino_%' OR conrelid::regclass::text IN ('members', 'projects', 'reports', 'collaboration_requests', 'partners', 'help_offers'))
       AND conname NOT IN ('reports_target_type_check', 'projects_investor_interest_open_not_null') ORDER BY 1, 2`));
  const idx = async () => JSON.stringify(await d.query(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND (tablename LIKE 'domino_%' OR tablename IN ('projects', 'reports', 'members')) ORDER BY 1, 2`));
  const projectCols = async () => (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects' ORDER BY 1")).map((r) => r.column_name);
  // Existing rows of every old report type must still pass the widened rule.
  await d.query("INSERT INTO members (user_id, email, display_name, status) VALUES ('a', 'a@example.com', 'A', 'active'), ('b', 'b@example.com', 'B', 'active')");
  for (const t of ["profile", "idea", "request"]) await d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('a', $1, 'b', 'spam')", [t]);
  const before = [await shape(), await cons(), await idx()];
  const pBefore = await projectCols();
  await runMigrations(d, loadMigrations().filter((m) => m.version <= "012"), { log: () => {} });
  assert.deepEqual([await shape(), await cons(), await idx()], before);
  assert.deepEqual((await projectCols()).filter((c) => c !== "investor_interest_open"), pBefore);
  const [col] = await d.query("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'investor_interest_open'");
  assert.deepEqual(col, { is_nullable: "NO", column_default: "false" });
  assert.equal((await d.query("SELECT count(*)::int AS n FROM reports"))[0].n, 3);
  const tables = (await d.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('mentor_profiles','investor_profiles','mentorship_requests','investor_interests') ORDER BY 1")).map((r) => r.table_name);
  assert.deepEqual(tables, ["investor_interests", "investor_profiles", "mentor_profiles", "mentorship_requests"]);
  assert.deepEqual(await runMigrations(d, loadMigrations().filter((m) => m.version <= "012"), { log: () => {} }), [], "idempotent");
  const cols = (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name IN ('mentor_profiles','investor_profiles','mentorship_requests','investor_interests')")).map((r) => r.column_name);
  assert.ok(!cols.filter((c) => c !== "intro_email_id").some((c) => /email|phone|amount|check_size|accredit|price|dollar/.test(c)), "no contact or money columns");
  await d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('a', 'mentor_profile', 'b', 'spam')");
  await assert.rejects(d.query("INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ('a', 'bogus', 'b', 'spam')"));
  await pg.close();
});

test("roles: apply → pending; admin decisions re-checked in SQL; revoked rows can't be self-edited or deleted; pause/resume", async () => {
  const { pg, d, mentor } = await fixture();
  await mentor("mentor", { approve: false });
  assert.equal((await d.query(M.MY_MENTOR_SQL, ["mentor"]))[0].status, "pending");
  assert.equal((await d.query(M.MENTOR_DECIDE_SQL, ["mentor", "revoked", "admin", "x", ["approved", "paused"]])).length, 0, "can't revoke a pending one");
  assert.equal((await d.query(M.MENTOR_DECIDE_SQL, ["mentor", "approved", "admin", null, ["pending"]])).length, 1);
  const [row] = await d.query("SELECT approved_by, approved_at FROM mentor_profiles WHERE user_id = 'mentor'");
  assert.equal(row.approved_by, "admin"); assert.ok(row.approved_at);
  assert.deepEqual((await d.query(M.BADGES_SQL, ["mentor"]))[0], { mentor: true, investor: false });
  assert.equal((await d.query(M.MENTOR_PAUSE_SQL, ["mentor", "pause"]))[0].status, "paused");
  assert.equal((await d.query(M.DIRECTORY_SQL, [null])).length, 0, "paused mentors are hidden");
  assert.equal((await d.query(M.MENTOR_PAUSE_SQL, ["mentor", "resume"]))[0].status, "approved");
  assert.equal((await d.query(M.DIRECTORY_SQL, [null])).length, 1);
  assert.equal((await d.query(M.DIRECTORY_SQL, ["software"])).length, 0, "expertise filter");
  await d.query(M.MENTOR_DECIDE_SQL, ["mentor", "revoked", "admin", "conduct", ["approved", "paused"]]);
  assert.equal((await d.query(M.MENTOR_UPSERT_SQL, ["mentor", ["product"], BIO, null, 3, "pending"])).length, 0, "revoked stays revoked");
  assert.equal((await d.query(M.MENTOR_DELETE_SQL, ["mentor"])).length, 0);
  assert.equal((await d.query(M.ADMIN_DECIDED_SQL)).length, 1);
  await assert.rejects(d.query(M.MENTOR_UPSERT_SQL, ["m2", [], BIO, null, 3, "pending"]), "needs expertise");
  await assert.rejects(d.query(M.MENTOR_UPSERT_SQL, ["m2", ["product"], "short", null, 3, "pending"]), "bio length");
  await pg.close();
});

test("directory: approved, active, not hidden; never selects an email", async () => {
  const { pg, d, mentor } = await fixture();
  await mentor("mentor"); await mentor("m2");
  await d.query("UPDATE members SET status = 'deleted' WHERE user_id = 'm2'");
  await d.query("INSERT INTO profiles (user_id, display_name, is_published, moderation) VALUES ('mentor', 'Pat Mentor', true, 'ok')");
  const rows = await d.query(M.DIRECTORY_SQL, [null]);
  assert.deepEqual(rows.map((r) => [r.user_id, r.name, r.profile_visible]), [["mentor", "Pat Mentor", true]]);
  assert.ok(!JSON.stringify(rows).includes("@example.com"));
  await d.query("UPDATE profiles SET moderation = 'hidden' WHERE user_id = 'mentor'");
  assert.equal((await d.query(M.DIRECTORY_SQL, [null])).length, 0, "a hidden profile hides the mentor");
  for (const s of [M.ADMIN_PENDING_SQL, M.ADMIN_DECIDED_SQL]) assert.ok(!JSON.stringify(await d.query(s)).includes("@example.com"));
  await pg.close();
});

test("mentorship: only approved mentors, not yourself, one open per pair, capacity, accept → intro parties; lists never carry emails", async () => {
  const { pg, d, mentor, idea } = await fixture();
  await mentor("mentor", { max: 2 });
  await mentor("m2", { approve: false });
  const mine = await idea({ user: "mentee", name: "Mentee idea" });
  const send = (from, to, p = null) => d.query(Q.MENTORSHIP_INSERT_SQL, [to, from, "Could you help me plan my first launch?", p]);
  assert.equal((await send("mentee", "m2")).length, 0, "pending mentors can't be requested");
  assert.equal((await send("mentor", "mentor")).length, 0, "not yourself");
  const [r] = await send("mentee", "mentor", mine);
  assert.ok(r);
  assert.equal((await send("mentee", "mentor")).length, 0, "one open request per pair");
  assert.equal((await d.query(Q.HAS_OPEN_SQL.mentorship, ["mentor", "mentee"])).length, 1);
  const [other] = await send("owner", "mentor");
  assert.ok(other);
  assert.equal((await send("inv", "mentor")).length, 0, "capacity: max 2 open mentees");
  const ownIdeaOnly = await d.query("SELECT project_id FROM mentorship_requests WHERE id::text = $1", [other.id]);
  assert.equal(ownIdeaOnly[0].project_id, null);
  const list = await d.query(Q.LIST_SQL.mentorship, ["mentor"]);
  assert.equal(list.length, 2);
  assert.ok(!JSON.stringify(list).includes("@example.com"));
  const one = (await d.query(Q.ONE_SQL.mentorship, [r.id]))[0];
  assert.deepEqual([one.requester, one.responders, one.context], ["mentee", ["mentor"], "Mentee idea"]);
  assert.equal((await d.query(Q.RESPOND_SQL.mentorship, [r.id, "mentee", "accepted", false])).length, 0, "the mentee can't accept");
  assert.equal((await d.query(Q.RESPOND_SQL.mentorship, [r.id, "mentor", "accepted", false])).length, 1);
  const [p] = await d.query(Q.PARTIES_SQL.mentorship, [r.id]);
  assert.deepEqual([p.requester_email, p.responder_email, p.notify_emails], ["mentee@example.com", "mentor@example.com", ["mentor@example.com"]]);
  await d.query(Q.INTRO_RESULT_SQL.mentorship, [r.id, true, "em_1", null]);
  assert.ok((await d.query(Q.ONE_SQL.mentorship, [r.id]))[0].intro_sent_at);
  assert.equal((await d.query(Q.WITHDRAW_SQL.mentorship, [other.id, "owner"])).length, 1);
  assert.equal(Number((await d.query(Q.SENT_LAST_DAY_KIND_SQL.mentorship, ["mentee"]))[0].n), 1);
  assert.equal(Number((await d.query(Q.SENT_LAST_DAY_ALL_SQL, ["mentee"]))[0].n), 1);
  await d.query("UPDATE mentorship_requests SET created_at = now() - interval '31 days', status = 'pending' WHERE id::text = $1", [other.id]);
  for (const s of Q.EXPIRE_ALL_SQL) await d.query(s);
  assert.equal((await d.query(Q.ONE_SQL.mentorship, [other.id]))[0].status, "expired");
  await pg.close();
});

test("investor interest: approved investors only, only ideas opted in and live, never own idea, owner answers", async () => {
  const { pg, d, investor, idea } = await fixture();
  await investor("inv"); await investor("inv2", { approve: false });
  const open = await idea({ name: "Open idea" });
  const closed = await idea({ name: "Closed idea", open: false });
  const hidden = await idea({ name: "Hidden idea", hidden: true });
  const membersOnly = await idea({ name: "Members idea", audience: "members" });
  const pending = await idea({ name: "Pending idea", status: "pending" });
  const own = await idea({ user: "inv", name: "Investor's own" });
  const send = (from, p) => d.query(Q.INVESTOR_INSERT_SQL, [p, from, "We support early AI projects and would like to learn more."]);
  assert.equal((await send("inv2", open)).length, 0, "pending investors can't send");
  assert.equal((await send("mentee", open)).length, 0, "ordinary members can't send");
  for (const p of [closed, hidden, pending, own]) assert.equal((await send("inv", p)).length, 0);
  assert.equal((await send("inv", membersOnly)).length, 1, "members-only ideas are fine (investors are members)");
  const [r] = await send("inv", open);
  assert.ok(r);
  assert.equal((await send("inv", open)).length, 0, "one open interest per idea");
  const [row] = await d.query("SELECT owner_user_id FROM investor_interests WHERE id::text = $1", [r.id]);
  assert.equal(row.owner_user_id, "owner");
  const one = (await d.query(Q.ONE_SQL.investor, [r.id]))[0];
  assert.deepEqual([one.requester, one.responders, one.subject_title, one.context], ["inv", ["owner"], "Open idea", "angel"]);
  assert.ok(!JSON.stringify(await d.query(Q.LIST_SQL.investor, ["owner"])).includes("@example.com"));
  assert.equal((await d.query(Q.RESPOND_SQL.investor, [r.id, "inv", "accepted", false])).length, 0);
  assert.equal((await d.query(Q.RESPOND_SQL.investor, [r.id, "owner", "declined", false])).length, 1);
  assert.equal((await d.query(Q.RESPOND_SQL.investor, [r.id, "owner", "accepted", false])).length, 0, "already answered");
  // Owner switch: only the owner can change it.
  assert.equal((await d.query(M.SET_INVESTOR_OPEN_SQL, [open, "inv", false])).length, 0);
  assert.equal((await d.query(M.SET_INVESTOR_OPEN_SQL, [open, "owner", false]))[0].investor_interest_open, false);
  assert.equal((await send("inv", open)).length, 0, "closed again");
  // Browse filter.
  await d.query(M.SET_INVESTOR_OPEN_SQL, [open, "owner", true]);
  const names = (await d.query(BROWSE_SQL, [true, null, null, null, null, "", "%%", 24, 0, false, true])).map((x) => x.project_name).sort();
  assert.deepEqual(names, ["Investor's own", "Members idea", "Open idea"]);
  assert.equal((await d.query(BROWSE_SQL, [true, null, null, null, null, "", "%%", 24, 0, false, false])).length, 4, "filter off: all live visible ideas");
  // Deleting the idea removes its interests; deleting a member removes their roles.
  await d.query("DELETE FROM projects WHERE id::text = $1", [open]);
  assert.equal((await d.query("SELECT count(*)::int AS n FROM investor_interests WHERE project_id::text = $1", [open]))[0].n, 0);
  await d.query("DELETE FROM members WHERE user_id = 'inv'");
  assert.equal((await d.query("SELECT count(*)::int AS n FROM investor_profiles WHERE user_id = 'inv'"))[0].n, 0);
  await pg.close();
});

test("reports on mentors: not yourself, one per reporter", async () => {
  const { pg, d, mentor } = await fixture();
  await mentor("mentor");
  assert.equal((await d.query(M.ROLE_REPORT_INSERT_SQL, ["mentor", "mentor_profile", "mentor", "spam", null])).length, 0);
  assert.equal((await d.query(M.ROLE_REPORT_INSERT_SQL, ["mentee", "mentor_profile", "mentor", "spam", null])).length, 1);
  assert.equal((await d.query(M.ROLE_REPORT_INSERT_SQL, ["mentee", "mentor_profile", "mentor", "spam", null])).length, 0);
  await pg.close();
});
