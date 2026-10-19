// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { clerkJsonToUser, isClerkUserId, memberFieldsFromClerk } from "./clerk-sync";

test("webhook payload maps to member fields (primary email, lowercase, verified, banned)", () => {
  const u = clerkJsonToUser({
    id: "user_abc123", first_name: "Ada", last_name: "Lovelace", image_url: "https://img/x.png", banned: true,
    primary_email_address_id: "idn_2",
    email_addresses: [
      { id: "idn_1", email_address: "old@example.com", verification: { status: "unverified" } },
      { id: "idn_2", email_address: "Ada@Example.com", verification: { status: "verified" } },
    ],
  });
  assert.deepEqual(memberFieldsFromClerk(u), {
    user_id: "user_abc123", email: "ada@example.com", email_verified: true,
    display_name: "Ada Lovelace", image_url: "https://img/x.png", status: "banned",
  });
});

test("handles users without names or emails", () => {
  const f = memberFieldsFromClerk(clerkJsonToUser({ id: "user_x", username: "builder" }));
  assert.equal(f.display_name, "builder");
  assert.equal(f.email, null);
  assert.equal(f.email_verified, false);
  assert.equal(f.status, "active");
});

test("isClerkUserId", () => {
  assert.ok(isClerkUserId("user_2abcXYZ"));
  for (const bad of ["", "usr_1", "user_", "user_1; DROP", null, 5]) assert.equal(isClerkUserId(bad), false);
});
