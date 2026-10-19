#!/usr/bin/env node
// Numbered, forward-only migration runner for PANA 2.0.
//
//   node db/migrate.mjs --dry-run           # show what would run
//   node db/migrate.mjs                     # apply pending migrations (refuses production)
//   node db/migrate.mjs --preview-build     # used by `npm run build`: only acts on Vercel Preview
//   node db/migrate.mjs --allow-production  # production, ONLY with the owner's written approval
//
// Each migration file runs in its own transaction together with its row in
// schema_migrations, under an advisory lock. Files must NOT contain BEGIN/COMMIT.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

// Neon endpoint(s) of the PRODUCTION database. Not secrets (no credentials), just host ids.
export const PRODUCTION_DB_ENDPOINTS = ["ep-spring-wave-a4fuqe43"];

// 001 was applied by hand in the Neon SQL Editor before this runner existed.
export const PRE_RUNNER_MIGRATIONS = ["001"];

const FILE_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 72720251;

export function loadMigrations(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const seen = new Set();
  return files.map((file) => {
    const m = FILE_RE.exec(file);
    if (!m) throw new Error(`Bad migration file name: ${file} (expected NNN_snake_case.sql)`);
    if (seen.has(m[1])) throw new Error(`Duplicate migration number ${m[1]}`);
    seen.add(m[1]);
    const sql = readFileSync(join(dir, file), "utf8");
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql)) {
      throw new Error(`${file}: remove BEGIN/COMMIT, the runner wraps each file in a transaction`);
    }
    return { version: m[1], name: file, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  });
}

/** True when the connection string points at a known production endpoint. */
export function isProductionUrl(url, endpoints = PRODUCTION_DB_ENDPOINTS) {
  let host = "";
  try { host = new URL(url).hostname; } catch { return true; } // unparseable: assume the worst
  return endpoints.some((ep) => host === ep || host.startsWith(`${ep}.`) || host.startsWith(`${ep}-pooler.`));
}

/**
 * Decide whether to run, purely from inputs (unit-tested).
 * Returns { run: boolean, reason: string, fatal?: boolean }.
 */
export function decide({ url, env = {}, previewBuild = false, allowProduction = false, endpoints }) {
  if (previewBuild) {
    if (env.VERCEL_ENV !== "preview") return { run: false, reason: `not a Vercel Preview build (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"}); skipping` };
    if (!url) return { run: false, reason: "no DATABASE_URL in this Preview build; skipping" };
    if (isProductionUrl(url, endpoints)) {
      return { run: false, reason: "SKIPPED: this Preview is connected to the PRODUCTION database. Enable Neon preview branching first (see db/README.md)." };
    }
    return { run: true, reason: "Preview build on a non-production database" };
  }
  if (!url) return { run: false, fatal: true, reason: "DATABASE_URL_UNPOOLED / DATABASE_URL is not set" };
  const prod = env.VERCEL_ENV === "production" || isProductionUrl(url, endpoints);
  if (prod && !allowProduction) {
    return { run: false, fatal: true, reason: "Refusing to migrate PRODUCTION without --allow-production (needs the owner's approval)." };
  }
  return { run: true, reason: prod ? "PRODUCTION (explicitly allowed)" : "non-production database" };
}

/**
 * Apply pending migrations. `db` is an adapter: { query(text, params) => rows[], exec(text) }.
 */
export async function runMigrations(db, migrations, { dryRun = false, log = console.log } = {}) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY, name text NOT NULL, checksum text,
    applied_at timestamptz NOT NULL DEFAULT now())`);
  await db.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    // Record migrations that were applied by hand before the runner existed.
    const hasStatus = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'status'`);
    if (hasStatus.length > 0) {
      for (const m of migrations.filter((x) => PRE_RUNNER_MIGRATIONS.includes(x.version))) {
        await db.query(
          `INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING`,
          [m.version, m.name, m.checksum]);
      }
    }

    const applied = new Map((await db.query("SELECT version, name, checksum FROM schema_migrations")).map((r) => [r.version, r]));
    for (const m of migrations) {
      const a = applied.get(m.version);
      if (a && a.checksum && a.checksum !== m.checksum && !PRE_RUNNER_MIGRATIONS.includes(m.version)) {
        throw new Error(`Migration ${m.name} was changed after it was applied (checksum mismatch). Add a new migration instead.`);
      }
    }
    const pending = migrations.filter((m) => !applied.has(m.version));
    if (pending.length === 0) { log("No pending migrations."); return []; }
    for (const m of pending) {
      if (dryRun) { log(`[dry-run] would apply ${m.name}`); continue; }
      log(`Applying ${m.name} ...`);
      await db.exec("BEGIN");
      try {
        await db.exec(m.sql);
        await db.query("INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)", [m.version, m.name, m.checksum]);
        await db.exec("COMMIT");
      } catch (e) {
        await db.exec("ROLLBACK");
        throw new Error(`${m.name} failed and was rolled back: ${e.message}`);
      }
    }
    return pending.map((m) => m.version);
  } finally {
    await db.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}

async function main(argv) {
  const previewBuild = argv.includes("--preview-build");
  const dryRun = argv.includes("--dry-run");
  const allowProduction = argv.includes("--allow-production");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const d = decide({ url, env: process.env, previewBuild, allowProduction });
  console.log(`[migrate] ${d.reason}`);
  if (!d.run) process.exit(d.fatal ? 1 : 0);

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const db = { query: async (t, p) => (await client.query(t, p)).rows, exec: async (t) => { await client.query(t); } };
  try {
    const done = await runMigrations(db, loadMigrations(), { dryRun, log: (s) => console.log(`[migrate] ${s}`) });
    console.log(`[migrate] done${done.length ? `: applied ${done.join(", ")}` : ""}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`[migrate] ERROR: ${e.message}`); process.exit(1); });
}
