// Run: npm test. Mentor and investor role rules (P3-3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { canAdminDecide, investorChanged, mentorChanged, parseInvestor, parseMentor, roleStatusAfterSave } from "./mentors";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const BIO = "I've launched two apps and can help with product planning and first users.";

test("parseMentor: expertise from the list, bio length, availability, capacity, no contact details", () => {
  const ok = parseMentor(fd({ expertise: ["product", "software", "bogus", "product"], bio: BIO, availability: "2 hrs/month", max_open_mentees: "3" }));
  assert.deepEqual(ok.data, { expertise: ["product", "software"], bio: BIO, availability: "2 hrs/month", max_open_mentees: 3 });
  assert.match(parseMentor(fd({ bio: BIO, max_open_mentees: "3" })).error!, /Pick 1/);
  assert.match(parseMentor(fd({ expertise: "product", bio: "short", max_open_mentees: "3" })).error!, /20–1000/);
  assert.match(parseMentor(fd({ expertise: "product", bio: BIO, max_open_mentees: "11" })).error!, /1–10/);
  assert.match(parseMentor(fd({ expertise: "product", bio: `${BIO} Call 772-555-0100.`, max_open_mentees: "3" })).error!, /phone/);
  assert.equal(parseMentor(fd({ expertise: "product", bio: BIO, max_open_mentees: "1" })).data!.availability, null);
});

test("parseInvestor: type from the list, optional focus, no money amounts or contact details", () => {
  const ok = parseInvestor(fd({ investor_type: "grantmaker", focus_categories: ["AI", "Nope"], stage_focus: ["concept"], organization: "St. Lucie Fund", bio: "Early education and community projects on the Treasure Coast." }));
  assert.deepEqual(ok.data, { investor_type: "grantmaker", focus_categories: ["AI"], stage_focus: ["concept"], organization: "St. Lucie Fund", bio: "Early education and community projects on the Treasure Coast." });
  assert.match(parseInvestor(fd({ investor_type: "bank", bio: BIO })).error!, /Choose/);
  assert.match(parseInvestor(fd({ investor_type: "angel", bio: "Checks from $25k for seed-stage teams here." })).error!, /money/);
  assert.match(parseInvestor(fd({ investor_type: "angel", bio: "We write 50k tickets for local teams and more." })).error!, /money/);
  assert.match(parseInvestor(fd({ investor_type: "angel", bio: "Reach me at angel@example.com for any idea." })).error!, /email/);
});

test("status after the member saves: new → pending, wording change → back to review, revoked can't self-restore", () => {
  assert.equal(roleStatusAfterSave(null), "pending");
  assert.equal(roleStatusAfterSave({ status: "approved", changed: false }), "approved");
  assert.equal(roleStatusAfterSave({ status: "approved", changed: true }), "pending");
  assert.equal(roleStatusAfterSave({ status: "paused", changed: false }), "paused");
  assert.equal(roleStatusAfterSave({ status: "paused", changed: true }), "pending");
  assert.equal(roleStatusAfterSave({ status: "declined", changed: false }), "pending", "declined members can re-apply");
  assert.equal(roleStatusAfterSave({ status: "revoked", changed: true }), null);
  const m = { expertise: ["a", "b"], bio: BIO, availability: null, max_open_mentees: 3 };
  assert.equal(mentorChanged(m, { ...m, expertise: ["b", "a"], max_open_mentees: 5 }), false, "capacity alone isn't a wording change");
  assert.equal(mentorChanged(m, { ...m, bio: `${BIO}!` }), true);
  const i = { investor_type: "angel", focus_categories: ["AI"], stage_focus: [], organization: null, bio: BIO };
  assert.equal(investorChanged(i, { ...i }), false);
  assert.equal(investorChanged(i, { ...i, organization: "X" }), true);
});

test("admin decisions by status", () => {
  assert.ok(canAdminDecide("pending", "approve") && canAdminDecide("pending", "decline"));
  assert.ok(!canAdminDecide("approved", "approve") && !canAdminDecide("approved", "decline"));
  assert.ok(canAdminDecide("approved", "revoke") && canAdminDecide("paused", "revoke"));
  assert.ok(!canAdminDecide("pending", "revoke"));
  assert.ok(canAdminDecide("revoked", "approve"), "John can restore a badge");
});
