import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceLabel, badgeDisplayName, canUseOffer, howToUse, isLikelyBot, HONEYPOT, MIN_FILL_MS, parseInquiry, parseOffer, parsePartner, SPONSOR_DIRECT_NOTE } from "./partners";
import { badgeIsValid, badgeSecret, deriveToken, hashToken, newNonce, TOKEN_RE } from "./badge";
import { hit, _resetForTests } from "./rate-limit";
import { isDotPath } from "./paths";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

test("inquiry: valid input, field errors, link limit", () => {
  const ok = parseInquiry(fd({ org_name: "St. Lucie County Library", contact_name: "Jo Doe", contact_email: "Jo@Lib.example.org", kind: "library", can_offer: ["library_time", "meeting_space"], message: "Saturday blocks." }));
  assert.equal(ok.data?.contact_email, "jo@lib.example.org");
  assert.deepEqual(ok.data?.can_offer, ["library_time", "meeting_space"]);
  const bad = parseInquiry(fd({ org_name: "X", contact_name: "", contact_email: "nope", kind: "bank", can_offer: ["cash"] }));
  assert.deepEqual(Object.keys(bad.state!.fieldErrors!).sort(), ["can_offer", "contact_email", "contact_name", "kind", "org_name"]);
  const spammy = parseInquiry(fd({ org_name: "Org", contact_name: "Jo", contact_email: "a@b.co", kind: "other", message: "http://a http://b http://c" }));
  assert.ok(spammy.state?.fieldErrors?.message);
});

test("bot checks: honeypot and fill time", () => {
  const now = Date.now();
  assert.equal(isLikelyBot(fd({ form_started: String(now - 10_000) }), now), false);
  assert.equal(isLikelyBot(fd({ form_started: String(now - 10_000), [HONEYPOT]: "555" }), now), true);
  assert.equal(isLikelyBot(fd({ form_started: String(now - MIN_FILL_MS + 500) }), now), true, "too fast");
  assert.equal(isLikelyBot(fd({}), now), true, "missing timestamp");
});

test("partner and offer parsing: access only, no money amounts, consistent claim methods", () => {
  assert.equal(parsePartner(fd({ name: "Indian River State College", kind: "college", website: "https://irsc.edu", public_listing: "on" })).data?.slug, "indian-river-state-college");
  assert.ok(parsePartner(fd({ name: "X Co", website: "javascript:alert(1)" })).error);
  const base = { type: "lab_hours", title: "IRSC Fort Pierce lab", eligibility: "incubator_participants", claim_method: "show_badge" };
  assert.equal(parseOffer(fd(base)).data?.claim_method, "show_badge");
  assert.ok(parseOffer(fd({ ...base, eligibility: "public" })).error, "badge needs participants");
  assert.ok(parseOffer(fd({ ...base, claim_method: "external_link" })).error, "link needs url");
  assert.equal(parseOffer(fd({ ...base, claim_method: "request_via_pana", eligibility: "members" })).data?.claim_method, "request_via_pana", "P3-2b: requests through PANA");
  assert.ok(parseOffer(fd({ ...base, claim_method: "request_via_pana", external_url: "https://x.org" })).error, "requests have no link");
  assert.ok(parseOffer(fd({ ...base, title: "Free $500 for you" })).error, "no money amounts");
  assert.ok(parseOffer(fd({ ...base, type: "grant" })).error);
  assert.ok(parseOffer(fd({ ...base, starts_on: "2027-03-10", ends_on: "2027-03-01" })).error);
  const sp = parseOffer(fd({ ...base, type: "sponsor_funding", title: "Sponsor a student app", description: "We back one project." }));
  assert.ok(sp.data?.description?.includes(SPONSOR_DIRECT_NOTE), "sponsor offers always say the sponsor pays directly");
  assert.ok(parseOffer(fd({ ...base, eligibility: "members", cohort_id: "5f1c1b9e-1111-4222-8333-944455556666", claim_method: "external_link", external_url: "https://x.org" })).error, "cohort limit only for participant offers");
});

test("who can use an offer", () => {
  const anon = { member: false, participantCohorts: [] };
  const member = { member: true, participantCohorts: [] };
  const p1 = { member: true, participantCohorts: ["c1"] };
  assert.equal(canUseOffer({ eligibility: "public", cohort_id: null }, anon), true);
  assert.equal(canUseOffer({ eligibility: "members", cohort_id: null }, anon), false);
  assert.equal(canUseOffer({ eligibility: "members", cohort_id: null }, member), true);
  assert.equal(canUseOffer({ eligibility: "incubator_participants", cohort_id: null }, member), false);
  assert.equal(canUseOffer({ eligibility: "incubator_participants", cohort_id: null }, p1), true);
  assert.equal(canUseOffer({ eligibility: "incubator_participants", cohort_id: "c2" }, p1), false);
  assert.equal(canUseOffer({ eligibility: "incubator_participants", cohort_id: "c1" }, p1), true);
  assert.equal(audienceLabel({ eligibility: "incubator_participants", cohort_id: null }), "For PANA incubator participants");
  assert.equal(howToUse({ claim_method: "external_link", external_url: "https://x.org", how_to: null }).href, "https://x.org");
  assert.equal(howToUse({ claim_method: "show_badge", external_url: null, how_to: "Ask at the desk" }).text, "Ask at the desk");
});

test("badge display name: first name and last initial only", () => {
  assert.equal(badgeDisplayName("Maria Lopez Garcia"), "Maria G.");
  assert.equal(badgeDisplayName("Prince"), "Prince");
  assert.equal(badgeDisplayName("  "), "PANA participant");
  assert.equal(badgeDisplayName(null), "PANA participant");
});

test("badge tokens: 128-bit, derived from secret + nonce, only the hash is stored", () => {
  const s = "x".repeat(40);
  const n = newNonce();
  const t = deriveToken(s, n);
  assert.match(t, TOKEN_RE);
  assert.equal(deriveToken(s, n), t, "deterministic");
  assert.notEqual(deriveToken("y".repeat(40), n), t, "secret matters");
  assert.notEqual(deriveToken(s, newNonce()), t, "new nonce = new code");
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.equal(badgeSecret({ BADGE_TOKEN_SECRET: "short" }), null, "weak secrets are refused");
  assert.equal(badgeSecret({}), null);
  const ok = { revoked_at: null, expires_at: new Date(Date.now() + 1000), app_status: "accepted", participant_status: "active", member_status: "active" };
  assert.equal(badgeIsValid(ok), true);
  assert.equal(badgeIsValid({ ...ok, expires_at: new Date(Date.now() - 1000) }), false);
  assert.equal(badgeIsValid({ ...ok, revoked_at: new Date() }), false);
  assert.equal(badgeIsValid({ ...ok, participant_status: "completed" }), false);
  assert.equal(badgeIsValid({ ...ok, member_status: "banned" }), false);
  assert.equal(badgeIsValid(null), false);
});

test("rate limit and dot-path 404s", () => {
  _resetForTests();
  const now = 1_000_000;
  assert.equal(hit("t", "1.2.3.4", 2, 60_000, now), true);
  assert.equal(hit("t", "1.2.3.4", 2, 60_000, now), true);
  assert.equal(hit("t", "1.2.3.4", 2, 60_000, now), false);
  assert.equal(hit("t", "5.6.7.8", 2, 60_000, now), true, "per key");
  assert.equal(hit("t", "1.2.3.4", 2, 60_000, now + 60_001), true, "window resets");
  for (const p of ["/.git/HEAD", "/.env", "/x/.svn/entries", "/%2Egit/config"]) assert.equal(isDotPath(p), true, p);
  for (const p of ["/", "/incubator", "/.well-known/security.txt", "/verify/abc_DEF-123"]) assert.equal(isDotPath(p), false, p);
});
