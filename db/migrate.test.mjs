// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { decide, isProductionUrl, loadMigrations, runMigrations } from "./migrate.mjs";

const PROD = "postgresql://u:p@ep-spring-wave-a4fuqe43-pooler.us-east-1.aws.neon.tech/neondb";
const BRANCH = "postgresql://u:p@ep-quiet-sky-12345678-pooler.us-east-1.aws.neon.tech/neondb";
const quiet = () => {};

async function freshDb() {
  const pg = new PGlite();
  const db = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  const baseline = readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8");
  await db.exec(baseline);
  return { pg, db };
}

test("production detection", () => {
  assert.equal(isProductionUrl(PROD), true);
  assert.equal(isProductionUrl(PROD.replace("-pooler", "")), true);
  assert.equal(isProductionUrl(BRANCH), false);
  assert.equal(isProductionUrl("not a url"), true, "unparseable URLs are treated as production");
});

test("decide: preview-build only acts on Vercel Preview with a non-production DB", () => {
  assert.equal(decide({ url: BRANCH, env: {}, previewBuild: true }).run, false);
  assert.equal(decide({ url: BRANCH, env: { VERCEL_ENV: "production" }, previewBuild: true }).run, false);
  const shared = decide({ url: PROD, env: { VERCEL_ENV: "preview" }, previewBuild: true });
  assert.equal(shared.run, false);
  assert.match(shared.reason, /PRODUCTION/);
  assert.equal(decide({ url: BRANCH, env: { VERCEL_ENV: "preview" }, previewBuild: true }).run, true);
});

test("decide: manual runs refuse production unless explicitly allowed", () => {
  assert.equal(decide({ url: PROD, env: {} }).run, false);
  assert.equal(decide({ url: PROD, env: {} }).fatal, true);
  assert.equal(decide({ url: BRANCH, env: { VERCEL_ENV: "production" } }).run, false);
  assert.equal(decide({ url: PROD, env: {}, allowProduction: true }).run, true);
  assert.equal(decide({ url: BRANCH, env: {} }).run, true);
  assert.equal(decide({ url: undefined, env: {} }).fatal, true);
});

test("applies 002+ on top of the production baseline, marks 001 as pre-applied, is idempotent", async () => {
  const { pg, db } = await freshDb();
  await db.query("INSERT INTO projects (project_name, description, status, user_id) VALUES ('Old', 'legacy row', 'approved', 'user_1')");
  const migrations = loadMigrations();
  const applied = await runMigrations(db, migrations, { log: quiet });
  assert.deepEqual(applied, migrations.map((m) => m.version).filter((v) => v !== "001"));

  const versions = (await db.query("SELECT version FROM schema_migrations ORDER BY 1")).map((r) => r.version);
  assert.deepEqual(versions, migrations.map((m) => m.version));

  const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.table_name);
  for (const t of ["members", "profiles", "reports", "collaboration_requests", "admin_audit_log", "schema_migrations"]) {
    assert.ok(tables.includes(t), `missing table ${t}`);
  }
  // Existing rows survive with sensible defaults; status still 'approved' (not reset to pending).
  const [row] = await db.query("SELECT status, kind, stage, audience, field_visibility FROM projects");
  assert.equal(row.status, "approved");
  assert.equal(row.kind, "idea");
  assert.equal(row.stage, "concept");
  assert.equal(row.audience, "public");
  assert.equal(row.field_visibility.details, "members");
  const [ct] = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name='projects' AND column_name='created_at'`);
  assert.equal(ct.data_type, "timestamp with time zone");

  // Re-running applies nothing.
  assert.deepEqual(await runMigrations(db, migrations, { log: quiet }), []);
  await pg.close();
});

test("constraints enforce the approved model", async () => {
  const { pg, db } = await freshDb();
  await runMigrations(db, loadMigrations(), { log: quiet });
  await db.query("INSERT INTO members (user_id) VALUES ('user_a')");
  await assert.rejects(db.query("INSERT INTO profiles (user_id, display_name, roles) VALUES ('user_a', 'A', '{hacker}')"));
  await db.query("INSERT INTO profiles (user_id, display_name, roles) VALUES ('user_a', 'A', '{developer,mentor_interest}')");
  await assert.rejects(db.query("INSERT INTO projects (project_name, status) VALUES ('Bad', 'bogus')"));
  await assert.rejects(db.query("INSERT INTO projects (project_name, kind) VALUES ('Bad', 'rocket')"));
  await db.query("INSERT INTO projects (project_name, status) VALUES ('W', 'withdrawn')");
  // Deleting a member cascades to the profile.
  await db.query("DELETE FROM members WHERE user_id = 'user_a'");
  assert.equal((await db.query("SELECT count(*)::int n FROM profiles"))[0].n, 0);
  // One open collaboration request per requester per idea; no self-requests.
  const [{ id }] = await db.query("INSERT INTO projects (project_name, user_id) VALUES ('X', 'owner') RETURNING id");
  await db.query("INSERT INTO collaboration_requests (project_id, requester_user_id, owner_user_id, message) VALUES ($1, 'r', 'owner', 'hi')", [id]);
  await assert.rejects(db.query("INSERT INTO collaboration_requests (project_id, requester_user_id, owner_user_id, message) VALUES ($1, 'r', 'owner', 'again')", [id]));
  await assert.rejects(db.query("INSERT INTO collaboration_requests (project_id, requester_user_id, owner_user_id, message) VALUES ($1, 'owner', 'owner', 'me')", [id]));
  await pg.close();
});

test("a failing migration is rolled back and not recorded", async () => {
  const { pg, db } = await freshDb();
  const dir = mkdtempSync(join(tmpdir(), "mig-"));
  writeFileSync(join(dir, "002_ok.sql"), "CREATE TABLE t_ok (id int);");
  writeFileSync(join(dir, "003_bad.sql"), "CREATE TABLE t_bad (id int); SELECT * FROM does_not_exist;");
  await assert.rejects(runMigrations(db, loadMigrations(dir), { log: quiet }), /003_bad\.sql failed/);
  const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.table_name);
  assert.ok(tables.includes("t_ok"));
  assert.ok(!tables.includes("t_bad"));
  const versions = (await db.query("SELECT version FROM schema_migrations")).map((r) => r.version);
  assert.ok(versions.includes("002") && !versions.includes("003"));
  await pg.close();
});

test("edited applied migrations and bad files are rejected", async () => {
  const { pg, db } = await freshDb();
  const dir = mkdtempSync(join(tmpdir(), "mig-"));
  writeFileSync(join(dir, "002_a.sql"), "CREATE TABLE t_a (id int);");
  await runMigrations(db, loadMigrations(dir), { log: quiet });
  writeFileSync(join(dir, "002_a.sql"), "CREATE TABLE t_a (id int, x int);");
  await assert.rejects(runMigrations(db, loadMigrations(dir), { log: quiet }), /checksum mismatch/);
  writeFileSync(join(dir, "003_tx.sql"), "BEGIN;\nCREATE TABLE z (id int);\nCOMMIT;");
  assert.throws(() => loadMigrations(dir), /BEGIN\/COMMIT/);
  await pg.close();
});

test("dry run changes nothing", async () => {
  const { pg, db } = await freshDb();
  const lines = [];
  await runMigrations(db, loadMigrations(), { dryRun: true, log: (s) => lines.push(s) });
  assert.ok(lines.some((l) => l.includes("002_members_audit.sql")));
  const tables = (await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.table_name);
  assert.ok(!tables.includes("members"));
  await pg.close();
});
