// Run: npm test. Migration 008 (PANA Domino Royale Phase 1) on PGlite after all migrations from the baseline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";

async function db() {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  await runMigrations(d, loadMigrations(), { log: () => {} });
  await d.query("INSERT INTO members (user_id, email, status) VALUES ('u1', 'u1@example.com', 'active')");
  await d.query("INSERT INTO domino_players (user_id) VALUES ('u1')");
  return { pg, d };
}
const add = (d, amount, reason, key) =>
  d.query("INSERT INTO domino_token_ledger (user_id, amount, reason, idem_key) VALUES ('u1', $1, $2, $3)", [amount, reason, key]);

test("008 applies on top of 001-007 and seeds badges and challenges", async () => {
  const { pg, d } = await db();
  const v = (await d.query("SELECT max(version)::int v FROM schema_migrations"))[0].v;
  assert.equal(v, 8);
  assert.ok((await d.query("SELECT count(*)::int n FROM domino_badges"))[0].n >= 10);
  const active = (await d.query("SELECT code FROM domino_challenges WHERE active ORDER BY sort")).map((r) => r.code);
  assert.deepEqual(active, ["claim_daily", "streak_3"]);
  await pg.close();
});

test("ledger: no purchase/cash-out/transfer reasons; signs enforced; idempotent keys", async () => {
  const { pg, d } = await db();
  await add(d, 500, "signup", "signup:u1");
  for (const r of ["purchase", "cashout", "transfer", "gift"]) await assert.rejects(add(d, 10, r, `x:${r}`), /reason_check/);
  await assert.rejects(add(d, -5, "daily_bonus", "neg"), /sign_check/);
  await assert.rejects(add(d, 5, "cosmetic", "pos-cosmetic"), /sign_check/);
  await assert.rejects(add(d, 0, "stake", "zero"), /nonzero/);
  await assert.rejects(add(d, 500, "signup", "signup:u1"), /idem_key/);
  await pg.close();
});

test("ledger is append-only, but account deletion cascades through it", async () => {
  const { pg, d } = await db();
  await add(d, 500, "signup", "signup:u1");
  await assert.rejects(d.query("UPDATE domino_token_ledger SET amount = 9999"), /append-only/);
  await assert.rejects(d.query("DELETE FROM domino_token_ledger"), /append-only/);
  await d.query("INSERT INTO domino_player_badges (user_id, badge_code) VALUES ('u1', 'founding_member')");
  await d.query("DELETE FROM members WHERE user_id = 'u1'");
  for (const t of ["domino_players", "domino_token_ledger", "domino_player_badges"])
    assert.equal((await d.query(`SELECT count(*)::int n FROM ${t}`))[0].n, 0, t);
  await pg.close();
});

test("players require an existing PANA member", async () => {
  const { pg, d } = await db();
  await assert.rejects(d.query("INSERT INTO domino_players (user_id) VALUES ('nobody')"), /foreign key/);
  await pg.close();
});
