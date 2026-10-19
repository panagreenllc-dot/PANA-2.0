// Run: npm test. Exercises the shipped idea/collaboration SQL (lib/idea-sql.ts) on PGlite after all migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import { BROWSE_SQL, EXPIRE_SQL, IDEA_AUTO_HIDE_SQL, IDEA_REPORT_INSERT_SQL, REQUEST_INSERT_SQL, RESPOND_SQL, SENT_LAST_DAY_SQL, WITHDRAW_SQL } from "../lib/idea-sql.ts";

async function db() {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  // a legacy row with a copied email, to check 007 blanks it
  await d.query("INSERT INTO projects (name, email, project_name, category, description, status) VALUES ('L', 'legacy@example.com', 'Legacy', 'AI', 'legacy desc', 'approved')");
  await runMigrations(d, loadMigrations(), { log: () => {} });
  for (const u of ["owner", "q1", "q2", "q3"]) await d.query("INSERT INTO members (user_id, email, status) VALUES ($1, $2, 'active')", [u, `${u}@example.com`]);
  const idea = async (o = {}) => (await d.query(
    `INSERT INTO projects (user_id, name, project_name, category, description, details, help_needed, status, audience, field_visibility)
     VALUES ('owner', 'Owner', $1, 'AI', 'A useful description for testing.', $2, $3, $4, $5, $6) RETURNING id::text AS id`,
    [o.name ?? "Idea", o.details ?? null, o.help ?? [], o.status ?? "approved", o.audience ?? "public", JSON.stringify(o.vis ?? {})]))[0].id;
  return { pg, d, idea };
}
const browse = (d, gated, { help = null, q = "" } = {}) =>
  d.query(BROWSE_SQL, [gated, null, null, null, help, q, `%${q}%`, 24, 0]);

test("migrations 006/007 apply: legacy emails blanked, new columns exist", async () => {
  const { pg, d } = await db();
  assert.equal((await d.query("SELECT count(*)::int n FROM projects WHERE email IS NOT NULL"))[0].n, 0);
  const cols = (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'collaboration_requests'")).map((r) => r.column_name);
  for (const c of ["intro_sent_at", "intro_email_id", "intro_error", "owner_notified_at"]) assert.ok(cols.includes(c), c);
  await pg.close();
});

test("browse respects status, audience, hidden, and per-field visibility; never returns email", async () => {
  const { pg, d, idea } = await db();
  await idea({ name: "Pub", details: "secret sauce", help: ["developer"], vis: { help_needed: "members" } });
  await idea({ name: "Members", audience: "members" });
  await idea({ name: "Pending", status: "pending" });
  const hidden = await idea({ name: "Hidden" });
  await d.query("UPDATE projects SET hidden_by_reports = true WHERE id::text = $1", [hidden]);
  const names = async (g, o) => (await browse(d, g, o)).map((r) => r.project_name).sort();
  assert.deepEqual(await names(false), ["Legacy", "Pub"]);
  assert.deepEqual(await names(true), ["Legacy", "Members", "Pub"]);
  assert.deepEqual(await names(false, { q: "sauce" }), [], "members-only details not searchable by anon");
  assert.deepEqual(await names(true, { q: "sauce" }), ["Pub"]);
  assert.deepEqual(await names(false, { help: "developer" }), [], "members-only help filter hidden from anon");
  assert.deepEqual(await names(true, { help: "developer" }), ["Pub"]);
  for (const r of await browse(d, true)) assert.ok(!("email" in r) && !JSON.stringify(r).includes("@example.com"));
  await pg.close();
});

test("three distinct idea reports auto-hide; duplicates don't count", async () => {
  const { pg, d, idea } = await db();
  const id = await idea();
  const rep = async (u) => { await d.query(IDEA_REPORT_INSERT_SQL, [u, id, "spam", null]); return d.query(IDEA_AUTO_HIDE_SQL, [id, 3]); };
  await rep("q1"); await rep("q1"); assert.equal((await rep("q2")).length, 0);
  assert.equal((await rep("q3")).length, 1);
  assert.equal((await d.query("SELECT hidden_by_reports h FROM projects WHERE id::text=$1", [id]))[0].h, true);
  await pg.close();
});

test("requests: one open per idea+requester, owner-only respond, expiry, withdraw, rate count", async () => {
  const { pg, d, idea } = await db();
  const id = await idea();
  const r1 = await d.query(REQUEST_INSERT_SQL, [id, "q1", "owner", "Hello, I would like to help out."]);
  assert.equal(r1.length, 1);
  assert.equal((await d.query(REQUEST_INSERT_SQL, [id, "q1", "owner", "Hello again, still keen to help."])).length, 0, "duplicate open blocked");
  const rid = String(r1[0].id);
  assert.equal((await d.query(RESPOND_SQL, [rid, "q1", "accepted"])).length, 0, "requester can't accept");
  assert.equal((await d.query(RESPOND_SQL, [rid, "owner", "withdrawn"])).length, 0, "owner can't set other statuses");
  assert.equal((await d.query(RESPOND_SQL, [rid, "owner", "accepted"])).length, 1);
  assert.equal((await d.query(RESPOND_SQL, [rid, "owner", "declined"])).length, 0, "only once");
  assert.equal((await d.query(REQUEST_INSERT_SQL, [id, "q1", "owner", "A new request after acceptance."])).length, 1, "new one allowed after close");

  const r2 = String((await d.query(REQUEST_INSERT_SQL, [id, "q2", "owner", "Old request that should expire."]))[0].id);
  await d.query("UPDATE collaboration_requests SET created_at = now() - interval '31 days' WHERE id::text = $1", [r2]);
  assert.equal((await d.query(RESPOND_SQL, [r2, "owner", "accepted"])).length, 0, "expired can't be accepted");
  assert.deepEqual((await d.query(EXPIRE_SQL)).map((r) => String(r.id)), [r2]);

  const r3 = String((await d.query(REQUEST_INSERT_SQL, [id, "q3", "owner", "Request I will withdraw later."]))[0].id);
  assert.equal((await d.query(WITHDRAW_SQL, [r3, "owner"])).length, 0);
  assert.equal((await d.query(WITHDRAW_SQL, [r3, "q3"])).length, 1);
  assert.equal((await d.query(SENT_LAST_DAY_SQL, ["q1"]))[0].n, 2);
  assert.equal((await d.query(SENT_LAST_DAY_SQL, ["q2"]))[0].n, 0);
  await assert.rejects(d.query(REQUEST_INSERT_SQL, [id, "q2", "owner", ""]), "message length check");
  await pg.close();
});
