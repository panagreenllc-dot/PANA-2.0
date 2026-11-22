// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { gateStatus, needsTermsUpdate, parseTermsUpdate, parseWelcome, safeNext, termsCurrent, TERMS_VERSION } from "./gate";

const done = { age_attested_at: new Date(), terms_accepted_at: new Date(), terms_version: TERMS_VERSION, status: "active" };

test("gateStatus", () => {
  assert.equal(gateStatus({ userId: null, member: null }), "anon");
  assert.equal(gateStatus({ userId: "user_1", member: null }), "needs_welcome");
  assert.equal(gateStatus({ userId: "user_1", member: { ...done, age_attested_at: null } }), "needs_welcome");
  assert.equal(gateStatus({ userId: "user_1", member: { ...done, terms_accepted_at: null } }), "needs_welcome");
  assert.equal(gateStatus({ userId: "user_1", member: { ...done, terms_version: null } }), "needs_welcome");
  assert.equal(gateStatus({ userId: "user_1", member: done }), "ok");
  assert.equal(gateStatus({ userId: "user_1", banned: true, member: done }), "banned");
  assert.equal(gateStatus({ userId: "user_1", member: { ...done, status: "banned" } }), "banned");
  assert.equal(gateStatus({ userId: "user_1", member: { ...done, status: "deleted" } }), "banned");
});

test("safeNext blocks open redirects and loops", () => {
  assert.equal(safeNext("/submit"), "/submit");
  assert.equal(safeNext("/ideas?x=1"), "/ideas?x=1");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/welcome", "/sign-in", "/api/x", "", null, 42, "/a\nb"]) {
    assert.equal(safeNext(bad), "/ideas", `should reject ${String(bad)}`);
  }
  assert.equal(safeNext("nope", "/"), "/");
});

test("parseWelcome requires both boxes", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  assert.equal(parseWelcome(fd({})).ok, false);
  assert.equal(parseWelcome(fd({ over18: "on" })).ok, false);
  assert.equal(parseWelcome(fd({ acceptTerms: "on" })).ok, false);
  assert.equal(parseWelcome(fd({ over18: "on", acceptTerms: "on" })).ok, true);
});

test("terms version is compared, and an older version only triggers the update flow", () => {
  const old = { ...done, terms_version: "2026-10-draft" };
  assert.equal(TERMS_VERSION, "2026-12");
  assert.equal(gateStatus({ userId: "user_1", member: old }), "ok", "older acceptance keeps existing access");
  assert.equal(termsCurrent(old), false);
  assert.equal(termsCurrent(done), true);
  assert.equal(termsCurrent(null), false);
  assert.equal(termsCurrent({ ...done, terms_accepted_at: null }), false);
  assert.equal(needsTermsUpdate("ok", old), true);
  assert.equal(needsTermsUpdate("ok", done), false);
  assert.equal(needsTermsUpdate("needs_welcome", null), false, "new members go through the normal welcome");
  const f = new FormData();
  assert.equal(parseTermsUpdate(f).ok, false);
  f.set("acceptTerms", "on");
  assert.equal(parseTermsUpdate(f).ok, true);
});
