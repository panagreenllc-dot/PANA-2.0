// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { containsContactInfo, parseProfile, parseReport, parseTags } from "./profile-input";

function fd(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const base = { display_name: "Ada Lovelace", headline: "Engineer", experience: "Built things", skills: "TS, React, ts", interests: "AI",
  roles: ["developer", "student"], looking_for: ["collaborators"], link_github: "https://github.com/ada" };

test("valid profile parses and normalizes tags", () => {
  const { data, state } = parseProfile(fd(base));
  assert.equal(state, undefined);
  assert.deepEqual(data!.skills, ["TS", "React"]);
  assert.deepEqual(data!.roles, ["developer", "student"]);
  assert.deepEqual(data!.links, { github: "https://github.com/ada" });
});

test("limits and allowed values are enforced", () => {
  const bad = (o: Record<string, string | string[]>, field: string) => {
    const r = parseProfile(fd({ ...base, ...o }));
    assert.ok(r.state?.fieldErrors?.[field as never], `expected error on ${field} for ${JSON.stringify(o).slice(0, 60)}`);
  };
  bad({ display_name: "A" }, "display_name");
  bad({ display_name: "x".repeat(81) }, "display_name");
  bad({ headline: "x".repeat(121) }, "headline");
  bad({ experience: "x".repeat(2001) }, "experience");
  bad({ roles: ["developer", "admin"] }, "roles");
  bad({ looking_for: ["dates"] }, "looking_for");
  bad({ skills: Array.from({ length: 16 }, (_, i) => `s${i}`).join(",") }, "skills");
  bad({ interests: "x".repeat(31) }, "interests");
  bad({ link_github: "https://evil.com/ada" }, "github");
  bad({ link_linkedin: "https://linkedin.com.evil.io/in/a" }, "linkedin");
  bad({ link_website: "javascript:alert(1)" }, "website");
  bad({ link_website: "https://user:pw@site.com" }, "website");
  bad({ link_portfolio: "https://x.com/" + "a".repeat(200) }, "portfolio");
});

test("emails and phone numbers are rejected in profile text", () => {
  for (const t of ["mail me at ada@example.com", "ada (at) example (dot) com", "call (772) 555-0100", "+1 772.555.0100"]) {
    assert.equal(containsContactInfo(t), true, t);
    assert.ok(parseProfile(fd({ ...base, experience: t })).state?.fieldErrors?.experience, t);
  }
  for (const t of ["React 18 and Node 20", "Class of 2027", "3 years at a startup"]) assert.equal(containsContactInfo(t), false, t);
  assert.ok(parseProfile(fd({ ...base, skills: "ada@example.com" })).state?.fieldErrors?.skills);
});

test("tags and reports", () => {
  assert.deepEqual(parseTags(" a , b\nA,, c "), ["a", "b", "c"]);
  assert.equal(parseReport(fd({ reason: "spam" })).ok, true);
  assert.equal(parseReport(fd({ reason: "nope" })).ok, false);
  assert.equal(parseReport(fd({ reason: "other", details: "x".repeat(501) })).ok, false);
});
