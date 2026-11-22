// Run: npm test. Needs on ideas: access and help only, never money or contact details.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canOwnerSetStatus, needStatusAfterEdit, parseNeed } from "./needs";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

test("parseNeed: kinds, lengths, no money, no contact details", () => {
  assert.deepEqual(parseNeed(fd({ kind: "mentorship", title: "A mentor for launch", amount_text: "2 hrs/week" })).data,
    { kind: "mentorship", title: "A mentor for launch", details: null, amount_text: "2 hrs/week" });
  assert.ok(parseNeed(fd({ kind: "cash", title: "Funding" })).error);
  assert.ok(parseNeed(fd({ kind: "skills", title: "x" })).error);
  assert.ok(parseNeed(fd({ kind: "sponsorship", title: "Sponsor", details: "We need $5,000" })).error, "no dollar amounts");
  assert.ok(parseNeed(fd({ kind: "sponsorship", title: "Sponsor", amount_text: "500 dollars" })).error);
  assert.ok(parseNeed(fd({ kind: "skills", title: "Designer", details: "email me: a@b.com" })).error);
  assert.ok(parseNeed(fd({ kind: "skills", title: "Designer", details: "x".repeat(1001) })).error);
  assert.ok(parseNeed(fd({ kind: "compute_access", title: "GPU time", amount_text: "10 hrs on a GPU machine" })).data);
});

test("edits go back to review; owner status moves", () => {
  const prev = { kind: "skills", title: "Designer", details: null, amount_text: null };
  assert.equal(needStatusAfterEdit({ ...prev, status: "open" }, prev), "open", "no change keeps it live");
  assert.equal(needStatusAfterEdit({ ...prev, status: "open" }, { ...prev, title: "A designer" }), "pending");
  assert.equal(needStatusAfterEdit({ ...prev, status: "met" }, { ...prev, details: "More" }), "pending");
  assert.equal(needStatusAfterEdit({ ...prev, status: "changes_requested" }, prev), "pending", "resubmits");
  assert.ok(canOwnerSetStatus("open", "met"));
  assert.ok(canOwnerSetStatus("met", "open"));
  assert.ok(canOwnerSetStatus("pending", "closed"));
  assert.ok(!canOwnerSetStatus("pending", "open"), "owners can't approve their own needs");
  assert.ok(!canOwnerSetStatus("changes_requested", "open"));
  assert.ok(!canOwnerSetStatus("closed", "closed"));
});
