// Run: npm test. Shared request rules (collaboration, help offers, offer requests).
import { test } from "node:test";
import assert from "node:assert/strict";
import { canSend, canTransition, expiresOn, isExpired, isRequestKind, KIND_INFO, MAX_REQUESTS_PER_DAY, parseRequestMessage, sideOf } from "./requests";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { viewerGated: true, viewerId: "u1", responderIds: ["u2"], targetOpen: true, sentLast24h: 0, hasOpenRequest: false };
const reason = (r: ReturnType<typeof canSend>) => (r.ok ? "ok" : r.reason);

test("canSend: same checks for every kind", () => {
  assert.equal(reason(canSend(base)), "ok");
  assert.equal(reason(canSend({ ...base, viewerGated: false })), "not_member");
  assert.equal(reason(canSend({ ...base, viewerId: null })), "not_member");
  assert.equal(reason(canSend({ ...base, responderIds: ["u2", "u1"] })), "own", "a partner contact can't request their own partner's offer");
  assert.equal(reason(canSend({ ...base, targetOpen: false })), "not_visible");
  assert.equal(reason(canSend({ ...base, eligible: false })), "not_eligible");
  assert.equal(reason(canSend({ ...base, responderIds: [] })), "ok", "offer requests with no contacts go to PANA");
  assert.equal(reason(canSend({ ...base, hasOpenRequest: true })), "already_open");
  assert.equal(reason(canSend({ ...base, sentLast24h: MAX_REQUESTS_PER_DAY })), "rate_limited");
});

test("messages: length and no contact details, per-kind prompt", () => {
  assert.equal(parseRequestMessage(fd({ message: "I can mentor you every other week." }), "help").ok, true);
  const short = parseRequestMessage(fd({ message: "hi" }), "help");
  assert.ok(!short.ok && short.error.includes("how you can help"));
  const email = parseRequestMessage(fd({ message: "Write me at someone@example.com any time." }), "offer");
  assert.ok(!email.ok && /email/.test(email.error));
  assert.ok(!parseRequestMessage(fd({ message: "Call me on 772-555-0101 about lab time." }), "offer").ok);
});

test("transitions: responders answer, requester withdraws, admins only for offers, nothing after expiry", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const req = { status: "pending", requester: "u1", responders: ["c1", "c2"], created_at: new Date("2026-11-20T12:00:00Z") };
  assert.ok(canTransition(req, { id: "c2" }, "accepted", { now }));
  assert.ok(!canTransition(req, { id: "u1" }, "accepted", { now }), "requester can't accept");
  assert.ok(canTransition(req, { id: "u1" }, "withdrawn", { now }));
  assert.ok(!canTransition(req, { id: "c1" }, "withdrawn", { now }));
  assert.ok(!canTransition(req, { id: "adm", isAdmin: true }, "accepted", { now }), "admins don't answer by default");
  assert.ok(canTransition(req, { id: "adm", isAdmin: true }, "declined", { now, adminMayRespond: true }));
  assert.ok(!canTransition({ ...req, requester: "adm" }, { id: "adm", isAdmin: true }, "accepted", { now, adminMayRespond: true }), "never your own request");
  assert.ok(!canTransition({ ...req, status: "accepted" }, { id: "c1" }, "declined", { now }));
  const old = { ...req, created_at: new Date("2026-10-01T12:00:00Z") };
  assert.ok(isExpired(old.created_at, now));
  assert.ok(!canTransition(old, { id: "c1" }, "accepted", { now }));
  assert.equal(expiresOn("2026-11-01T00:00:00Z").toISOString(), "2026-12-01T00:00:00.000Z");
});

test("sides and paths", () => {
  const r = { requester: "u1", responders: ["c1"] };
  assert.equal(sideOf(r, "u1"), "sent");
  assert.equal(sideOf(r, "c1"), "received");
  assert.equal(sideOf(r, "x"), null);
  assert.equal(sideOf(r, "x", true), "admin");
  assert.ok(isRequestKind("help") && !isRequestKind("money"));
  assert.equal(KIND_INFO.offer.path("abc"), "/me/requests/offers/abc");
  assert.equal(KIND_INFO.collab.path("abc"), "/me/requests/abc", "existing collaboration links keep working");
});

test("P3-3 kinds: mentorship and investor interest use the same rules, with per-kind daily caps", () => {
  assert.ok(isRequestKind("mentorship") && isRequestKind("investor"));
  assert.equal(KIND_INFO.mentorship.path("x"), "/me/requests/mentorship/x");
  assert.equal(KIND_INFO.investor.path("x"), "/me/requests/investor/x");
  assert.equal(reason(canSend({ ...base, kindSentLast24h: 4, kindLimit: 5 })), "ok");
  assert.equal(reason(canSend({ ...base, kindSentLast24h: 5, kindLimit: 5 })), "rate_limited", "5 mentorship requests a day");
  assert.equal(reason(canSend({ ...base, sentLast24h: MAX_REQUESTS_PER_DAY, kindSentLast24h: 0, kindLimit: 10 })), "rate_limited", "the shared limit still applies");
  const m = parseRequestMessage(fd({ message: "short" }), "mentorship");
  assert.ok(!m.ok && m.error.includes("what you'd like help with"));
  assert.ok(!parseRequestMessage(fd({ message: "Email me at investor@fund.com to talk terms." }), "investor").ok);
});
