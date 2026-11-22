import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp");

const src = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const first = JSON.parse(src.match(/matcher: \[\s*("[^\n]*"),/)![1]);
const re: RegExp = pathToRegexp(first);

test("proxy matcher: dot-paths always reach the proxy, static assets don't", () => {
  for (const p of ["/.git/HEAD", "/.git/config", "/.env", "/.git/index.xml", "/.well-known/security.txt", "/a/.svn/x.txt", "/support", "/verify/abc"]) {
    assert.ok(re.test(p), `should match ${p}`);
  }
  for (const p of ["/logo.png", "/robots.txt", "/sitemap.xml", "/_next/static/chunk.js", "/images/a.b/c.png"]) {
    assert.ok(!re.test(p), `should skip ${p}`);
  }
});
