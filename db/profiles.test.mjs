// Run: npm test. Exercises the shipped profile SQL (lib/profile-sql.ts) on PGlite after all migrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import { AUTO_HIDE_SQL, DIRECTORY_SQL, REPORT_INSERT_SQL, likePattern } from "../lib/profile-sql.ts";

async function db() {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  await runMigrations(d, loadMigrations(), { log: () => {} });
  const add = async (id, o = {}) => {
    await d.query("INSERT INTO members (user_id, email, status) VALUES ($1, $2, $3)", [id, `${id}@example.com`, o.status ?? "active"]);
    await d.query(`INSERT INTO profiles (user_id, display_name, headline, roles, skills, looking_for, is_published, moderation, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [id, o.name ?? id, o.headline ?? null, o.roles ?? [], o.skills ?? [], o.looking ?? [], o.published ?? true, o.moderation ?? "ok"]);
  };
  return { pg, d, add };
}
const dir = (d, { role = null, looking = null, q = "" } = {}) => d.query(DIRECTORY_SQL, [role, looking, q, likePattern(q), 24, 0]);

test("directory shows only published, visible profiles of active members, and never emails", async () => {
  const { pg, d, add } = await db();
  await add("user_pub", { roles: ["developer"], skills: ["React"], looking: ["collaborators"] });
  await add("user_priv", { published: false });
  await add("user_hidden", { moderation: "hidden" });
  await add("user_banned", { status: "banned" });
  await add("user_mentor", { roles: ["mentor_interest"], headline: "100% helpful_mentor" });
  const ids = (await dir(d)).map((r) => r.user_id).sort();
  assert.deepEqual(ids, ["user_mentor", "user_pub"]);
  for (const r of await dir(d)) assert.ok(!Object.values(r).some((v) => String(v).includes("@example.com")), "no email in rows");
  assert.deepEqual((await dir(d, { role: "developer" })).map((r) => r.user_id), ["user_pub"]);
  assert.deepEqual((await dir(d, { looking: "collaborators" })).map((r) => r.user_id), ["user_pub"]);
  assert.deepEqual((await dir(d, { q: "react" })).map((r) => r.user_id), ["user_pub"]);
  assert.deepEqual((await dir(d, { q: "%" })).map((r) => r.user_id), ["user_mentor"], "LIKE wildcards are escaped");
  assert.equal((await dir(d))[0].total, 2);
  await pg.close();
});

test("three distinct reports auto-hide a profile; duplicates don't count", async () => {
  const { pg, d, add } = await db();
  await add("user_t");
  const report = async (who) => {
    const ins = await d.query(REPORT_INSERT_SQL, [who, "user_t", "spam", null]);
    const hid = ins.length ? await d.query(AUTO_HIDE_SQL, ["user_t", 3, "Auto-hidden after 3 reports"]) : [];
    return { inserted: ins.length === 1, hidden: hid.length === 1 };
  };
  assert.deepEqual(await report("user_r1"), { inserted: true, hidden: false });
  assert.deepEqual(await report("user_r1"), { inserted: false, hidden: false }, "duplicate ignored");
  assert.deepEqual(await report("user_r2"), { inserted: true, hidden: false });
  assert.deepEqual(await report("user_r3"), { inserted: true, hidden: true });
  const [p] = await d.query("SELECT moderation, hidden_reason FROM profiles WHERE user_id = 'user_t'");
  assert.equal(p.moderation, "hidden");
  assert.equal((await dir(d)).length, 0);
  // Admin restores and dismisses open reports; a single new report must not re-hide it.
  await d.query("UPDATE profiles SET moderation = 'ok' WHERE user_id = 'user_t'");
  await d.query("UPDATE reports SET status = 'dismissed' WHERE target_id = 'user_t'");
  assert.deepEqual(await report("user_r4"), { inserted: true, hidden: false });
  await pg.close();
});
