import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIdea, statusAfterOwnerEdit } from "./ideas";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const ok = { project_name: "Solar Dorm", category: "AI", description: "A tool that helps dorms track and cut energy use together.", help_needed: ["developer", "designer"] };

test("parseIdea accepts valid input with privacy defaults", () => {
  const { data } = parseIdea(fd(ok));
  assert.ok(data);
  assert.deepEqual(data.field_visibility, { details: "members", website: "public", help_needed: "public" });
  assert.equal(data.audience, "public");
  assert.ok(!("email" in data), "no email field");
});

test("parseIdea rejects contact info, bad URLs, bad options", () => {
  assert.ok(parseIdea(fd({ ...ok, description: "Email me at me@example.com for more about this idea." })).state?.fieldErrors?.description);
  assert.ok(parseIdea(fd({ ...ok, details: "Call 772-555-1234" })).state?.fieldErrors?.details);
  assert.ok(parseIdea(fd({ ...ok, website: "javascript:alert(1)" })).state?.fieldErrors?.website);
  assert.ok(parseIdea(fd({ ...ok, help_needed: ["hacker"] })).state?.fieldErrors?.help_needed);
  assert.ok(parseIdea(fd({ ...ok, vis_details: "everyone" })).state?.fieldErrors?.vis_details);
  assert.ok(parseIdea(fd({ ...ok, description: "short" })).state?.fieldErrors?.description);
});

test("statusAfterOwnerEdit sends changed public text back to review", () => {
  const prev = { status: "approved", project_name: "A", description: "d", details: "", website: "" };
  const same = { project_name: "A", description: "d", details: "", website: "" };
  assert.equal(statusAfterOwnerEdit(prev, same), "approved");
  assert.equal(statusAfterOwnerEdit(prev, { ...same, description: "new" }), "pending");
  assert.equal(statusAfterOwnerEdit(prev, { ...same, website: "https://x.org" }), "pending");
  assert.equal(statusAfterOwnerEdit({ ...prev, status: "changes_requested" }, same), "pending");
  assert.equal(statusAfterOwnerEdit({ ...prev, status: "rejected" }, same), "pending");
  assert.equal(statusAfterOwnerEdit({ ...prev, status: "withdrawn" }, same), "withdrawn");
});
