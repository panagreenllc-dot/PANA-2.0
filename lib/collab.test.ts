import { test } from "node:test";
import assert from "node:assert/strict";
import { canRequest, canTransition, isExpired, parseRequestMessage, MAX_REQUESTS_PER_DAY } from "./collab";

const base = { viewerGated: true, viewerId: "u1", ownerId: "u2", ideaVisible: true, sentLast24h: 0, hasOpenRequest: false };
test("canRequest rules", () => {
  assert.deepEqual(canRequest(base), { ok: true });
  assert.equal((canRequest({ ...base, viewerGated: false }) as { reason: string }).reason, "not_member");
  assert.equal((canRequest({ ...base, ownerId: "u1" }) as { reason: string }).reason, "own_idea");
  assert.equal((canRequest({ ...base, ideaVisible: false }) as { reason: string }).reason, "not_visible");
  assert.equal((canRequest({ ...base, hasOpenRequest: true }) as { reason: string }).reason, "already_open");
  assert.equal((canRequest({ ...base, sentLast24h: MAX_REQUESTS_PER_DAY }) as { reason: string }).reason, "rate_limited");
});

test("expiry and transitions", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const old = new Date(now.getTime() - 31 * 86400000);
  const fresh = new Date(now.getTime() - 86400000);
  assert.equal(isExpired(old, now), true);
  assert.equal(isExpired(fresh, now), false);
  const r = { status: "pending", owner_user_id: "o", requester_user_id: "q", created_at: fresh };
  assert.equal(canTransition(r, "o", "accepted", now), true);
  assert.equal(canTransition(r, "q", "accepted", now), false);
  assert.equal(canTransition(r, "q", "withdrawn", now), true);
  assert.equal(canTransition(r, "o", "withdrawn", now), false);
  assert.equal(canTransition({ ...r, created_at: old }, "o", "accepted", now), false);
  assert.equal(canTransition({ ...r, status: "declined" }, "o", "accepted", now), false);
});

test("request message validation", () => {
  const f = (m: string) => { const d = new FormData(); d.set("message", m); return parseRequestMessage(d); };
  assert.equal(f("too short").ok, false);
  assert.equal(f("I'd love to help build the frontend for this idea.").ok, true);
  assert.equal(f("I'd love to help, email me at a@b.com any time please").ok, false);
  assert.equal(f("x".repeat(1001)).ok, false);
});
